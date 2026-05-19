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
    tone: "default" | "destructive" | "secondary" | "success" | "warning";
    Icon: typeof ShieldCheck;
    hint: string;
  }
> = {
  enviado: {
    label: "Acesso já criado — recuperar senha via WhatsApp",
    tone: "warning",
    Icon: ShieldAlert,
    hint:
      "O servidor já possui acesso criado na SafeConsig (e-mail cadastrado) e o portal disparou o e-mail de recuperação. Para o fluxo de margem, oriente o servidor a recuperar a senha pelo WhatsApp 0800 000 1528 em vez de usar o e-mail.",
  },
  sem_email: {
    label: "Cadastrado sem e-mail — apto, atenção no contato",
    tone: "warning",
    Icon: ShieldQuestion,
    hint:
      "O CPF está cadastrado na SafeConsig, porém SEM e-mail registrado. O servidor está no sistema e apto a operar consignado, mas o contato pelo portal fica limitado — atenção ao validar dados.",
  },
  nao_cadastrado: {
    label: "Não cadastrado — sem margem consignável",
    tone: "destructive",
    Icon: ShieldAlert,
    hint:
      "CPF não encontrado na SafeConsig. Sem cadastro no portal, o servidor NÃO pode operar consignado em Alagoas — não há margem disponível por esta via.",
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

        {result && meta && Icon && (() => {
          const toneClasses =
            meta.tone === "success"
              ? {
                  alert:
                    "border-green-500/50 bg-green-50 text-green-900 dark:border-green-500/40 dark:bg-green-950/40 dark:text-green-100 [&>svg]:text-green-600 dark:[&>svg]:text-green-400",
                  badge: "font-mono text-xs border-green-600/40 text-green-800 dark:text-green-200",
                  box: "rounded-md border border-green-600/30 bg-green-100/60 p-3 text-sm whitespace-pre-wrap dark:bg-green-900/30",
                }
              : meta.tone === "warning"
              ? {
                  alert:
                    "border-amber-500/50 bg-amber-50 text-amber-900 dark:border-amber-500/40 dark:bg-amber-950/40 dark:text-amber-100 [&>svg]:text-amber-600 dark:[&>svg]:text-amber-400",
                  badge: "font-mono text-xs border-amber-600/40 text-amber-800 dark:text-amber-200",
                  box: "rounded-md border border-amber-600/30 bg-amber-100/60 p-3 text-sm whitespace-pre-wrap dark:bg-amber-900/30",
                }
              : {
                  alert: undefined,
                  badge: "font-mono text-xs",
                  box: "rounded-md border bg-muted/40 p-3 text-sm whitespace-pre-wrap",
                };
          return (
          <Alert
            variant={meta.tone === "destructive" ? "destructive" : "default"}
            className={toneClasses.alert}
          >
            <Icon className="h-4 w-4" />
            <AlertTitle className="flex items-center gap-2">
              {meta.label}
              <Badge variant="outline" className={toneClasses.badge}>
                {result.status}
              </Badge>
            </AlertTitle>
            <AlertDescription className="space-y-2">
              <p className="text-sm">{meta.hint}</p>
              <div className={toneClasses.box}>
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
          );
        })()}

        <p className="text-xs text-muted-foreground">
          Esta consulta utiliza o fluxo público "Esqueci Minha Senha" da SafeConsig. Caso a SafeConsig
          ative uma proteção de captcha mais estrita, esta verificação poderá deixar de funcionar.
        </p>
      </div>
    </AppShell>
  );
}
