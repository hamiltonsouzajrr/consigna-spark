import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import { Eye, EyeOff } from "lucide-react";
import logo from "@/assets/grupo-positive-logo-2026.png.asset.json";
import loginBgDesktop from "@/assets/login-bg-1600.webp.asset.json";
import loginBgMobile from "@/assets/login-bg-900.webp.asset.json";

/** Miniatura embutida (102 bytes) usada como placeholder enquanto o WebP carrega. */
const LOGIN_BG_LQIP =
  "data:image/webp;base64,UklGRl4AAABXRUJQVlA4IFIAAAAQBACdASoYAA4APu1mqk4ppaOiMAgBMB2JaACsAGlhsm0/CoqgyrtjYAD+/fsvyNt+nX70EIaSnekga9JJxiuz1opbcZ5ojjQCCUdGxU+Z5gAA";
import { formatCpf, isValidCpf, normalizeCpf } from "@/lib/cpf";
import { sendResetByCpf } from "@/lib/auth/account.functions";
import { AVISO_PRIMEIRO_ACESSO_KEY, PrimeiroAcessoDialog } from "@/components/auth/PrimeiroAcessoDialog";

export const Route = createFileRoute("/login")({
  head: () => ({
    meta: [
      { title: "Entrar — Grupo Positive" },
      { name: "description", content: "Acesso de operadores à plataforma de consulta de margem consignável do Grupo Positive." },
      { property: "og:title", content: "Entrar — Grupo Positive" },
      { property: "og:description", content: "Acesso de operadores à plataforma de consulta de margem consignável do Grupo Positive." },
      { property: "og:url", content: "https://consigna-spark.lovable.app/login" },
    ],
    links: [{ rel: "canonical", href: "https://consigna-spark.lovable.app/login" }],
  }),
  component: LoginPage,
});

function LoginPage() {
  const { user, signIn, signUp, resetPassword } = useAuth();
  const nav = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [busy, setBusy] = useState(false);
  const [recovering, setRecovering] = useState(false);
  const [nome, setNome] = useState("");
  const [cpf, setCpf] = useState("");
  const [recoverBy, setRecoverBy] = useState<"email" | "cpf">("email");
  const [recoverCpf, setRecoverCpf] = useState("");
  const [tab, setTab] = useState<"in" | "up">("in");
  const [avisoOpen, setAvisoOpen] = useState(false);

  useEffect(() => { if (user) nav({ to: "/prospeccao" }); }, [user, nav]);

  useEffect(() => {
    try {
      if (!localStorage.getItem(AVISO_PRIMEIRO_ACESSO_KEY)) setAvisoOpen(true);
    } catch { /* storage indisponível */ }
  }, []);

  const fecharAviso = (open: boolean) => {
    setAvisoOpen(open);
    if (!open) {
      try { localStorage.setItem(AVISO_PRIMEIRO_ACESSO_KEY, new Date().toISOString()); } catch { /* noop */ }
    }
  };

  const handleReset = async () => {
    if (recoverBy === "cpf") {
      if (!isValidCpf(recoverCpf)) {
        toast.error("CPF inválido", { description: "Confira os números digitados." });
        return;
      }
      setBusy(true);
      try {
        const res = await sendResetByCpf({
          data: { cpf: normalizeCpf(recoverCpf), redirectTo: `${window.location.origin}/reset-password` },
        });
        if (!res.found) {
          toast.error("CPF não encontrado", {
            description: "Não localizamos uma conta com este CPF. Tente pelo e-mail.",
            duration: 8000,
          });
        } else if (!res.enviado) {
          toast.error("Não foi possível enviar o e-mail", {
            description:
              "O envio de e-mails está indisponível no momento. Fale com o administrador para receber seu link de acesso.",
            duration: 12000,
          });
        } else {
          toast.success("Email enviado!", {
            description: `Enviamos o link de redefinição para ${res.emailMasked}. Se não chegar em alguns minutos, peça o link ao administrador.`,
            duration: 12000,
          });
          setRecovering(false);
        }
      } catch (e: any) {
        toast.error("Não foi possível enviar", {
          description:
            (e?.message ?? "") +
            " Fale com o administrador para receber seu link de acesso.",
          duration: 10000,
        });
      } finally {
        setBusy(false);
      }
      return;
    }

    if (!email) {
      toast.error("Informe seu email", { description: "Digite o email da conta para enviar o link de recuperação." });
      return;
    }
    setBusy(true);
    try {
      const { error } = await resetPassword(email);
      if (error) {
        const { title, description } = translateError(error);
        toast.error(title, {
          description: `${description ?? ""} Se o problema continuar, peça o link de redefinição ao administrador.`,
          duration: 10000,
        });
      } else {
        toast.success("Email enviado!", {
          description:
            "Se houver uma conta com esse email, você receberá um link para redefinir a senha. Não chegou? Peça o link ao administrador.",
          duration: 12000,
        });
        setRecovering(false);
      }
    } catch (error: any) {
      toast.error("Não foi possível enviar", {
        description: `${error?.message ?? ""} Se o problema continuar, peça o link de redefinição ao administrador.`,
        duration: 10000,
      });
    } finally {
      setBusy(false);
    }
  };

  const translateError = (msg: string): { title: string; description?: string } => {
    const m = msg.toLowerCase();
    if (m.includes("pwned") || m.includes("compromised") || m.includes("leaked") || m.includes("breach")) {
      return {
        title: "Senha bloqueada por segurança",
        description:
          "Esta senha já apareceu em vazamentos públicos e não pode ser usada. Escolha uma senha forte: pelo menos 8 caracteres, combine letras maiúsculas, minúsculas, números e símbolos, e evite palavras comuns ou sequências (ex.: 123456, senha, qwerty).",
      };
    }
    if (m.includes("password should be at least") || m.includes("password is too short") || m.includes("weak password")) {
      return {
        title: "Senha muito fraca",
        description: "Use no mínimo 8 caracteres, misturando letras, números e símbolos.",
      };
    }
    if (m.includes("invalid login") || m.includes("invalid credentials")) {
      return { title: "Email ou senha incorretos", description: "Verifique seus dados e tente novamente." };
    }
    if (m.includes("user already registered") || m.includes("already registered")) {
      return { title: "Este email já possui cadastro", description: "Tente entrar ou recuperar a senha." };
    }
    if (m.includes("email") && m.includes("invalid")) {
      return { title: "Email inválido", description: "Informe um endereço de email válido." };
    }
    if (m.includes("missing supabase") || m.includes("environment variable")) {
      return {
        title: "Servidor de login indisponível",
        description:
          "A configuração de acesso do painel está ausente ou incompleta. Peça ao administrador para reconectar o Supabase na plataforma e tente novamente.",
      };
    }
    if (
      m.includes("não respondeu") ||
      m.includes("demorou") ||
      m.includes("timeout") ||
      m.includes("failed to fetch") ||
      m.includes("load failed") ||
      m.includes("network") ||
      m.includes("conexão")
    ) {
      return {
        title: "Servidor demorou para responder",
        description:
          "Pode ser um pico momentâneo de acesso. Verifique sua conexão com a internet e tente novamente em alguns segundos. Se o problema continuar, avise o administrador.",
      };
    }
    return { title: "Não foi possível concluir", description: msg };
  };

  const handle = async (mode: "in" | "up") => {
    if (mode === "up") {
      if (nome.trim().length < 3) {
        toast.error("Informe seu nome completo");
        return;
      }
      if (!isValidCpf(cpf)) {
        toast.error("CPF inválido", { description: "Confira os números digitados." });
        return;
      }
    }
    setBusy(true);
    try {
      const { error } =
        mode === "in"
          ? await signIn(email, password)
          : await signUp({ nome: nome.trim(), cpf: normalizeCpf(cpf), email, password });

      if (error) {
        const { title, description } = translateError(error);
        toast.error(title, { description, duration: 8000 });
      } else if (mode === "up") {
        toast.success("Conta criada com sucesso!");
      }
      // No login (mode "in") sem erro, o AuthProvider atualiza a sessão e o
      // redirecionamento acontece sozinho pelo useEffect acima.
    } catch (error: any) {
      const { title, description } = translateError(
        error?.message ?? "Erro inesperado ao entrar. Tente novamente.",
      );
      toast.error(title, { description, duration: 10000 });
    } finally {
      setBusy(false);
    }
  };

  return (
    <main className="relative flex min-h-screen items-center justify-center overflow-hidden app-bg p-4 sm:p-6">
      {/* Fundo da marca em WebP: 900px no mobile, 1600px no desktop. LQIP evita flash branco. */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 bg-cover bg-right sm:bg-center"
        style={{ backgroundImage: `url("${LOGIN_BG_LQIP}")` }}
      >
        <img
          src={loginBgDesktop.url}
          srcSet={`${loginBgMobile.url} 900w, ${loginBgDesktop.url} 1600w`}
          sizes="100vw"
          alt=""
          decoding="async"
          fetchPriority="high"
          className="h-full w-full select-none object-cover object-right sm:object-center"
        />
      </div>
      <div className="pointer-events-none absolute inset-0 bg-background/35 sm:bg-background/25" />

      <Card className="relative z-10 w-full max-w-md border-white/60 bg-card/85 p-6 shadow-[var(--shadow-glow)] backdrop-blur-xl sm:p-8">

        <div className="mb-6 flex items-center gap-3">
          <img
            src={logo.url}
            alt="Grupo Positive"
            className="h-11 w-11 shrink-0 rounded-xl bg-white object-contain p-1 shadow-[var(--shadow-elegant)] sm:h-12 sm:w-12"
          />
          <div className="min-w-0">
            <h1 className="truncate text-lg font-bold sm:text-xl">Consulta de Margem</h1>
            <p className="truncate text-sm text-muted-foreground">Acesse o painel administrativo</p>
          </div>
        </div>

        {recovering ? (
          <div className="space-y-4">
            <div>
              <h2 className="text-base font-semibold">Recuperar conta</h2>
              <p className="text-sm text-muted-foreground">
                Informe o e-mail ou o CPF da sua conta. O link de redefinição é sempre enviado para o
                e-mail cadastrado.
              </p>
            </div>
            <div className="grid grid-cols-2 gap-2">
              {(["email", "cpf"] as const).map((k) => (
                <button
                  key={k}
                  type="button"
                  onClick={() => setRecoverBy(k)}
                  className={`h-10 rounded-md border text-sm transition ${
                    recoverBy === k
                      ? "border-primary bg-primary/10 text-primary"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {k === "email" ? "Por e-mail" : "Por CPF"}
                </button>
              ))}
            </div>
            {recoverBy === "email" ? (
              <div className="space-y-2">
                <Label>Email</Label>
                <Input
                  type="email"
                  inputMode="email"
                  autoComplete="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="seu@email.com"
                  className="h-11"
                />
              </div>
            ) : (
              <div className="space-y-2">
                <Label>CPF</Label>
                <Input
                  inputMode="numeric"
                  value={recoverCpf}
                  onChange={(e) => setRecoverCpf(formatCpf(normalizeCpf(e.target.value).slice(0, 11)))}
                  placeholder="000.000.000-00"
                  className="h-11"
                />
              </div>
            )}
            <Button
              className="h-11 w-full"
              disabled={busy || (recoverBy === "email" ? !email : !recoverCpf)}
              onClick={handleReset}
            >
              {busy ? "Aguarde…" : "Enviar link de recuperação"}
            </Button>
            <p className="rounded-lg bg-muted/60 p-3 text-xs text-muted-foreground">
              <span className="font-semibold text-foreground">Não recebeu o e-mail?</span> Peça ao
              administrador para gerar seu link de redefinição de senha — ele envia o link
              diretamente para você, sem depender de e-mail.
            </p>

            <button
              type="button"
              onClick={() => setRecovering(false)}
              className="w-full text-center text-sm text-muted-foreground hover:text-foreground"
            >
              Voltar ao login
            </button>
          </div>
        ) : (
        <Tabs value={tab} onValueChange={(v) => setTab(v as "in" | "up")}>
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="in">Entrar</TabsTrigger>
            <TabsTrigger value="up">Criar conta</TabsTrigger>
          </TabsList>
          {(["in", "up"] as const).map((m) => (
            <TabsContent key={m} value={m} className="mt-4 space-y-4">
              {m === "up" && (
                <>
                  <div className="space-y-2">
                    <Label>Nome completo</Label>
                    <Input
                      autoComplete="name"
                      value={nome}
                      onChange={(e) => setNome(e.target.value)}
                      placeholder="Seu nome completo"
                      className="h-11"
                      maxLength={120}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>CPF</Label>
                    <Input
                      inputMode="numeric"
                      value={cpf}
                      onChange={(e) => setCpf(formatCpf(normalizeCpf(e.target.value).slice(0, 11)))}
                      placeholder="000.000.000-00"
                      className="h-11"
                    />
                    <p className="text-xs text-muted-foreground">
                      Permitida apenas uma conta por CPF.
                    </p>
                  </div>
                </>
              )}
              <div className="space-y-2">
                <Label>Email</Label>
                <Input
                  type="email"
                  inputMode="email"
                  autoComplete="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="seu@email.com"
                  className="h-11"
                />
                {m === "up" && (
                  <p className="text-xs text-muted-foreground">
                    Use um e-mail que você acessa — é para lá que vai o link de recuperação de senha.
                  </p>
                )}
              </div>
              <div className="space-y-2">
                <Label>Senha</Label>
                <div className="relative">
                  <Input
                    type={showPassword ? "text" : "password"}
                    autoComplete={m === "in" ? "current-password" : "new-password"}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    className="h-11 pr-11"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((v) => !v)}
                    aria-label={showPassword ? "Ocultar senha" : "Mostrar senha"}
                    className="absolute inset-y-0 right-0 flex items-center px-3 text-muted-foreground hover:text-foreground"
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>
              {m === "in" && (
                <button
                  type="button"
                  onClick={() => setRecovering(true)}
                  className="text-sm text-primary hover:underline"
                >
                  Esqueceu a senha? Recuperar conta
                </button>
              )}
              <Button
                className="h-11 w-full"
                disabled={busy || !email || !password || (m === "up" && (!nome || !cpf))}
                onClick={() => handle(m)}
              >
                {busy ? "Aguarde…" : m === "in" ? "Entrar" : "Criar conta"}
              </Button>
            </TabsContent>
          ))}
        </Tabs>
        )}

        <p className="mt-6 border-t pt-4 text-center text-xs text-muted-foreground">
          Primeiro acesso após a atualização?{" "}
          <button
            type="button"
            onClick={() => setAvisoOpen(true)}
            className="text-primary hover:underline"
          >
            Ver instruções de primeiro acesso
          </button>
        </p>
      </Card>

      <PrimeiroAcessoDialog
        open={avisoOpen}
        onOpenChange={fecharAviso}
        onCriarConta={() => {
          setRecovering(false);
          setTab("up");
          fecharAviso(false);
        }}
      />
    </main>
  );
}
