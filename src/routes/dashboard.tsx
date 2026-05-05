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
import { Clock, CheckCircle2, AlertCircle, FileText, Loader2, Bug, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { formatCpf, isValidCpf, normalizeCpf } from "@/lib/cpf";

export const Route = createFileRoute("/dashboard")({ component: Page });

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

  useEffect(() => {
    if (!user) return;
    const load = async () => {
      const { data } = await supabase
        .from("consultas_margem")
        .select(SELECT_COLS + ", created_at")
        .order("updated_at", { ascending: false });
      if (!data) return setStats({ total: 0, pendente: 0, processando: 0, concluido: 0, erro: 0, avg: null });
      const s: Stats = { total: data.length, pendente: 0, processando: 0, concluido: 0, erro: 0, avg: null };
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
    { label: "Total", value: stats?.total ?? 0, icon: FileText, color: "text-primary bg-primary/10" },
    { label: "Pendentes", value: stats?.pendente ?? 0, icon: Clock, color: "text-warning bg-warning/10" },
    { label: "Processando", value: stats?.processando ?? 0, icon: Loader2, color: "text-primary bg-primary/10" },
    { label: "Concluídas", value: stats?.concluido ?? 0, icon: CheckCircle2, color: "text-success bg-success/10" },
    { label: "Com erro", value: stats?.erro ?? 0, icon: AlertCircle, color: "text-destructive bg-destructive/10" },
  ];

  return (
    <AppShell>
      <div className="mb-6">
        <h1 className="text-2xl font-bold">Dashboard</h1>
        <p className="text-sm text-muted-foreground">Consulta de margem — modo debug em destaque.</p>
      </div>

      {/* Modo debug — em destaque no topo */}
      <Card className="mb-8 border-primary/40 bg-primary/5 p-6 shadow-lg ring-1 ring-primary/20">
        <div className="mb-4 flex items-center gap-2">
          <Bug className="h-6 w-6 text-primary" />
          <h2 className="text-lg font-semibold">Consulta de margem (modo debug)</h2>
        </div>
        <p className="mb-4 text-sm text-muted-foreground">
          Selecione um CPF cadastrado e dispare apenas ele para a Edge Function. O status atualiza em tempo real abaixo. Para ver os logs detalhados (HTML retornado, dropdowns, postbacks), abra o painel de logs da função <code className="rounded bg-muted px-1">processar-margens</code> no backend.
        </p>
        <div className="flex flex-col gap-3 sm:flex-row">
          <Select value={selectedId} onValueChange={setSelectedId}>
            <SelectTrigger className="sm:max-w-md">
              <SelectValue placeholder="Selecione um CPF da lista" />
            </SelectTrigger>
            <SelectContent>
              {consultas.length === 0 && (
                <div className="px-3 py-2 text-sm text-muted-foreground">Nenhum CPF cadastrado</div>
              )}
              {consultas.slice(0, 50).map((c) => (
                <SelectItem key={c.id} value={c.id}>
                  {formatCpf(c.cpf)} — {c.nome} <span className="ml-2 text-xs text-muted-foreground">[{c.status}]</span>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button onClick={processarUm} disabled={running || !selectedId}>
            {running ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <RefreshCw className="mr-2 h-4 w-4" />}
            Processar este CPF
          </Button>
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
            <Input
              placeholder="Nome (opcional)"
              value={manualNome}
              maxLength={120}
              onChange={(e) => setManualNome(e.target.value)}
              className="sm:max-w-xs"
            />
            <Button onClick={processarManual} disabled={running || !manualCpf} variant="secondary">
              {running ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Bug className="mr-2 h-4 w-4" />}
              Processar CPF manual
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
                  <div><span className="text-muted-foreground">Situação</span> <strong>{debugRow.situacao ?? "—"}</strong></div>

                  <div className="pt-2">
                    <div><span className="text-muted-foreground">Margem Empréstimo</span> <strong>{brl(debugRow.margem_emprestimo)}</strong>
                      {empValor != null && <span className="ml-2 text-primary">→ Valor liberado <strong>{brl(empValor)}</strong> <span className="text-xs text-muted-foreground">(margem ÷ {COEF_EMP.toString().replace(".", ",")})</span></span>}
                    </div>
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

        {debugRow && (
          <div className="mt-4">
            <div className="mb-2 flex items-center justify-between">
              <h4 className="text-sm font-semibold">Logs em tempo real</h4>
              <span className="text-xs text-muted-foreground">{debugLogs.length} entrada(s)</span>
            </div>
            <div className="max-h-96 overflow-auto rounded-lg border bg-foreground/95 p-3 font-mono text-xs leading-relaxed text-background">
              {debugLogs.length === 0 ? (
                <p className="text-background/60">Aguardando logs… dispare o processamento para ver a execução em tempo real.</p>
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
          </div>
        )}
      </Card>

      <div className="mb-3 mt-2">
        <h3 className="text-sm font-semibold text-muted-foreground">Visão geral</h3>
      </div>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
        {cards.map((c) => (
          <Card key={c.label} className="p-5">
            <div className={`mb-3 inline-flex h-10 w-10 items-center justify-center rounded-lg ${c.color}`}>
              <c.icon className="h-5 w-5" />
            </div>
            <p className="text-2xl font-bold">{c.value}</p>
            <p className="text-sm text-muted-foreground">{c.label}</p>
          </Card>
        ))}
      </div>
      <Card className="mt-6 p-6">
        <h3 className="text-sm font-medium text-muted-foreground">Tempo médio de processamento</h3>
        <p className="mt-1 text-3xl font-bold">
          {stats?.avg ? `${stats.avg.toFixed(1)}s` : "—"}
        </p>
        <p className="text-xs text-muted-foreground">por registro concluído</p>
      </Card>
    </AppShell>
  );
}
