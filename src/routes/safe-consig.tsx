import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { AppShell } from "@/components/AppShell";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { ShieldCheck, ShieldAlert, ShieldQuestion, Loader2, Search, ExternalLink, Copy } from "lucide-react";
import { consultarSafeConsig } from "@/lib/safeconsig.functions";
import { formatCpf, isValidCpf, normalizeCpf } from "@/lib/cpf";
import { toast } from "sonner";

const SAFECONSIG_URL = "https://alagoas.safeconsig.com.br/safe/login";

export const Route = createFileRoute("/safe-consig")({
  head: () => ({
    meta: [
      { title: "Verificar cadastro SafeConsig — Grupo Positive" },
      {
        name: "description",
        content:
          "Consulta o cadastro de um servidor no portal SafeConsig (Alagoas) a partir do CPF.",
      },
    ],
  }),
  component: SafeConsigPage,
});

type Result = Awaited<ReturnType<typeof consultarSafeConsig>>;

const STATUS_META: Record<
  Result["status"],
  {
    label: string;
    tone: "default" | "destructive" | "secondary" | "success";
    Icon: typeof ShieldCheck;
    hint: string;
  }
> = {
  enviado: {
    label: "Cadastro encontrado",
    tone: "default",
    Icon: ShieldCheck,
    hint: "Servidor possui cadastro e e-mail válido. Reset de senha enviado.",
  },
  sem_email: {
    label: "Provável margem disponível",
    tone: "success",
    Icon: ShieldCheck,
    hint:
      "A SafeConsig não retornou e-mail para esse CPF — forte indício de que o servidor NÃO possui cadastro ativo e, portanto, há alta probabilidade de margem disponível.",
  },
  nao_cadastrado: {
    label: "Não cadastrado — alta chance de margem",
    tone: "success",
    Icon: ShieldCheck,
    hint: "CPF não encontrado na SafeConsig. Alta probabilidade de haver margem disponível.",
  },
  desconhecido: {
    label: "Resposta inesperada",
    tone: "secondary",
    Icon: ShieldQuestion,
    hint: "A SafeConsig respondeu, mas a mensagem não foi reconhecida. Confira abaixo.",
  },
  erro: {
    label: "Falha na consulta",
    tone: "destructive",
    Icon: ShieldAlert,
    hint: "Não foi possível concluir a consulta. Tente novamente em instantes.",
  },
};

function SafeConsigPage() {
  const consultar = useServerFn(consultarSafeConsig);
  const [cpf, setCpf] = useState("");
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<Result | null>(null);

  const handleChange = (v: string) => {
    const digits = normalizeCpf(v).slice(0, 11);
    setCpf(digits.length === 11 ? formatCpf(digits) : digits);
  };

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const digits = normalizeCpf(cpf);
    if (!isValidCpf(digits)) {
      toast.error("CPF inválido");
      return;
    }
    setBusy(true);
    setResult(null);
    try {
      const r = await consultar({ data: { cpf: digits } });
      setResult(r);
    } catch (err) {
      setResult({
        status: "erro",
        message: err instanceof Error ? err.message : "Erro inesperado.",
      });
    } finally {
      setBusy(false);
    }
  };

  const meta = result ? STATUS_META[result.status] : null;
  const Icon = meta?.Icon;

  return (
    <AppShell>
      <div className="mx-auto max-w-2xl space-y-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Verificar cadastro — SafeConsig</h1>
          <p className="text-sm text-muted-foreground">
            Informe o CPF do servidor para verificar se possui cadastro no portal{" "}
            <span className="font-medium">alagoas.safeconsig.com.br</span>.
          </p>
        </div>

        <Card className="p-6">
          <form onSubmit={onSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="cpf">CPF do servidor</Label>
              <Input
                id="cpf"
                inputMode="numeric"
                placeholder="000.000.000-00"
                value={cpf}
                onChange={(e) => handleChange(e.target.value)}
                maxLength={14}
                autoFocus
              />
            </div>
            <div className="flex flex-col sm:flex-row gap-2">
              <Button type="submit" disabled={busy} className="gap-2">
                {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
                {busy ? "Consultando…" : "Consultar SafeConsig"}
              </Button>
              <Button
                type="button"
                variant="outline"
                className="gap-2"
                onClick={async () => {
                  const digits = normalizeCpf(cpf);
                  if (digits) {
                    try {
                      await navigator.clipboard.writeText(digits);
                      toast.success("CPF copiado", {
                        description: "Cole no campo da SafeConsig que será aberta.",
                      });
                    } catch {
                      // ignore clipboard errors
                    }
                  }
                  window.open(SAFECONSIG_URL, "_blank", "noopener,noreferrer");
                }}
              >
                <ExternalLink className="h-4 w-4" />
                Verificar manualmente
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">
              <Copy className="inline h-3 w-3 mr-1 align-text-bottom" />
              A opção manual copia o CPF e abre a SafeConsig em nova aba, para você resolver o
              captcha e concluir a verificação caso a consulta automática falhe.
            </p>
          </form>
        </Card>

        {result && meta && Icon && (
          <Alert
            variant={meta.tone === "destructive" ? "destructive" : "default"}
            className={
              meta.tone === "success"
                ? "border-green-500/50 bg-green-50 text-green-900 dark:border-green-500/40 dark:bg-green-950/40 dark:text-green-100 [&>svg]:text-green-600 dark:[&>svg]:text-green-400"
                : undefined
            }
          >
            <Icon className="h-4 w-4" />
            <AlertTitle className="flex items-center gap-2">
              {meta.label}
              <Badge
                variant="outline"
                className={
                  meta.tone === "success"
                    ? "font-mono text-xs border-green-600/40 text-green-800 dark:text-green-200"
                    : "font-mono text-xs"
                }
              >
                {result.status}
              </Badge>
            </AlertTitle>
            <AlertDescription className="space-y-2">
              <p className="text-sm">{meta.hint}</p>
              <div
                className={
                  meta.tone === "success"
                    ? "rounded-md border border-green-600/30 bg-green-100/60 p-3 text-sm whitespace-pre-wrap dark:bg-green-900/30"
                    : "rounded-md border bg-muted/40 p-3 text-sm whitespace-pre-wrap"
                }
              >
                {result.message}
              </div>
              {result.raw && (
                <details className="text-xs">
                  <summary className="cursor-pointer text-muted-foreground">
                    Ver resposta bruta
                  </summary>
                  <pre className="mt-2 max-h-64 overflow-auto rounded bg-background p-2 text-[10px]">
                    {result.raw}
                  </pre>
                </details>
              )}
            </AlertDescription>
          </Alert>
        )}

        <p className="text-xs text-muted-foreground">
          Esta consulta utiliza o fluxo público "Esqueci Minha Senha" da SafeConsig. Caso a SafeConsig
          ative uma proteção de captcha mais estrita, esta verificação poderá deixar de funcionar.
        </p>
      </div>
    </AppShell>
  );
}
