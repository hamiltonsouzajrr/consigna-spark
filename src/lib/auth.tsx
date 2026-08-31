import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { Session, User } from "@supabase/supabase-js";
import { signUpWithCpf } from "@/lib/auth/account.functions";

interface AuthCtx {
  user: User | null;
  session: Session | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<{ error: string | null }>;
  signUp: (input: { nome: string; cpf: string; email: string; password: string }) => Promise<{ error: string | null }>;
  resetPassword: (email: string) => Promise<{ error: string | null }>;
  updatePassword: (password: string) => Promise<{ error: string | null }>;
  signOut: () => Promise<void>;
}

const Ctx = createContext<AuthCtx | undefined>(undefined);

/** Tempo máximo de espera para cada chamada de autenticação (evita botão preso em "Aguarde…"). */
const AUTH_TIMEOUT_MS = 20_000;
/** Tempo máximo para o carregamento inicial da sessão no primeiro acesso. */
const BOOT_TIMEOUT_MS = 10_000;

/** Garante que uma promise nunca trave a interface: após o tempo limite, rejeita com mensagem clara. */
function withTimeout<T>(promise: Promise<T>, ms: number, message: string): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(message)), ms);
    promise.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (error) => {
        clearTimeout(timer);
        reject(error);
      },
    );
  });
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;

    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => {
      if (!active) return;
      setSession(s);
      setLoading(false);
    });

    // Mesmo que o servidor demore a responder, a tela não fica presa em "Carregando…".
    const bootTimer = setTimeout(() => {
      if (active) setLoading(false);
    }, BOOT_TIMEOUT_MS);

    supabase.auth
      .getSession()
      .then(({ data }) => {
        if (!active) return;
        setSession(data.session);
        setLoading(false);
      })
      .catch(() => {
        // Falha ao restaurar a sessão: segue para a tela de login em vez de travar.
        if (!active) return;
        setLoading(false);
      });

    return () => {
      active = false;
      clearTimeout(bootTimer);
      sub.subscription.unsubscribe();
    };
  }, []);

  const signIn = async (email: string, password: string) => {
    try {
      const result = await withTimeout(
        supabase.auth.signInWithPassword({ email, password }),
        AUTH_TIMEOUT_MS,
        "O servidor de login não respondeu a tempo. Verifique sua conexão e tente novamente.",
      );
      // Sem erro: grava a sessão no estado local já, para o redirect não ficar
      // dependendo apenas do evento assíncrono do onAuthStateChange.
      if (!result.error && result.data.session) {
        setSession(result.data.session);
      }
      return { error: result.error?.message ?? null };
    } catch (error: any) {
      return {
        error:
          error?.message ??
          "Não foi possível conectar ao servidor de login. Tente novamente em instantes.",
      };
    }
  };

  const signUp = async (input: { nome: string; cpf: string; email: string; password: string }) => {
    try {
      await withTimeout(
        signUpWithCpf({ data: input }),
        AUTH_TIMEOUT_MS,
        "O servidor de cadastro não respondeu a tempo. Tente novamente.",
      );
    } catch (error: any) {
      return {
        error: error?.message ?? "Não foi possível criar a conta agora. Tente novamente.",
      };
    }
    try {
      const result = await withTimeout(
        supabase.auth.signInWithPassword({ email: input.email, password: input.password }),
        AUTH_TIMEOUT_MS,
        "Conta criada, mas o login não respondeu a tempo. Entre novamente em instantes.",
      );
      if (!result.error && result.data.session) {
        setSession(result.data.session);
      }
      return { error: result.error?.message ?? null };
    } catch (error: any) {
      return {
        error:
          error?.message ??
          "Conta criada, mas não foi possível entrar agora. Tente novamente em instantes.",
      };
    }
  };

  const resetPassword = async (email: string) => {
    try {
      const result = await withTimeout(
        supabase.auth.resetPasswordForEmail(email, {
          redirectTo: `${window.location.origin}/reset-password`,
        }),
        AUTH_TIMEOUT_MS,
        "O servidor não respondeu a tempo. Tente novamente em instantes.",
      );
      return { error: result.error?.message ?? null };
    } catch (error: any) {
      return {
        error: error?.message ?? "Não foi possível enviar o e-mail agora. Tente novamente.",
      };
    }
  };

  const updatePassword = async (password: string) => {
    try {
      const result = await withTimeout(
        supabase.auth.updateUser({ password }),
        AUTH_TIMEOUT_MS,
        "O servidor não respondeu a tempo. Tente novamente em instantes.",
      );
      return { error: result.error?.message ?? null };
    } catch (error: any) {
      return {
        error:
          error?.message ?? "Não foi possível atualizar a senha agora. Tente novamente.",
      };
    }
  };

  const signOut = async () => {
    try {
      await withTimeout(supabase.auth.signOut(), AUTH_TIMEOUT_MS, "Saindo…");
    } catch {
      // Mesmo que o servidor demore, encerra a sessão local para não prender o usuário.
      setSession(null);
    }
  };

  return (
    <Ctx.Provider
      value={{
        user: session?.user ?? null,
        session,
        loading,
        signIn,
        signUp,
        resetPassword,
        updatePassword,
        signOut,
      }}
    >
      {children}
    </Ctx.Provider>
  );
}

export function useAuth() {
  const v = useContext(Ctx);
  if (!v) throw new Error("useAuth must be inside AuthProvider");
  return v;
}
