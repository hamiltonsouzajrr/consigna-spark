import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Wallet } from "lucide-react";
import { toast } from "sonner";

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
  const { user, signIn, signUp } = useAuth();
  const nav = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => { if (user) nav({ to: "/dashboard" }); }, [user, nav]);

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
    return { title: "Não foi possível concluir", description: msg };
  };

  const handle = async (mode: "in" | "up") => {
    setBusy(true);
    const { error } = mode === "in" ? await signIn(email, password) : await signUp(email, password);
    setBusy(false);
    if (error) {
      const { title, description } = translateError(error);
      toast.error(title, { description, duration: 8000 });
    } else if (mode === "up") {
      toast.success("Conta criada! Faça login.");
    }
  };

  return (
    <main className="flex min-h-screen items-center justify-center bg-gradient-to-br from-background to-accent p-4">
      <Card className="w-full max-w-md p-8">
        <div className="mb-6 flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary text-primary-foreground">
            <Wallet className="h-6 w-6" />
          </div>
          <div>
            <h1 className="text-xl font-bold">Consulta de Margem</h1>
            <p className="text-sm text-muted-foreground">Acesse o painel administrativo</p>
          </div>
        </div>

        <Tabs defaultValue="in">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="in">Entrar</TabsTrigger>
            <TabsTrigger value="up">Criar conta</TabsTrigger>
          </TabsList>
          {(["in", "up"] as const).map((m) => (
            <TabsContent key={m} value={m} className="mt-4 space-y-4">
              <div className="space-y-2">
                <Label>Email</Label>
                <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="seu@email.com" />
              </div>
              <div className="space-y-2">
                <Label>Senha</Label>
                <Input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" />
              </div>
              <Button className="w-full" disabled={busy || !email || !password} onClick={() => handle(m)}>
                {busy ? "Aguarde…" : m === "in" ? "Entrar" : "Criar conta"}
              </Button>
            </TabsContent>
          ))}
        </Tabs>
      </Card>
    </div>
  );
}
