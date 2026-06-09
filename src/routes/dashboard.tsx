import { createFileRoute, Navigate } from "@tanstack/react-router";
import { useCallback, useEffect, useState } from "react";
import { useAuth } from "@/lib/auth";
import { AppShell } from "@/components/AppShell";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Clock, CheckCircle2, AlertCircle, FileText, Loader2, Check, RefreshCw, Bug, ChevronDown, ChevronRight } from "lucide-react";
import { Progress } from "@/components/ui/progress";
import { toast } from "sonner";
import { formatCpf, isValidCpf, normalizeCpf } from "@/lib/cpf";
import { ProducaoRanking } from "@/components/rh/ProducaoRanking";

export const Route = createFileRoute("/dashboard")({
  head: () => ({
    meta: [
      { title: "Dashboard — Consulta de Margem" },
      { name: "description", content: "Painel com estatísticas, status das consultas e ferramenta de consulta individual de CPF." },
      { property: "og:title", content: "Dashboard — Consulta de Margem" },
      { property: "og:description", content: "Painel com estatísticas, status das consultas e ferramenta de consulta individual de CPF." },
      { property: "og:url", content: "https://consigna-spark.lovable.app/dashboard" },
      { name: "robots", content: "noindex,nofollow" },
    ],
    links: [{ rel: "canonical", href: "https://consigna-spark.lovable.app/dashboard" }],
  }),
  component: Page,
});

interface Stats { total: number; pendente: number; processando: number; concluido: number; erro: number; avg: number | null; }
interface Consulta {
  id: string; cpf: string; nome: string; status: string;
  margem_disponivel: number | null; erro: string | null;
  processed_at: string | null; updated_at: string;
  margem_emprestimo: number | null;
  margem_cartao_credito: number | null;
  margem_cartao_beneficio: number | null;
  servidor_nome: string | null;
  matricula: string | null;
  categoria: string | null;
  situacao: string | null;
  orgao: string | null;
}
const SELECT_COLS = "id, cpf, nome, status, margem_disponivel, margem_emprestimo, margem_cartao_credito, margem_cartao_beneficio, servidor_nome, matricula, categoria, situacao, orgao, erro, processed_at, updated_at";
interface DebugLog { id: number; level: string; message: string; created_at: string; }

function Page() {
  const { user, loading } = useAuth();
  const [stats, setStats] = useState<Stats | null>(null);
  const [consultas, setConsultas] = useState<Consulta[]>([]);
  const [selectedId, setSelectedId] = useState<string>("");
  const [manualCpf, setManualCpf] = useState<string>("");
  const [manualNome, setManualNome] = useState<string>("");
  const [debugRow, setDebugRow] = useState<Consulta | null>(null);
  const [debugLogs, setDebugLogs] = useState<DebugLog[]>([]);
  const [running, setRunning] = useState(false);
  const [showLogs, setShowLogs] = useState(false);
  const [isAdmin, setIsAdmin] = useState<boolean | null>(null);

  useEffect(() => {
    if (!user) { setIsAdmin(null); return; }
    let cancelled = false;
    (async () => {
      const { data } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", user.id)
        .eq("role", "admin")
        .maybeSingle();
      if (!cancelled) setIsAdmin(!!data);
    })();
    return () => { cancelled = true; };
  }, [user]);

  const loadDebugPanel = useCallback(async (consultaId: string) => {
    const [{ data: logs }, { data: row }] = await Promise.all([
      supabase
        .from("processar_logs")
        .select("id, level, message, created_at")
        .eq("consulta_id", consultaId)
        .order("id", { ascending: true }),
      supabase
        .from("consultas_margem")
        .select(SELECT_COLS)
        .eq("id", consultaId)
        .maybeSingle(),
    ]);
    if (logs) setDebugLogs(logs as DebugLog[]);
    if (row) setDebugRow(row as unknown as Consulta);
  }, []);

  // Realtime: logs do CPF em debug
  useEffect(() => {
    if (!debugRow?.id) return;
    let cancelled = false;
    (async () => {
      if (!cancelled) await loadDebugPanel(debugRow.id);
    })();
    const ch = supabase
      .channel(`logs-${debugRow.id}`)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "processar_logs", filter: `consulta_id=eq.${debugRow.id}` },
        (payload) => setDebugLogs((prev) => [...prev, payload.new as DebugLog]))
      .subscribe();
    const poll = window.setInterval(() => {
      if (!cancelled) void loadDebugPanel(debugRow.id);
    }, 1500);
    return () => { cancelled = true; window.clearInterval(poll); supabase.removeChannel(ch); };
  }, [debugRow?.id, loadDebugPanel]);

  const [totalDb, setTotalDb] = useState<number | null>(null);

  useEffect(() => {
    if (!user) return;
    const load = async () => {
      // Total real no banco (independente de paginação)
      const { count } = await supabase
        .from("consultas_margem")
        .select("id", { count: "exact", head: true });
      if (typeof count === "number") setTotalDb(count);

      // Pagina em blocos de 1000 para trazer TODOS os registros
      const PAGE = 1000;
      const all: any[] = [];
      let from = 0;
      for (let i = 0; i < 200; i++) {
        const { data, error } = await supabase
          .from("consultas_margem")
          .select(SELECT_COLS + ", created_at")
          .order("updated_at", { ascending: false })
          .range(from, from + PAGE - 1);
        if (error || !data) break;
        all.push(...data);
        if (data.length < PAGE) break;
        from += PAGE;
      }
      const data = all;
      if (!data.length && count == null) return setStats({ total: 0, pendente: 0, processando: 0, concluido: 0, erro: 0, avg: null });
      const s: Stats = { total: typeof count === "number" ? count : data.length, pendente: 0, processando: 0, concluido: 0, erro: 0, avg: null };
      const durations: number[] = [];
      data.forEach((r: any) => {
        const k = r.status as "pendente" | "processando" | "concluido" | "erro";
        s[k] = (s[k] as number) + 1;
        if (r.processed_at && r.created_at) durations.push((+new Date(r.processed_at) - +new Date(r.created_at)) / 1000);
      });
      s.avg = durations.length ? durations.reduce((a, b) => a + b, 0) / durations.length : null;
      setStats(s);
      setConsultas(data as unknown as Consulta[]);
      // Atualiza linha em debug se ela mudou
      setDebugRow((prev) => prev ? ((data as unknown as Consulta[]).find((d) => d.id === prev.id) ?? prev) : prev);
    };
    load();
    const ch = supabase
      .channel("dashboard-stats")
      .on("postgres_changes", { event: "*", schema: "public", table: "consultas_margem" }, load)
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [user]);

  const processarUm = async () => {
    if (!selectedId) { toast.error("Selecione um CPF"); return; }
    setRunning(true);
    const row = consultas.find((c) => c.id === selectedId) ?? null;
    setDebugRow(row);
    try {
      await supabase.from("processar_logs").delete().eq("consulta_id", selectedId);
      setDebugLogs([]);
      const { data: sess } = await supabase.auth.getSession();
      const token = sess.session?.access_token;
      const url = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/processar-margens`;
      const res = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`,
          "apikey": import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
        },
        body: JSON.stringify({ ids: [selectedId] }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json.error || `HTTP ${res.status}`);
      toast.success("Processamento iniciado", { description: "Acompanhe o status logo abaixo." });
    } catch (e: any) {
      toast.error("Falha ao processar", { description: e.message });
    } finally {
      setRunning(false);
    }
  };

  const processarManual = async () => {
    if (!user) return;
    const cpf = normalizeCpf(manualCpf);
    if (!isValidCpf(cpf)) { toast.error("CPF inválido"); return; }
    const nome = manualNome.trim() || "DEBUG MANUAL";
    setRunning(true);
    try {
      // Reusa registro existente do mesmo user/CPF, ou cria um novo
      const { data: existing } = await supabase
        .from("consultas_margem")
        .select(SELECT_COLS)
        .eq("user_id", user.id)
        .eq("cpf", cpf)
        .maybeSingle();

      let id = existing?.id as string | undefined;
      if (!id) {
        const { data: ins, error: insErr } = await supabase
          .from("consultas_margem")
          .insert({ user_id: user.id, cpf, nome, status: "pendente" })
          .select(SELECT_COLS)
          .single();
        if (insErr) throw insErr;
        id = ins.id;
        setDebugRow(ins as unknown as Consulta);
      } else {
        // Reseta para pendente para que a função pegue
        await supabase.from("consultas_margem")
          .update({ status: "pendente", erro: null, margem_disponivel: null })
          .eq("id", id);
        setDebugRow({ ...(existing as unknown as Consulta), status: "pendente", erro: null, margem_disponivel: null });
      }

      // Limpa logs anteriores deste CPF para acompanhar a execução nova
      await supabase.from("processar_logs").delete().eq("consulta_id", id);
      setDebugLogs([]);

      let id_str = id as string;
      const { data: sess } = await supabase.auth.getSession();
      const token = sess.session?.access_token;
      const url = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/processar-margens`;
      const res = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`,
          "apikey": import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
        },
        body: JSON.stringify({ ids: [id_str] }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json.error || `HTTP ${res.status}`);
      toast.success("Processamento iniciado", { description: formatCpf(cpf) });
    } catch (e: any) {
      toast.error("Falha ao processar", { description: e.message });
    } finally {
      setRunning(false);
    }
  };

  if (loading) return null;
  if (!user) return <Navigate to="/login" />;

  const cards = [
    { label: "Total", value: stats?.total ?? 0, icon: FileText, color: "text-primary bg-primary/10", valueColor: "" },
    { label: "Pendentes", value: stats?.pendente ?? 0, icon: Clock, color: "text-warning bg-warning/10", valueColor: "text-warning" },
    { label: "Processando", value: stats?.processando ?? 0, icon: Loader2, color: "text-primary bg-primary/10", valueColor: "text-primary" },
    { label: "Concluídas", value: stats?.concluido ?? 0, icon: CheckCircle2, color: "text-success bg-success/10", valueColor: "text-success" },
    { label: "Com erro", value: stats?.erro ?? 0, icon: AlertCircle, color: "text-destructive bg-destructive/10", valueColor: "text-destructive" },
  ];

  const formatDuration = (s: number | null | undefined) => {
    if (s == null || !Number.isFinite(s)) return "—";
    if (s < 60) return `${s.toFixed(1)}s`;
    const totalSec = Math.round(s);
    const d = Math.floor(totalSec / 86400);
    const h = Math.floor((totalSec % 86400) / 3600);
    const m = Math.floor((totalSec % 3600) / 60);
    const sec = totalSec % 60;
    const parts: string[] = [];
    if (d) parts.push(`${d}d`);
    if (h) parts.push(`${h}h`);
    if (m) parts.push(`${m}min`);
    if (!d && !h && sec) parts.push(`${sec}s`);
    return parts.join(" ") || `${totalSec}s`;
  };

  return (
    <AppShell>
      <div className="mb-6">
        <h1 className="text-2xl font-bold">Dashboard</h1>
        {isAdmin && (
          <p className="text-sm text-muted-foreground">
            Consulta de margem ·{" "}
            <strong>{consultas.length}</strong> carregados
            {totalDb != null && <> de <strong>{totalDb}</strong> consultados no total</>}
            {totalDb != null && consultas.length < totalDb && (
              <span className="ml-1 text-warning">(carregando…)</span>
            )}
          </p>
        )}
      </div>

      <div className="mb-6">
        <ProducaoRanking title="Ranking de Produção" limit={10} />
      </div>


      {isAdmin && (
        <>
          <div className="mb-3 mt-2">
            <h3 className="text-sm font-semibold text-muted-foreground">Visão geral</h3>
          </div>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
            {cards.map((c) => (
              <Card key={c.label} className="p-5">
                <div className={`mb-3 inline-flex h-10 w-10 items-center justify-center rounded-lg ${c.color}`}>
                  <c.icon className="h-5 w-5" />
                </div>
                <p className={`text-2xl font-bold ${c.valueColor}`}>{c.value}</p>
                <p className="text-sm text-muted-foreground">{c.label}</p>
              </Card>
            ))}
          </div>
          <Card className="mt-6 mb-8 p-6">
            <h3 className="text-sm font-medium text-muted-foreground">Tempo médio de processamento</h3>
            <p className="mt-1 text-3xl font-bold">
              {formatDuration(stats?.avg)}
            </p>
            <p className="text-xs text-muted-foreground">por registro concluído</p>
          </Card>
        </>
      )}

      {/* Consulta Alagoas — destaque premium */}
      <div className="card-premium mb-8 p-6 md:p-8">
        <div className="mb-5 flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/20 text-primary-glow ring-1 ring-primary/40">
            <Check className="h-5 w-5" />
          </div>
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.25em] text-primary">Grupo Positive</p>
            <h2 className="text-xl font-bold tracking-tight md:text-2xl">Consulta de Margem <span className="text-gradient">ARACAJU</span></h2>
          </div>
        </div>
        <div className="mt-6 border-t pt-4">
          <Label className="mb-2 block text-sm font-medium">Ou digite um CPF manualmente</Label>
          <p className="mb-3 text-xs text-muted-foreground">
            Cria/reutiliza o registro e dispara a Edge Function. Útil para testar um CPF avulso sem subir planilha.
          </p>
          <div className="flex flex-col gap-3 sm:flex-row">
            <Input
              placeholder="CPF (somente números ou com máscara)"
              value={manualCpf}
              maxLength={14}
              onChange={(e) => setManualCpf(e.target.value)}
              className="sm:max-w-[220px]"
            />
            
            <Button onClick={processarManual} disabled={running || !manualCpf} variant="secondary" className="text-white">
              {running ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Check className="mr-2 h-4 w-4" />}
              Consultar CPF manual
            </Button>
          </div>
        </div>

        {debugRow && (() => {
          const brl = (n: number | null) =>
            n == null ? "—" : Number(n).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
          const concluido = debugRow.status === "concluido";
          return (
            <div className="mt-6 rounded-lg border bg-muted/30 p-4 text-sm">
              <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                <div>
                  <span className="text-muted-foreground">CPF:</span>{" "}
                  <strong>{formatCpf(debugRow.cpf)}</strong>
                </div>
                <div>
                  <span className="text-muted-foreground">Status:</span>{" "}
                  <strong className={
                    concluido ? "text-success" :
                    debugRow.status === "erro" ? "text-destructive" :
                    debugRow.status === "processando" ? "text-primary" : ""
                  }>
                    {debugRow.status}
                  </strong>
                  {debugRow.status === "processando" && <Loader2 className="ml-2 inline h-3 w-3 animate-spin" />}
                </div>
              </div>

              {concluido && (() => {
                const COEF_EMP = 0.01862;
                const COEF_CARTAO = 17.15;
                const empValor = debugRow.margem_emprestimo != null ? Number(debugRow.margem_emprestimo) / COEF_EMP : null;
                const calcCartao = (m: number | null) => {
                  if (m == null) return null;
                  const total = Number(m) * COEF_CARTAO;
                  return { total, saque: total * 0.7, limite: total * 0.3 };
                };
                const cc = calcCartao(debugRow.margem_cartao_credito);
                const cb = calcCartao(debugRow.margem_cartao_beneficio);
                return (
                <div className="space-y-2 rounded border bg-background/60 p-4 leading-relaxed">
                  <div><span className="text-muted-foreground">Servidor</span> <strong>{debugRow.servidor_nome ?? "—"}</strong> <span className="text-muted-foreground ml-2">Matrícula</span><strong>{debugRow.matricula ?? "—"}</strong></div>
                  <div><span className="text-muted-foreground">Órgão</span><strong>{debugRow.orgao ?? "—"}</strong></div>
                  {(() => {
                    const cat = (debugRow.categoria ?? "").toString();
                    const sit = (debugRow.situacao ?? "").toString();
                    const blob = `${cat} ${sit}`.toLowerCase();
                    let vinculo: { label: string; cls: string } | null = null;
                    if (/comission|cargo\s*em\s*comiss|cc\b|c\.c\./.test(blob)) vinculo = { label: "Comissionado", cls: "bg-warning/15 text-warning border-warning/30" };
                    else if (/concurs|efetiv|estatut/.test(blob)) vinculo = { label: "Concursado", cls: "bg-success/15 text-success border-success/30" };
                    return (
                      <>
                        <div>
                          <span className="text-muted-foreground">Vínculo</span>{" "}
                          {vinculo ? (
                            <span className={`inline-block rounded border px-2 py-0.5 text-xs font-semibold ${vinculo.cls}`}>{vinculo.label}</span>
                          ) : (
                            <strong>—</strong>
                          )}
                          {cat && <span className="ml-2 text-xs text-muted-foreground">(categoria: {cat})</span>}
                        </div>
                        <div><span className="text-muted-foreground">Situação</span> <strong>{sit || "—"}</strong></div>
                      </>
                    );
                  })()}

                  <div className="pt-2">
                    <div><span className="text-muted-foreground">Margem Empréstimo</span> <strong>{brl(debugRow.margem_emprestimo)}</strong>
                      {empValor != null && <span className="ml-2 text-primary">→ Valor liberado aproximadamente <strong>{brl(empValor)}</strong> <span className="text-xs text-muted-foreground">(margem ÷ {COEF_EMP.toString().replace(".", ",")} · confirmar com o setor de Digitação)</span></span>}
                    </div>
                    <SimuladorMargem margemDisponivel={debugRow.margem_emprestimo} defaultCoef={COEF_EMP} />
                  </div>

                  <div className="pt-1">
                    <div><span className="text-muted-foreground">Margem Cartão Crédito</span> <strong>{brl(debugRow.margem_cartao_credito)}</strong>
                      {cc && <span className="ml-2 text-primary">× {COEF_CARTAO.toString().replace(".", ",")} = <strong>{brl(cc.total)}</strong></span>}
                    </div>
                    {cc && (
                      <div className="ml-4 text-xs text-muted-foreground">
                        Saque do cartão: <strong className="text-foreground">{brl(cc.saque)}</strong> · Limite do cartão: <strong className="text-foreground">{brl(cc.limite)}</strong>
                      </div>
                    )}
                  </div>

                  <div className="pt-1">
                    <div><span className="text-muted-foreground">Margem Cartão Benefício</span> <strong>{brl(debugRow.margem_cartao_beneficio)}</strong>
                      {cb && <span className="ml-2 text-primary">× {COEF_CARTAO.toString().replace(".", ",")} = <strong>{brl(cb.total)}</strong></span>}
                    </div>
                    {cb && (
                      <div className="ml-4 text-xs text-muted-foreground">
                        Saque do cartão: <strong className="text-foreground">{brl(cb.saque)}</strong> · Limite do cartão: <strong className="text-foreground">{brl(cb.limite)}</strong>
                      </div>
                    )}
                  </div>
                </div>
                );
              })()}

              <div className="mt-3 text-xs text-muted-foreground">
                Última atualização: {new Date(debugRow.updated_at).toLocaleString("pt-BR")}
              </div>

              {debugRow.erro && (
                <div className="mt-3 rounded border border-destructive/30 bg-destructive/10 p-2 text-destructive">
                  <strong>Erro / mensagem:</strong> {debugRow.erro}
                </div>
              )}
            </div>
          );
        })()}

        {debugRow && (() => {
          const TOTAL_STEPS = 24; // 8 órgãos x 3 serviços
          const isProcessing = debugRow.status === "processando" || debugRow.status === "pendente" || running;
          const isDone = debugRow.status === "concluido" || debugRow.status === "erro";
          const progress = isDone ? 100 : Math.min(99, Math.round((debugLogs.length / TOTAL_STEPS) * 100));
          return (
            <div className="mt-4 space-y-3">
              {(isProcessing || isDone) && (
                <div>
                  <div className="mb-1 flex items-center justify-between text-xs text-muted-foreground">
                    <span>
                      {debugRow.status === "concluido" ? "Consulta concluída" :
                       debugRow.status === "erro" ? "Consulta finalizada com erro" :
                       "Consultando órgãos e serviços…"}
                    </span>
                    <span>{progress}%</span>
                  </div>
                  <Progress value={progress} className="h-2" />
                </div>
              )}

              <div>
                <button
                  type="button"
                  onClick={() => setShowLogs((v) => !v)}
                  className="flex w-full items-center justify-between rounded border bg-muted/40 px-3 py-2 text-sm hover:bg-muted"
                >
                  <span className="flex items-center gap-2 font-medium">
                    {showLogs ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                    Logs em tempo real
                  </span>
                  <span className="text-xs text-muted-foreground">{debugLogs.length} entrada(s)</span>
                </button>
                {showLogs && (
                  <div className="mt-2 max-h-96 overflow-auto rounded-lg border bg-foreground/95 p-3 font-mono text-xs leading-relaxed text-background">
                    {debugLogs.length === 0 ? (
                      <p className="text-background/60">Aguardando logs… dispare a consulta para ver a execução em tempo real.</p>
                    ) : (
                      debugLogs.map((l) => (
                        <div key={l.id} className="flex gap-2">
                          <span className="text-background/50">{new Date(l.created_at).toLocaleTimeString("pt-BR")}</span>
                          <span className={
                            l.level === "error" ? "text-destructive" :
                            l.level === "warn" ? "text-warning" :
                            "text-background/90"
                          }>[{l.level}]</span>
                          <span className="whitespace-pre-wrap break-all">{l.message}</span>
                        </div>
                      ))
                    )}
                  </div>
                )}
              </div>
            </div>
          );
        })()}
      </div>

    </AppShell>
  );
}

function SimuladorMargem({ margemDisponivel, defaultCoef }: { margemDisponivel: number | null; defaultCoef: number }) {
  const [coef, setCoef] = useState<string>(defaultCoef.toString().replace(".", ","));
  const [modo, setModo] = useState<"valor" | "parcela">("valor");
  const [parcela, setParcela] = useState<string>(
    margemDisponivel != null ? Number(margemDisponivel).toFixed(2).replace(".", ",") : ""
  );
  const [valor, setValor] = useState<string>("");

  const parseNum = (s: string) => {
    const n = parseFloat(s.replace(/\./g, "").replace(",", "."));
    return isNaN(n) ? null : n;
  };
  const brl = (n: number | null) =>
    n == null ? "—" : Number(n).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

  const c = parseNum(coef);
  const p = parseNum(parcela);
  const v = parseNum(valor);
  const valorCalc = modo === "valor" && c && p ? p / c : null;
  const parcelaCalc = modo === "parcela" && c && v ? v * c : null;

  return (
    <div className="mt-3 rounded border bg-background/60 p-3">
      <div className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
        Simulador (margem principal)
      </div>
      <div className="grid gap-2 sm:grid-cols-3">
        <div>
          <Label className="text-xs">Coeficiente</Label>
          <Input value={coef} onChange={(e) => setCoef(e.target.value)} placeholder="0,01862" />
        </div>
        <div>
          <Label className="text-xs">Modo</Label>
          <Select value={modo} onValueChange={(val) => setModo(val as "valor" | "parcela")}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="valor">Calcular valor liberado aproximadamente</SelectItem>
              <SelectItem value="parcela">Calcular parcela</SelectItem>
            </SelectContent>
          </Select>
        </div>
        {modo === "valor" ? (
          <div>
            <Label className="text-xs">Parcela (R$)</Label>
            <Input value={parcela} onChange={(e) => setParcela(e.target.value)} placeholder="0,00" />
          </div>
        ) : (
          <div>
            <Label className="text-xs">Valor liberado aproximadamente (R$)</Label>
            <Input value={valor} onChange={(e) => setValor(e.target.value)} placeholder="0,00" />
          </div>
        )}
      </div>
      <div className="mt-3 text-sm">
        {modo === "valor" ? (
          <>Valor liberado aproximadamente: <strong className="text-primary">{brl(valorCalc)}</strong>
            <span className="ml-2 text-xs text-muted-foreground">(parcela ÷ coeficiente · confirmar com o setor de Digitação)</span></>
        ) : (
          <>Parcela estimada: <strong className="text-primary">{brl(parcelaCalc)}</strong>
            <span className="ml-2 text-xs text-muted-foreground">(valor × coeficiente)</span></>
        )}
      </div>
    </div>
  );
}
