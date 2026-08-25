import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { toast } from "sonner";
import { Eye, EyeOff } from "lucide-react";
import logo from "@/assets/grupo-positive-logo.png.asset.json";

export const Route = createFileRoute("/reset-password")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Redefinir senha — Grupo Positive" },
      { name: "description", content: "Defina uma nova senha para sua conta do Grupo Positive." },
    ],
  }),
  component: ResetPasswordPage,
});

function ResetPasswordPage() {
  const { updatePassword } = useAuth();
  const nav = useNavigate();
  const [ready, setReady] = useState(false);
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const { data: sub } = supabase.auth.onAuthStateChange((event) => {
      if (event === "PASSWORD_RECOVERY" || event === "SIGNED_IN") setReady(true);
    });
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) setReady(true);
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  const handle = async () => {
    if (password.length < 8) {
      toast.error("Senha muito curta", { description: "Use no mínimo 8 caracteres." });
      return;
    }
    if (password !== confirm) {
      toast.error("As senhas não coincidem");
      return;
    }
    setBusy(true);
    const { error } = await updatePassword(password);
    setBusy(false);
    if (error) {
      toast.error("Não foi possível redefinir", { description: error, duration: 8000 });
    } else {
      toast.success("Senha redefinida com sucesso!");
      nav({ to: "/prospeccao" });
    }
  };

  return (
    <main className="flex min-h-screen items-center justify-center app-bg p-4 sm:p-6">
      <Card className="w-full max-w-md p-6 shadow-[var(--shadow-glow)] sm:p-8">
        <div className="mb-6 flex items-center gap-3">
          <img
            src={logo.url}
            alt="Grupo Positive"
            className="h-11 w-11 shrink-0 rounded-xl bg-white object-contain p-1 shadow-[var(--shadow-elegant)] sm:h-12 sm:w-12"
          />
          <div className="min-w-0">
            <h1 className="truncate text-lg font-bold sm:text-xl">Redefinir senha</h1>
            <p className="truncate text-sm text-muted-foreground">Defina uma nova senha de acesso</p>
          </div>
        </div>

        {!ready ? (
          <p className="text-sm text-muted-foreground">
            Abra esta página pelo link enviado ao seu email para redefinir a senha.
          </p>
        ) : (
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Nova senha</Label>
              <div className="relative">
                <Input
                  type={showPassword ? "text" : "password"}
                  autoComplete="new-password"
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
            <div className="space-y-2">
              <Label>Confirmar nova senha</Label>
              <Input
                type={showPassword ? "text" : "password"}
                autoComplete="new-password"
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                placeholder="••••••••"
                className="h-11"
              />
            </div>
            <Button className="h-11 w-full" disabled={busy || !password || !confirm} onClick={handle}>
              {busy ? "Aguarde…" : "Redefinir senha"}
            </Button>
          </div>
        )}
      </Card>
    </main>
  );
}
