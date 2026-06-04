import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useMemo, useRef, useState } from "react";
import { AppShell } from "@/components/AppShell";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Progress } from "@/components/ui/progress";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  ShieldCheck,
  ShieldAlert,
  ShieldQuestion,
  Loader2,
  Search,
  ExternalLink,
  Copy,
  ListChecks,
  StopCircle,
  Download,
} from "lucide-react";
import { consultarSafeConsig } from "@/lib/safeconsig.functions";
import { formatCpf, normalizeCpf } from "@/lib/cpf";
import { toast } from "sonner";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/integrations/supabase/client";
import { useEffect } from "react";

const SAFECONSIG_URL = "https://alagoas.safeconsig.com.br/safe/login";
const BATCH_DELAY_MS = 2500;

function padCpf(raw: string): string {
  const digits = normalizeCpf(raw);
  if (digits.length === 0 || digits.length > 11) return digits;
  return digits.padStart(11, "0");
}

function sleep(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    const t = setTimeout(resolve, ms);
    signal?.addEventListener("abort", () => {
      clearTimeout(t);
      reject(new DOMException("Aborted", "AbortError"));
    });
  });
}

export const Route = createFileRoute("/safe-consig")({
  head: () => ({
    meta: [
      { title: "Verificar cadastro SafeConsig — Grupo Positive" },
      {
        name: "description",
        content:
          "Consulta o cadastro de um servidor no portal SafeConsig (ARACAJU) a partir do CPF.",
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
    label: "O SERVIDOR JÁ POSSUI ACESSO À SAFE",
    tone: "warning",
    Icon: ShieldAlert,
    hint:
      "O servidor já possui acesso criado na SafeConsig (e-mail cadastrado) e o portal disparou o e-mail de recuperação. Para o fluxo de margem, oriente o servidor a recuperar a senha pelo WhatsApp 0800 000 1528 em vez de usar o e-mail.",
  },
  sem_email: {
    label: "Apto — alta chance de margem",
    tone: "success",
    Icon: ShieldCheck,
    hint:
      "O CPF está cadastrado na SafeConsig porém SEM e-mail registrado. Esse perfil costuma indicar servidor que ainda não operou pelo portal — ALTA probabilidade de margem consignável disponível. Lead positivo, vale o contato.",
  },
  nao_cadastrado: {
    label: "Não cadastrado — sem margem consignável",
    tone: "destructive",
    Icon: ShieldAlert,
    hint:
      "CPF não encontrado na SafeConsig. Sem cadastro no portal, o servidor NÃO pode operar consignado em ARACAJU — não há margem disponível por esta via.",
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

function toneBadgeClass(tone: (typeof STATUS_META)[Result["status"]]["tone"]): string {
  switch (tone) {
    case "success":
      return "bg-green-600 text-white hover:bg-green-600 border-transparent";
    case "warning":
      return "bg-amber-500 text-white hover:bg-amber-500 border-transparent";
    case "destructive":
      return "bg-destructive text-destructive-foreground hover:bg-destructive border-transparent";
    case "secondary":
      return "bg-secondary text-secondary-foreground border-transparent";
    default:
      return "bg-muted text-foreground border-transparent";
  }
}

type BatchRow = {
  n: number;
  cpf: string;
  raw: string;
  status: Result["status"] | "pendente" | "processando";
  message: string;
};

function parseCpfList(input: string): { raw: string; cpf: string }[] {
  const tokens = input
    .split(/[\s,;\n\r\t]+/)
    .map((t) => t.trim())
    .filter(Boolean);
  const seen = new Set<string>();
  const out: { raw: string; cpf: string }[] = [];
  for (const raw of tokens) {
    const cpf = padCpf(raw);
    if (cpf.length !== 11) continue;
    if (seen.has(cpf)) continue;
    seen.add(cpf);
    out.push({ raw, cpf });
  }
  return out;
}

function SafeConsigPage() {
  const consultar = useServerFn(consultarSafeConsig);
  const { user } = useAuth();
  const [isAdmin, setIsAdmin] = useState(false);
  useEffect(() => {
    if (!user) { setIsAdmin(false); return; }
    supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id)
      .eq("role", "admin")
      .maybeSingle()
      .then(({ data }) => setIsAdmin(!!data));
  }, [user]);
  const [cpf, setCpf] = useState("");
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<Result | null>(null);

  const handleChange = (v: string) => {
    const digits = normalizeCpf(v).slice(0, 11);
    setCpf(digits.length === 11 ? formatCpf(digits) : digits);
  };

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const padded = padCpf(cpf);
    if (padded.length !== 11) {
      toast.error("Informe até 11 dígitos numéricos");
      return;
    }
    setBusy(true);
    setResult(null);
    try {
      const r = await consultar({ data: { cpf: padded } });
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

  // ---------- Batch ----------
  const [batchInput, setBatchInput] = useState("");
  const [batchRows, setBatchRows] = useState<BatchRow[]>([]);
  const [batchRunning, setBatchRunning] = useState(false);
  const [batchIndex, setBatchIndex] = useState(0);
  const abortRef = useRef<AbortController | null>(null);

  const parsedPreview = useMemo(() => parseCpfList(batchInput), [batchInput]);

  const runBatch = async () => {
    const list = parseCpfList(batchInput);
    if (list.length === 0) {
      toast.error("Cole ao menos um CPF válido");
      return;
    }
    const initial: BatchRow[] = list.map((it, i) => ({
      n: i + 1,
      cpf: it.cpf,
      raw: it.raw,
      status: "pendente",
      message: "",
    }));
    setBatchRows(initial);
    setBatchIndex(0);
    setBatchRunning(true);
    const ctrl = new AbortController();
    abortRef.current = ctrl;
    try {
      for (let i = 0; i < list.length; i++) {
        if (ctrl.signal.aborted) break;
        setBatchIndex(i + 1);
        setBatchRows((prev) =>
          prev.map((r, idx) => (idx === i ? { ...r, status: "processando" } : r))
        );
        try {
          const r = await consultar({ data: { cpf: list[i].cpf } });
          setBatchRows((prev) =>
            prev.map((row, idx) =>
              idx === i ? { ...row, status: r.status, message: r.message } : row
            )
          );
        } catch (err) {
          setBatchRows((prev) =>
            prev.map((row, idx) =>
              idx === i
                ? {
                    ...row,
                    status: "erro",
                    message: err instanceof Error ? err.message : "Erro inesperado.",
                  }
                : row
            )
          );
        }
        if (i < list.length - 1 && !ctrl.signal.aborted) {
          try {
            await sleep(BATCH_DELAY_MS, ctrl.signal);
          } catch {
            break;
          }
        }
      }
    } finally {
      setBatchRunning(false);
      abortRef.current = null;
    }
  };

  const stopBatch = () => {
    abortRef.current?.abort();
    setBatchRunning(false);
    setBatchRows((prev) =>
      prev.map((r) =>
        r.status === "pendente" || r.status === "processando"
          ? { ...r, status: "erro", message: r.message || "Cancelado pelo usuário." }
          : r
      )
    );
  };

  const summary = useMemo(() => {
    const s = { aptos: 0, comAcesso: 0, naoCadastrado: 0, erros: 0, outros: 0 };
    for (const r of batchRows) {
      if (r.status === "sem_email") s.aptos++;
      else if (r.status === "enviado") s.comAcesso++;
      else if (r.status === "nao_cadastrado") s.naoCadastrado++;
      else if (r.status === "erro") s.erros++;
      else if (r.status === "desconhecido") s.outros++;
    }
    return s;
  }, [batchRows]);

  const exportCsv = () => {
    if (batchRows.length === 0) return;
    const esc = (v: string) => `"${v.replace(/"/g, '""').replace(/\r?\n/g, " ")}"`;
    const header = ["n", "cpf", "status", "mensagem"].join(",");
    const lines = batchRows.map((r) =>
      [r.n, esc(formatCpf(r.cpf)), esc(r.status), esc(r.message || "")].join(",")
    );
    const csv = [header, ...lines].join("\n");
    const blob = new Blob([`\uFEFF${csv}`], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `safeconsig-lote-${new Date().toISOString().slice(0, 19).replace(/[:T]/g, "-")}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const batchTotal = batchRows.length;
  const progressPct = batchTotal > 0 ? Math.round((batchIndex / batchTotal) * 100) : 0;

  return (
    <AppShell>
      <div className="mx-auto max-w-4xl space-y-6">
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
            </div>

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

{isAdmin && (
        <Card className="p-6 space-y-4">
          <div className="flex items-start justify-between gap-3 flex-wrap">
            <div>
              <h2 className="text-lg font-semibold flex items-center gap-2">
                <ListChecks className="h-5 w-5" />
                Consulta em lote
              </h2>
              <p className="text-sm text-muted-foreground">
                Cole uma lista de CPFs (um por linha, ou separados por vírgula/espaço). CPFs com menos
                de 11 dígitos são preenchidos com zeros à esquerda automaticamente.
              </p>
            </div>
            {batchTotal > 0 && (
              <Button variant="outline" size="sm" className="gap-2" onClick={exportCsv}>
                <Download className="h-4 w-4" />
                Exportar CSV
              </Button>
            )}
          </div>

          <Textarea
            value={batchInput}
            onChange={(e) => setBatchInput(e.target.value)}
            placeholder={"04807727460\n12345678901, 98765432100\n..."}
            rows={6}
            className="font-mono text-sm"
            disabled={batchRunning}
          />
          <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
            <span>{parsedPreview.length} CPF(s) válidos detectados</span>
            {batchRunning && (
              <span>
                · Processando {batchIndex}/{batchTotal}
              </span>
            )}
          </div>

          <div className="flex flex-wrap gap-2">
            <Button onClick={runBatch} disabled={batchRunning || parsedPreview.length === 0} className="gap-2">
              {batchRunning ? <Loader2 className="h-4 w-4 animate-spin" /> : <ListChecks className="h-4 w-4" />}
              {batchRunning ? "Consultando…" : "Consultar todos"}
            </Button>
            {batchRunning && (
              <Button variant="destructive" onClick={stopBatch} className="gap-2">
                <StopCircle className="h-4 w-4" />
                Parar
              </Button>
            )}
          </div>

          {batchTotal > 0 && (
            <>
              <Progress value={progressPct} className="h-2" />

              <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 text-xs">
                <div className="rounded-md border border-green-600/30 bg-green-50 dark:bg-green-950/30 p-2">
                  <div className="font-semibold text-green-800 dark:text-green-200">Aptos</div>
                  <div className="text-lg font-bold text-green-700 dark:text-green-300">{summary.aptos}</div>
                </div>
                <div className="rounded-md border border-amber-600/30 bg-amber-50 dark:bg-amber-950/30 p-2">
                  <div className="font-semibold text-amber-800 dark:text-amber-200">Com acesso</div>
                  <div className="text-lg font-bold text-amber-700 dark:text-amber-300">{summary.comAcesso}</div>
                </div>
                <div className="rounded-md border border-destructive/40 bg-destructive/10 p-2">
                  <div className="font-semibold text-destructive">Não cadastrados</div>
                  <div className="text-lg font-bold text-destructive">{summary.naoCadastrado}</div>
                </div>
                <div className="rounded-md border bg-muted/40 p-2">
                  <div className="font-semibold">Outros</div>
                  <div className="text-lg font-bold">{summary.outros}</div>
                </div>
                <div className="rounded-md border bg-muted/40 p-2">
                  <div className="font-semibold">Erros</div>
                  <div className="text-lg font-bold">{summary.erros}</div>
                </div>
              </div>

              <div className="rounded-md border overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-12">#</TableHead>
                      <TableHead className="w-40">CPF</TableHead>
                      <TableHead className="w-44">Status</TableHead>
                      <TableHead>Mensagem</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {batchRows.map((row) => {
                      const knownMeta =
                        row.status === "pendente" || row.status === "processando"
                          ? null
                          : STATUS_META[row.status];
                      const badgeClass =
                        row.status === "pendente"
                          ? "bg-muted text-muted-foreground border-transparent"
                          : row.status === "processando"
                          ? "bg-blue-500 text-white border-transparent"
                          : knownMeta
                          ? toneBadgeClass(knownMeta.tone)
                          : "bg-muted text-foreground border-transparent";
                      const label =
                        row.status === "pendente"
                          ? "Pendente"
                          : row.status === "processando"
                          ? "Processando…"
                          : knownMeta?.label ?? row.status;
                      return (
                        <TableRow key={`${row.n}-${row.cpf}`}>
                          <TableCell className="text-muted-foreground">{row.n}</TableCell>
                          <TableCell className="font-mono">{formatCpf(row.cpf)}</TableCell>
                          <TableCell>
                            <Badge className={badgeClass}>{label}</Badge>
                          </TableCell>
                          <TableCell className="text-sm whitespace-pre-wrap">
                            {row.status === "processando" ? (
                              <span className="inline-flex items-center gap-1 text-muted-foreground">
                                <Loader2 className="h-3 w-3 animate-spin" /> aguarde
                              </span>
                            ) : (
                              row.message || <span className="text-muted-foreground">—</span>
                            )}
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            </>
          )}
        </Card>
        )}


        <p className="text-xs text-muted-foreground">
          Esta consulta utiliza o fluxo público "Esqueci Minha Senha" da SafeConsig. Caso a SafeConsig
          ative uma proteção de captcha mais estrita, esta verificação poderá deixar de funcionar.
        </p>
      </div>
    </AppShell>
  );
}
