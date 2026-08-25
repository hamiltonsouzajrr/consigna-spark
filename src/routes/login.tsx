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
import logo from "@/assets/grupo-positive-logo.png.asset.json";
import { formatCpf, isValidCpf, normalizeCpf } from "@/lib/cpf";
import { sendResetByCpf } from "@/lib/auth/account.functions";

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

  useEffect(() => { if (user) nav({ to: "/prospeccao" }); }, [user, nav]);

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
        if (res.found) {
          toast.success("Email enviado!", {
            description: `Enviamos o link de redefinição para ${res.emailMasked}.`,
            duration: 10000,
          });
          setRecovering(false);
        } else {
          toast.error("CPF não encontrado", {
            description: "Não localizamos uma conta com este CPF. Tente pelo e-mail.",
            duration: 8000,
          });
        }
      } catch (e: any) {
        toast.error("Não foi possível enviar", { description: e?.message, duration: 8000 });
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
    const { error } = await resetPassword(email);
    setBusy(false);
    if (error) {
      const { title, description } = translateError(error);
      toast.error(title, { description, duration: 8000 });
    } else {
      toast.success("Email enviado!", {
        description: "Se houver uma conta com esse email, você receberá um link para redefinir a senha.",
        duration: 8000,
      });
      setRecovering(false);
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
    const { error } =
      mode === "in"
        ? await signIn(email, password)
        : await signUp({ nome: nome.trim(), cpf: normalizeCpf(cpf), email, password });
    setBusy(false);
    if (error) {
      const { title, description } = translateError(error);
      toast.error(title, { description, duration: 8000 });
    } else if (mode === "up") {
      toast.success("Conta criada com sucesso!");
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
            <button
              type="button"
              onClick={() => setRecovering(false)}
              className="w-full text-center text-sm text-muted-foreground hover:text-foreground"
            >
              Voltar ao login
            </button>
          </div>
        ) : (
        <Tabs defaultValue="in">
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
      </Card>
    </main>
  );
}
