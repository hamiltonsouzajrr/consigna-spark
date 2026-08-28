import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { toast } from "sonner";
import { Eye, EyeOff, KeyRound } from "lucide-react";

export const Route = createFileRoute("/_authenticated/conta/senha")({
  head: () => ({
    meta: [
      { title: "Alterar senha — Grupo Positive" },
      { name: "description", content: "Defina uma nova senha de acesso ao sistema do Grupo Positive." },
      { property: "og:title", content: "Alterar senha — Grupo Positive" },
      { property: "og:description", content: "Troque sua senha de acesso ao sistema do Grupo Positive." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: AlterarSenhaPage,
});

function AlterarSenhaPage() {
  const { updatePassword, user } = useAuth();
  const nav = useNavigate();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);

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
    if (error) {
      setBusy(false);
      toast.error("Não foi possível alterar a senha", { description: error, duration: 8000 });
      return;
    }
    if (user?.id) {
      await supabase.from("profiles").update({ senha_temporaria: false }).eq("user_id", user.id);
    }
    setBusy(false);
    toast.success("Senha alterada com sucesso!");
    window.dispatchEvent(new Event("senha-atualizada"));
    nav({ to: "/prospeccao" });
  };

  return (
    <main className="mx-auto w-full max-w-lg p-4 sm:p-6">
      <Card className="p-6 sm:p-8">
        <div className="mb-6 flex items-center gap-3">
          <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary/10 text-primary">
            <KeyRound className="h-5 w-5" />
          </span>
          <div className="min-w-0">
            <h1 className="truncate text-lg font-bold sm:text-xl">Alterar senha</h1>
            <p className="truncate text-sm text-muted-foreground">{user?.email}</p>
          </div>
        </div>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="nova-senha">Nova senha</Label>
            <div className="relative">
              <Input
                id="nova-senha"
                type={show ? "text" : "password"}
                autoComplete="new-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="h-11 pr-11"
              />
              <button
                type="button"
                onClick={() => setShow((v) => !v)}
                aria-label={show ? "Ocultar senha" : "Mostrar senha"}
                className="absolute inset-y-0 right-0 flex items-center px-3 text-muted-foreground hover:text-foreground"
              >
                {show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="confirmar-senha">Confirmar nova senha</Label>
            <Input
              id="confirmar-senha"
              type={show ? "text" : "password"}
              autoComplete="new-password"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              placeholder="••••••••"
              className="h-11"
            />
          </div>
          <Button className="h-11 w-full" disabled={busy || !password || !confirm} onClick={handle}>
            {busy ? "Aguarde…" : "Salvar nova senha"}
          </Button>
        </div>
      </Card>
    </main>
  );
}
