import { createFileRoute, Navigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useAuth } from "@/lib/auth";
import { AppShell } from "@/components/AppShell";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { toast } from "sonner";
import { Play, Download, RefreshCw, Loader2, FileSpreadsheet, Pause, Square, FileSearch, PlayCircle, AlertTriangle } from "lucide-react";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { ChevronDown } from "lucide-react";
import { Progress } from "@/components/ui/progress";
import * as XLSX from "xlsx";
import { formatCpf } from "@/lib/cpf";

export const Route = createFileRoute("/consultas")({
  head: () => ({
    meta: [
      { title: "Consultas — Margem Consignável" },
      { name: "description", content: "Lista, filtros, processamento em lote e exportação de consultas de margem consignável." },
      { property: "og:title", content: "Consultas — Margem Consignável" },
      { property: "og:description", content: "Lista, filtros, processamento em lote e exportação de consultas de margem consignável." },
      { property: "og:url", content: "https://consigna-spark.lovable.app/consultas" },
      { name: "robots", content: "noindex,nofollow" },
    ],
    links: [{ rel: "canonical", href: "https://consigna-spark.lovable.app/consultas" }],
  }),
  component: Page,
});

interface Run {
  id: string; status: string; total: number; processed: number; errors: number;
  started_at: string; finished_at: string | null;
  created_at: string; updated_at: string;
}

const formatDuration = (ms: number) => {
  const s = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  if (h > 0) return `${h}h ${m}m ${sec}s`;
  if (m > 0) return `${m}m ${sec}s`;
  return `${sec}s`;
};

type Status = "pendente" | "processando" | "concluido" | "erro";
interface Consulta {
  id: string; cpf: string; nome: string; status: Status;
  margem_disponivel: number | null; erro: string | null;
  erro_tipo: string | null;
  tentativas: number;
  created_at: string; processed_at: string | null;
  updated_at: string;
  margem_emprestimo: number | null;
  margem_cartao_credito: number | null;
  margem_cartao_beneficio: number | null;
  servidor_nome: string | null;
  matricula: string | null;
  categoria: string | null;
  situacao: string | null;
  orgao: string | null;
}

const ERRO_TIPO_LABELS: Record<string, string> = {
  sem_link_margem: "Sem link de margem",
  popup_alerta: "Popup de alerta",
  sem_resultado: "Sem resultado",
  margem_nao_localizada: "Margem não localizada",
  falha_trocar_orgao: "Falha ao trocar órgão",
  excecao_consulta: "Exceção na consulta",
  sessao_expirada: "Sessão expirada",
  sessao_concorrente: "Conta em uso em outro acesso",
  login_falhou: "Falha de login",
  credenciais_ausentes: "Credenciais ausentes",
  sem_orgaos: "Nenhum órgão",
  outro: "Outro",
};
const erroTipoLabel = (t: string | null) => (t ? (ERRO_TIPO_LABELS[t] ?? t) : "—");

// Limpa mensagens de erro técnicas (ex.: "Margem não localizada em nenhum órgão. 10=s1=popup_alerta|...")
// removendo o detalhamento por órgão/slot e mantendo só o resumo legível.
const formatErroMsg = (raw: string | null | undefined): string => {
  if (!raw) return "";
  let msg = String(raw).trim();
  // Remove blocos do tipo " 10=s1=popup_alerta|s2=...|s3=... | 05=..."
  msg = msg.replace(/\s*\d{2}\s*=\s*s\d+\s*=[^|]+(\s*\|\s*s\d+\s*=[^|]+)*(\s*\|\s*\d{2}\s*=[^|]+(\s*\|\s*s\d+\s*=[^|]+)*)*/gi, "");
  // Remove sufixos residuais "s1=...|s2=..."
  msg = msg.replace(/\s*s\d+\s*=[^|]+(\s*\|\s*s\d+\s*=[^|]+)*/gi, "");
  msg = msg.replace(/\s*\|\s*/g, " ").replace(/\s{2,}/g, " ").trim();
  msg = msg.replace(/[.\s]+$/g, "").trim();
  return msg || String(raw).trim();
};

const brl = (n: number | null | undefined) =>
  n == null ? "—" : Number(n).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

const PAGE_SIZE = 25;

const statusBadge = (s: Status) => {
  const map: Record<Status, { label: string; cls: string }> = {
    pendente: { label: "Pendente", cls: "bg-warning/15 text-warning-foreground border-warning/30" },
    processando: { label: "Processando", cls: "bg-primary/15 text-primary border-primary/30" },
    concluido: { label: "Concluído", cls: "bg-success/15 text-success border-success/30" },
    erro: { label: "Erro", cls: "bg-destructive/15 text-destructive border-destructive/30" },
  };
  return <Badge variant="outline" className={map[s].cls}>{map[s].label}</Badge>;
};

function Page() {
  const { user, loading } = useAuth();
  const [items, setItems] = useState<Consulta[]>([]);
  const [statusFilter, setStatusFilter] = useState<"all" | Status>("all");
  const [erroTipoFilter, setErroTipoFilter] = useState<string>("all");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [processing, setProcessing] = useState(false);
  const [parallel, setParallel] = useState(true);
  const [maxAttempts, setMaxAttempts] = useState(3);
  const [run, setRun] = useState<Run | null>(null);
  const [detalheConsulta, setDetalheConsulta] = useState<Consulta | null>(null);

  useEffect(() => {
    if (!user) return;
    const loadRun = async () => {
      const { data } = await supabase
        .from("processar_runs")
        .select("*")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      setRun((data as Run | null) ?? null);
    };
    loadRun();
    const ch = supabase
      .channel("runs-list")
      .on("postgres_changes", { event: "*", schema: "public", table: "processar_runs" }, loadRun)
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [user]);

  const updateRunStatus = async (status: "running" | "paused" | "stopped") => {
    if (!run) return;
    const { error } = await supabase.from("processar_runs").update({ status }).eq("id", run.id);
    if (error) toast.error(error.message);
    else toast.success(status === "paused" ? "Pausado" : status === "stopped" ? "Parado" : "Retomado");
  };

  // Tick para reavaliar se o run está travado (sem updates há > 90s)
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 10_000);
    return () => clearInterval(t);
  }, []);

  const resumeRun = async () => {
    if (!run) return;
    setProcessing(true);
    try {
      // Reativa o run e libera linhas que ficaram em "processando"
      await supabase.from("processar_runs")
        .update({ status: "running", finished_at: null, updated_at: new Date().toISOString() })
        .eq("id", run.id);
      await supabase.from("consultas_margem")
        .update({ status: "pendente" })
        .eq("user_id", user!.id)
        .eq("status", "processando");

      const { data, error } = await supabase.functions.invoke("processar-margens", {
        body: { runId: run.id, continueRun: true, parallel, maxAttempts },
      });
      if (error) toast.error(error.message);
      else if (data?.alreadyRunning) toast.info("Já existe um processamento em andamento");
      else toast.success("Processamento retomado a partir do checkpoint");
    } finally {
      setProcessing(false);
    }
  };

  const [totalDb, setTotalDb] = useState<number | null>(null);

  const reloadItems = async (): Promise<Consulta[]> => {
    // Conta total real no banco (independente de paginação)
    const { count } = await supabase
      .from("consultas_margem")
      .select("id", { count: "exact", head: true });
    if (typeof count === "number") setTotalDb(count);

    // Pagina em blocos de 1000 para trazer TODOS os registros do usuário,
    // independente do dia da consulta. Sem isso, o Supabase corta em 1000
    // e exportações/listagem perdem os mais antigos.
    const PAGE = 1000;
    const all: Consulta[] = [];
    let from = 0;
    for (let i = 0; i < 200; i++) {
      const { data, error } = await supabase
        .from("consultas_margem")
        .select("*")
        .order("updated_at", { ascending: false })
        .range(from, from + PAGE - 1);
      if (error) {
        toast.error(error.message);
        return all;
      }
      const chunk = (data ?? []) as Consulta[];
      all.push(...chunk);
      if (chunk.length < PAGE) break;
      from += PAGE;
    }
    setItems(all);
    return all;
  };

  useEffect(() => {
    if (!user) return;
    reloadItems();
    const ch = supabase
      .channel("consultas-list")
      .on("postgres_changes", { event: "*", schema: "public", table: "consultas_margem" }, () => { reloadItems(); })
      .subscribe();
    return () => { supabase.removeChannel(ch); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  const [refreshingExport, setRefreshingExport] = useState(false);
  const exportWithRefresh = async (kind: "xlsx-done" | "xlsx-all" | "csv-done" | "csv-all") => {
    setRefreshingExport(true);
    try {
      const fresh = await reloadItems();
      if (!fresh.length) {
        toast.info("Nada para exportar");
        return;
      }
      const onlyDone = kind === "xlsx-done" || kind === "csv-done";
      if (kind.startsWith("xlsx")) exportXlsxFrom(fresh, onlyDone);
      else exportCsvFrom(fresh, onlyDone);
      toast.success("Lista atualizada e exportação gerada");
    } finally {
      setRefreshingExport(false);
    }
  };

  const erroTipoCounts = useMemo(() => {
    const m = new Map<string, number>();
    for (const i of items) {
      if (i.status !== "erro") continue;
      const k = i.erro_tipo ?? "outro";
      m.set(k, (m.get(k) ?? 0) + 1);
    }
    return Array.from(m.entries()).sort((a, b) => b[1] - a[1]);
  }, [items]);

  const filtered = useMemo(() => {
    let f = items;
    if (statusFilter !== "all") f = f.filter((i) => i.status === statusFilter);
    if (erroTipoFilter !== "all") {
      f = f.filter((i) => i.status === "erro" && (i.erro_tipo ?? "outro") === erroTipoFilter);
    }
    if (search.trim()) {
      const q = search.toLowerCase();
      f = f.filter((i) => i.cpf.includes(q.replace(/\D/g, "")) || i.nome.toLowerCase().includes(q));
    }
    return f;
  }, [items, statusFilter, erroTipoFilter, search]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const pageItems = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
  useEffect(() => { if (page > totalPages) setPage(1); }, [page, totalPages]);

  const toggle = (id: string) => {
    setSelected((prev) => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; });
  };
  const toggleAll = () => {
    if (pageItems.every((i) => selected.has(i.id))) {
      setSelected((prev) => { const n = new Set(prev); pageItems.forEach((i) => n.delete(i.id)); return n; });
    } else {
      setSelected((prev) => { const n = new Set(prev); pageItems.forEach((i) => n.add(i.id)); return n; });
    }
  };

  const callProcessar = async (opts?: { ids?: string[]; erroTipo?: string }) => {
    setProcessing(true);
    const body: Record<string, unknown> = { parallel, maxAttempts };
    if (opts?.ids) body.ids = opts.ids;
    if (opts?.erroTipo) body.erroTipo = opts.erroTipo;
    const { data, error } = await supabase.functions.invoke("processar-margens", { body });
    setProcessing(false);
    if (error) toast.error(error.message);
    else if (data?.alreadyRunning) toast.info("Já existe um processamento em andamento");
    else toast.success(parallel ? "Processamento iniciado (2 contas em paralelo)" : "Processamento iniciado");
  };

  // Coeficientes de simulação (mesmos do /dashboard). Confirmar com o setor de Digitação.
  const COEF_EMP = 0.01862;
  const COEF_CARTAO = 17.15;
  const calcEmp = (m: number | null | undefined) =>
    m == null ? null : Number(m) / COEF_EMP;
  const calcCartao = (m: number | null | undefined) => {
    if (m == null) return null;
    const total = Number(m) * COEF_CARTAO;
    return { total, saque: total * 0.7, limite: total * 0.3 };
  };

  const exportCsvFrom = (source: Consulta[], onlyDone: boolean) => {
    const data = onlyDone ? source.filter((i) => i.status === "concluido") : source;
    if (!data.length) return toast.info("Nada para exportar");
    const header = [
      "cpf", "nome", "status", "servidor_nome", "matricula", "categoria", "situacao", "orgao",
      "margem_emprestimo", "valor_liberado_emprestimo",
      "margem_cartao_credito", "valor_liberado_cc", "saque_cc", "limite_cc",
      "margem_cartao_beneficio", "valor_liberado_cb", "saque_cb", "limite_cb",
      "margem_disponivel", "total_liberado_aprox",
      "erro", "processed_at",
    ];
    const csv = [header.join(",")].concat(
      data.map((r) => {
        const emp = calcEmp(r.margem_emprestimo);
        const cc = calcCartao(r.margem_cartao_credito);
        const cb = calcCartao(r.margem_cartao_beneficio);
        const totalLib = (emp ?? 0) + (cc?.total ?? 0) + (cb?.total ?? 0);
        const extras: Record<string, unknown> = {
          valor_liberado_emprestimo: emp ?? "",
          valor_liberado_cc: cc?.total ?? "",
          saque_cc: cc?.saque ?? "",
          limite_cc: cc?.limite ?? "",
          valor_liberado_cb: cb?.total ?? "",
          saque_cb: cb?.saque ?? "",
          limite_cb: cb?.limite ?? "",
          total_liberado_aprox: totalLib || "",
        };
        return header.map((h) => {
          const v = h in extras ? extras[h] : (r as unknown as Record<string, unknown>)[h];
          const s = v == null ? "" : String(v).replace(/"/g, '""');
          return `"${s}"`;
        }).join(",");
      })
    ).join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = `consultas-${Date.now()}.csv`; a.click();
    URL.revokeObjectURL(url);
  };
  const exportCsv = (onlyDone: boolean) => exportCsvFrom(items, onlyDone);

  const exportXlsxFrom = (source: Consulta[], onlyDone: boolean) => {
    const data = onlyDone ? source.filter((i) => i.status === "concluido") : source;
    if (!data.length) return toast.info("Nada para exportar");
    const rows: Record<string, string | number>[] = data.map((r) => {
      const emp = calcEmp(r.margem_emprestimo);
      const cc = calcCartao(r.margem_cartao_credito);
      const cb = calcCartao(r.margem_cartao_beneficio);
      const totalLib = (emp ?? 0) + (cc?.total ?? 0) + (cb?.total ?? 0);
      return {
        "CPF": formatCpf(r.cpf),
        "Nome (planilha)": r.nome,
        "Servidor": r.servidor_nome ?? "",
        "Matrícula": r.matricula ?? "",
        "Órgão": r.orgao ?? "",
        "Categoria": r.categoria ?? "",
        "Situação": r.situacao ?? "",
        "Status": r.status,
        "Margem Empréstimo": r.margem_emprestimo ?? "",
        "Valor Liberado Empréstimo (≈)": emp ?? "",
        "Margem Cartão Crédito": r.margem_cartao_credito ?? "",
        "Valor Liberado CC (≈)": cc?.total ?? "",
        "Saque CC (≈)": cc?.saque ?? "",
        "Limite CC (≈)": cc?.limite ?? "",
        "Margem Cartão Benefício": r.margem_cartao_beneficio ?? "",
        "Valor Liberado CB (≈)": cb?.total ?? "",
        "Saque CB (≈)": cb?.saque ?? "",
        "Limite CB (≈)": cb?.limite ?? "",
        "Margem Total Disponível": r.margem_disponivel ?? "",
        "Total Liberado (≈)": totalLib || "",
        "Erro": r.erro ?? "",
        "Processado em": r.processed_at ? new Date(r.processed_at).toLocaleString("pt-BR") : "",
      };
    });
    const totalEmp = data.reduce((a, r) => a + (Number(r.margem_emprestimo) || 0), 0);
    const totalCC = data.reduce((a, r) => a + (Number(r.margem_cartao_credito) || 0), 0);
    const totalCB = data.reduce((a, r) => a + (Number(r.margem_cartao_beneficio) || 0), 0);
    const totalDisp = data.reduce((a, r) => a + (Number(r.margem_disponivel) || 0), 0);
    const totalLibEmp = totalEmp / COEF_EMP;
    const totalLibCC = totalCC * COEF_CARTAO;
    const totalLibCB = totalCB * COEF_CARTAO;
    rows.push({
      "CPF": "", "Nome (planilha)": "TOTAIS", "Servidor": "", "Matrícula": "",
      "Órgão": "", "Categoria": "", "Situação": "", "Status": "",
      "Margem Empréstimo": totalEmp,
      "Valor Liberado Empréstimo (≈)": totalLibEmp,
      "Margem Cartão Crédito": totalCC,
      "Valor Liberado CC (≈)": totalLibCC,
      "Saque CC (≈)": totalLibCC * 0.7,
      "Limite CC (≈)": totalLibCC * 0.3,
      "Margem Cartão Benefício": totalCB,
      "Valor Liberado CB (≈)": totalLibCB,
      "Saque CB (≈)": totalLibCB * 0.7,
      "Limite CB (≈)": totalLibCB * 0.3,
      "Margem Total Disponível": totalDisp,
      "Total Liberado (≈)": totalLibEmp + totalLibCC + totalLibCB,
      "Erro": "", "Processado em": "",
    });
    const ws = XLSX.utils.json_to_sheet(rows);
    ws["!cols"] = [
      { wch: 14 }, { wch: 28 }, { wch: 28 }, { wch: 14 }, { wch: 28 },
      { wch: 14 }, { wch: 14 }, { wch: 12 },
      { wch: 18 }, { wch: 24 },
      { wch: 20 }, { wch: 20 }, { wch: 16 }, { wch: 16 },
      { wch: 22 }, { wch: 22 }, { wch: 16 }, { wch: 16 },
      { wch: 22 }, { wch: 20 },
      { wch: 30 }, { wch: 20 },
    ];
    const range = XLSX.utils.decode_range(ws["!ref"] as string);
    // Colunas monetárias (índices 0-based correspondentes às colunas acima)
    const moneyCols = [8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19];
    for (let R = 1; R <= range.e.r; R++) {
      for (const C of moneyCols) {
        const addr = XLSX.utils.encode_cell({ r: R, c: C });
        const cell = ws[addr];
        if (cell && typeof cell.v === "number") cell.z = '"R$" #,##0.00';
      }
    }
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Consultas");
    XLSX.writeFile(wb, `consultas-${Date.now()}.xlsx`);
  };
  const exportXlsx = (onlyDone: boolean) => exportXlsxFrom(items, onlyDone);

  if (loading) return null;
  if (!user) return <Navigate to="/login" />;

  const selectedErrIds = items.filter((i) => selected.has(i.id) && i.status === "erro").map((i) => i.id);
  const isRunActive = !!run && (run.status === "running" || run.status === "paused");
  const pendentesCount = items.filter((i) => i.status === "pendente" || i.status === "processando").length;
  // Run "travado": estava rodando/pausado mas sem updates há mais de 90s
  const runStaleMs = run && isRunActive ? now - new Date(run.updated_at).getTime() : 0;
  const isRunStuck = isRunActive && runStaleMs > 90_000;
  // Run interrompido (parado/travado) com pendentes para retomar
  const canResume = !!run && pendentesCount > 0 && (
    isRunStuck || (run.status === "stopped") || (!!run.finished_at && run.processed < run.total)
  );

  return (
    <AppShell>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Consultas</h1>
          <p className="text-sm text-muted-foreground">
            {filtered.length} exibidos · <strong>{items.length}</strong> carregados
            {totalDb != null && <> · <strong>{totalDb}</strong> no total</>}
            {totalDb != null && items.length < totalDb && (
              <span className="ml-1 text-warning">(carregando…)</span>
            )}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <label className="flex items-center gap-2 rounded-md border px-3 py-2 text-sm cursor-pointer hover:bg-accent">
            <Checkbox checked={parallel} onCheckedChange={(v) => setParallel(!!v)} />
            <span>Usar 2 contas (paralelo)</span>
          </label>
          <Button onClick={() => callProcessar()} disabled={processing || isRunActive}>
            {processing || isRunActive ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Play className="mr-2 h-4 w-4" />}
            {isRunActive ? "Em execução…" : "Iniciar processamento"}
          </Button>
          {selectedErrIds.length > 0 && (
            <Button variant="secondary" onClick={() => callProcessar({ ids: selectedErrIds })} disabled={processing || isRunActive}>
              <RefreshCw className="mr-2 h-4 w-4" /> Reprocessar selecionados ({selectedErrIds.length})
            </Button>
          )}
          {erroTipoFilter !== "all" && (() => {
            const eligibles = items.filter(
              (i) => i.status === "erro"
                && (i.erro_tipo ?? "outro") === erroTipoFilter
                && (i.tentativas ?? 0) < maxAttempts,
            );
            if (eligibles.length === 0) return null;
            return (
              <Button
                variant="secondary"
                onClick={() => callProcessar({ erroTipo: erroTipoFilter })}
                disabled={processing || isRunActive}
                title={`Reprocessar ${eligibles.length} registro(s) do tipo "${erroTipoLabel(erroTipoFilter)}" com até ${maxAttempts} tentativas e backoff exponencial`}
              >
                <RefreshCw className="mr-2 h-4 w-4" />
                Reprocessar tipo: {erroTipoLabel(erroTipoFilter)} ({eligibles.length})
              </Button>
            );
          })()}
          <label className="flex items-center gap-2 rounded-md border px-3 py-2 text-sm">
            <span className="text-muted-foreground">Tentativas máx:</span>
            <Input
              type="number" min={1} max={10}
              value={maxAttempts}
              onChange={(e) => setMaxAttempts(Math.max(1, Math.min(10, Number(e.target.value) || 1)))}
              className="h-7 w-16"
            />
          </label>
          <Button
            variant="default"
            onClick={() => exportWithRefresh("xlsx-done")}
            disabled={refreshingExport}
            title="Recarrega a lista do servidor antes de gerar o Excel"
          >
            {refreshingExport
              ? <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              : <RefreshCw className="mr-2 h-4 w-4" />}
            Atualizar e exportar (Excel)
          </Button>
          <Button variant="outline" onClick={() => exportXlsx(true)}><FileSpreadsheet className="mr-2 h-4 w-4" /> Excel (concluídos)</Button>
          <Button variant="outline" onClick={() => exportXlsx(false)}><FileSpreadsheet className="mr-2 h-4 w-4" /> Excel (todos)</Button>
          <Button variant="outline" onClick={() => exportCsv(true)}><Download className="mr-2 h-4 w-4" /> CSV concluídos</Button>
          <Button variant="outline" onClick={() => exportCsv(false)}><Download className="mr-2 h-4 w-4" /> CSV todos</Button>
        </div>
      </div>

      {run && isRunActive && (
        <Card className="mb-6 p-4">
          <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
            <div>
              <h2 className="text-sm font-semibold">
                Processamento em andamento {run.status === "paused" && <span className="ml-2 text-warning">(pausado)</span>}
              </h2>
              <p className="text-xs text-muted-foreground">
                {run.processed} de {run.total} CPFs processados • {run.errors} erro(s)
                {isRunActive && (
                  <span className="ml-2 opacity-70">• último update há {Math.round(runStaleMs / 1000)}s</span>
                )}
              </p>
            </div>
            <div className="flex gap-2">
              {isRunStuck && (
                <Button size="sm" variant="default" onClick={resumeRun} disabled={processing}>
                  <PlayCircle className="mr-2 h-4 w-4" /> Retomar do checkpoint
                </Button>
              )}
              {run.status === "running" ? (
                <Button size="sm" variant="outline" onClick={() => updateRunStatus("paused")}>
                  <Pause className="mr-2 h-4 w-4" /> Pausar
                </Button>
              ) : (
                <Button size="sm" variant="outline" onClick={() => updateRunStatus("running")}>
                  <Play className="mr-2 h-4 w-4" /> Continuar
                </Button>
              )}
              <Button size="sm" variant="destructive" onClick={() => updateRunStatus("stopped")}>
                <Square className="mr-2 h-4 w-4" /> Parar
              </Button>
            </div>
          </div>
          {isRunStuck && (
            <div className="mb-2 flex items-start gap-2 rounded-md border border-warning/40 bg-warning/10 p-2 text-xs text-warning-foreground">
              <AlertTriangle className="mt-0.5 h-4 w-4 flex-none text-warning" />
              <span>
                Sem atualizações há {Math.round(runStaleMs / 1000)}s. O processamento pode ter sido interrompido — clique em <strong>Retomar do checkpoint</strong> para continuar de onde parou ({run.processed}/{run.total}).
              </span>
            </div>
          )}
          {(() => {
            const raw = run.total > 0 ? (run.processed / run.total) * 100 : 0;
            const clamped = Math.min(100, Math.max(0, raw));
            const overflow = raw > 100;
            return (
              <>
                <Progress value={clamped} />
                <p className="mt-2 text-right text-xs text-muted-foreground tabular-nums">
                  {Math.round(clamped)}%
                  {overflow && (
                    <span className="ml-1 text-xs text-muted-foreground">(recalculando)</span>
                  )}
                </p>
              </>
            );
          })()}
        </Card>
      )}

      {run && !isRunActive && run.finished_at && (
        <Card className="mb-6 p-4">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <div>
              <h2 className="text-sm font-semibold">
                Resumo do último processamento
                {run.status === "stopped" && <Badge variant="outline" className="ml-2 bg-warning/15 text-warning-foreground border-warning/30">Parado</Badge>}
                {run.status === "completed" && <Badge variant="outline" className="ml-2 bg-success/15 text-success border-success/30">Concluído</Badge>}
              </h2>
              <p className="text-xs text-muted-foreground">
                {new Date(run.started_at).toLocaleString("pt-BR")} → {new Date(run.finished_at).toLocaleString("pt-BR")}
              </p>
            </div>
            <div className="flex gap-2">
              {canResume && (
                <Button size="sm" variant="default" onClick={resumeRun} disabled={processing}>
                  <PlayCircle className="mr-2 h-4 w-4" /> Retomar ({pendentesCount} pendentes)
                </Button>
              )}
              <Button size="sm" variant="ghost" onClick={() => setRun(null)}>Ocultar</Button>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <div className="rounded-md border p-3">
              <p className="text-xs text-muted-foreground">Tempo total</p>
              <p className="text-lg font-semibold tabular-nums">
                {formatDuration(+new Date(run.finished_at) - +new Date(run.started_at))}
              </p>
            </div>
            <div className="rounded-md border p-3">
              <p className="text-xs text-muted-foreground">Processados</p>
              <p className="text-lg font-semibold tabular-nums">{run.processed} / {run.total}</p>
            </div>
            <div className="rounded-md border p-3">
              <p className="text-xs text-muted-foreground">Sucessos</p>
              <p className="text-lg font-semibold tabular-nums text-success">{run.processed - run.errors}</p>
            </div>
            <div className="rounded-md border p-3">
              <p className="text-xs text-muted-foreground">Erros</p>
              <p className="text-lg font-semibold tabular-nums text-destructive">{run.errors}</p>
            </div>
          </div>
          {(() => {
            const sinceStart = items.filter(
              (i) => i.processed_at && new Date(i.processed_at) >= new Date(run.started_at) && i.status === "concluido",
            );
            const sum = (k: keyof Consulta) =>
              sinceStart.reduce((acc, i) => acc + (Number(i[k]) || 0), 0);
            const tEmp = sum("margem_emprestimo");
            const tCC = sum("margem_cartao_credito");
            const tCB = sum("margem_cartao_beneficio");
            const tTot = tEmp + tCC + tCB;
            return (
              <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
                <div className="rounded-md border p-3">
                  <p className="text-xs text-muted-foreground">Margem Empréstimo</p>
                  <p className="text-lg font-semibold tabular-nums">{brl(tEmp)}</p>
                </div>
                <div className="rounded-md border p-3">
                  <p className="text-xs text-muted-foreground">Margem Cartão Crédito</p>
                  <p className="text-lg font-semibold tabular-nums">{brl(tCC)}</p>
                </div>
                <div className="rounded-md border p-3">
                  <p className="text-xs text-muted-foreground">Margem Cartão Benefício</p>
                  <p className="text-lg font-semibold tabular-nums">{brl(tCB)}</p>
                </div>
                <div className="rounded-md border p-3 bg-success/5">
                  <p className="text-xs text-muted-foreground">Total Disponível</p>
                  <p className="text-lg font-semibold tabular-nums text-success">{brl(tTot)}</p>
                </div>
              </div>
            );
          })()}
        </Card>
      )}

      {(() => {
        const recentes = items
          .filter((i) => i.processed_at)
          .slice()
          .sort((a, b) => +new Date(b.processed_at!) - +new Date(a.processed_at!))
          .slice(0, 5);
        if (recentes.length === 0) return null;
        return (
          <Card className="mb-6 p-4">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-sm font-semibold">Consultas recentes</h2>
              <span className="text-xs text-muted-foreground">últimas {recentes.length} processadas</span>
            </div>
            <ul className="divide-y">
              {recentes.map((r) => (
                <li key={r.id} className="flex flex-wrap items-center justify-between gap-2 py-2 text-sm">
                  <div className="flex items-center gap-3">
                    {statusBadge(r.status)}
                    <span className="font-mono text-xs text-muted-foreground">{r.cpf}</span>
                    <span className="font-medium">{r.servidor_nome ?? r.nome}</span>
                  </div>
                  <div className="flex items-center gap-4 text-xs">
                    <span className="text-muted-foreground">{r.orgao ?? "—"}</span>
                    <span className="tabular-nums font-semibold">{brl(r.margem_disponivel)}</span>
                    <span className="text-muted-foreground">
                      {r.processed_at ? new Date(r.processed_at).toLocaleString("pt-BR") : "—"}
                    </span>
                  </div>
                </li>
              ))}
            </ul>
          </Card>
        );
      })()}

      <Card className="overflow-hidden">
        <div className="flex flex-wrap items-center gap-3 border-b p-4">
          <Input
            placeholder="Buscar por CPF ou nome…" value={search}
            onChange={(e) => setSearch(e.target.value)} className="max-w-xs"
          />
          <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as typeof statusFilter)}>
            <SelectTrigger className="w-[180px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos os status</SelectItem>
              <SelectItem value="pendente">Pendente</SelectItem>
              <SelectItem value="processando">Processando</SelectItem>
              <SelectItem value="concluido">Concluído</SelectItem>
              <SelectItem value="erro">Erro</SelectItem>
            </SelectContent>
          </Select>
          <Select value={erroTipoFilter} onValueChange={setErroTipoFilter}>
            <SelectTrigger className="w-[240px]">
              <SelectValue placeholder="Tipo de erro" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos os tipos de erro</SelectItem>
              {erroTipoCounts.map(([k, n]) => (
                <SelectItem key={k} value={k}>
                  {erroTipoLabel(k)} ({n})
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {erroTipoFilter !== "all" && (
            <Button variant="ghost" size="sm" onClick={() => setErroTipoFilter("all")}>Limpar tipo</Button>
          )}
        </div>

        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-10">
                  <Checkbox
                    checked={pageItems.length > 0 && pageItems.every((i) => selected.has(i.id))}
                    onCheckedChange={toggleAll}
                  />
                </TableHead>
                <TableHead>CPF</TableHead>
                <TableHead>Servidor</TableHead>
                <TableHead>Matrícula</TableHead>
                <TableHead>Órgão</TableHead>
                <TableHead>Situação</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Empréstimo</TableHead>
                <TableHead className="text-right">Cartão Crédito</TableHead>
                <TableHead className="text-right">Cartão Benefício</TableHead>
                <TableHead className="text-right">Total</TableHead>
                <TableHead>Tipo de erro</TableHead>
                <TableHead>Erro</TableHead>
                <TableHead className="w-20 text-center">Detalhes</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {pageItems.length === 0 ? (
                <TableRow><TableCell colSpan={14} className="py-12 text-center text-muted-foreground">Nenhum registro.</TableCell></TableRow>
              ) : pageItems.map((r) => (
                <TableRow key={r.id}>
                  <TableCell><Checkbox checked={selected.has(r.id)} onCheckedChange={() => toggle(r.id)} /></TableCell>
                  <TableCell className="font-mono text-xs">{r.cpf}</TableCell>
                  <TableCell className="max-w-[220px] truncate">{r.servidor_nome ?? r.nome}</TableCell>
                  <TableCell className="font-mono text-xs">{r.matricula ?? "—"}</TableCell>
                  <TableCell className="max-w-[200px] truncate text-xs">{r.orgao ?? "—"}</TableCell>
                  <TableCell className="text-xs">{r.situacao ?? "—"}</TableCell>
                  <TableCell>{statusBadge(r.status)}</TableCell>
                  <TableCell className="text-right tabular-nums">{brl(r.margem_emprestimo)}</TableCell>
                  <TableCell className="text-right tabular-nums">{brl(r.margem_cartao_credito)}</TableCell>
                  <TableCell className="text-right tabular-nums">{brl(r.margem_cartao_beneficio)}</TableCell>
                  <TableCell className="text-right tabular-nums font-semibold">{brl(r.margem_disponivel)}</TableCell>
                  <TableCell className="text-xs">
                    {r.status === "erro" ? (
                      <div className="flex flex-col items-start gap-1">
                        <Badge
                          variant="outline"
                          className="cursor-pointer bg-destructive/10 text-destructive border-destructive/30"
                          onClick={() => setErroTipoFilter(r.erro_tipo ?? "outro")}
                          title="Filtrar por este tipo"
                        >
                          {erroTipoLabel(r.erro_tipo ?? "outro")}
                        </Badge>
                        <span
                          className={`text-[10px] tabular-nums ${(r.tentativas ?? 0) >= maxAttempts ? "text-destructive font-semibold" : "text-muted-foreground"}`}
                          title={(r.tentativas ?? 0) >= maxAttempts ? "Limite de tentativas atingido" : ""}
                        >
                          {r.tentativas ?? 0}/{maxAttempts} tentativa(s)
                        </span>
                      </div>
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </TableCell>
                  <TableCell className="max-w-[280px] text-xs text-destructive">
                    <span title={r.erro ?? ""} className="block whitespace-normal break-words">
                      {r.status === "erro" ? (formatErroMsg(r.erro) || "Erro não informado") : formatErroMsg(r.erro)}
                    </span>
                  </TableCell>
                  <TableCell className="text-center">
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => setDetalheConsulta(r)}
                      title="Ver passos da última tentativa"
                    >
                      <FileSearch className="h-4 w-4" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>

        <div className="flex items-center justify-between border-t p-4 text-sm">
          <span className="text-muted-foreground">Página {page} de {totalPages}</span>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>Anterior</Button>
            <Button variant="outline" size="sm" disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)}>Próxima</Button>
          </div>
        </div>
      </Card>

      <DetalhesSheet
        consulta={detalheConsulta}
        onOpenChange={(open) => { if (!open) setDetalheConsulta(null); }}
      />
    </AppShell>
  );
}

// ---------- Detalhes da tentativa ----------

interface LogRow {
  id: number;
  consulta_id: string;
  level: string;
  message: string;
  created_at: string;
}

interface PassoTentativa {
  ts: string;
  level: string;
  slot: string | null;
  etapa: string;
  orgao: string | null;
  servico: string | null;
  url: string | null;
  detalhe: string;
  raw: string;
}

const CONSIGUP_BASE = "https://www.consigup.com.br";

function parseLog(row: LogRow): PassoTentativa {
  const msg = row.message ?? "";
  const slotMatch = msg.match(/^\[slot\s+(\d+)\]\s*/);
  const slot = slotMatch ? slotMatch[1] : null;
  const body = slotMatch ? msg.slice(slotMatch[0].length) : msg;

  let etapa = "Outro";
  let orgao: string | null = null;
  let servico: string | null = null;
  let url: string | null = null;
  let detalhe = body;

  const orgaoMatch = body.match(/===\s*Órgão\s+(\S+)\s+(.+?)\s*===/);
  if (orgaoMatch) {
    etapa = "Trocar órgão";
    orgao = `${orgaoMatch[1]} — ${orgaoMatch[2]}`;
    detalhe = `Selecionando órgão ${orgao}`;
  } else if (/^Login ConsigUp/i.test(body)) {
    etapa = "Login";
    url = `${CONSIGUP_BASE}/Login.aspx`;
  } else if (/Sessão pronta/i.test(body)) {
    etapa = "Sessão pronta";
  } else if (/Sessão ConsigUp expirou/i.test(body)) {
    etapa = "Sessão expirada";
  } else if (/^Iniciando processamento/i.test(body)) {
    etapa = "Início CPF";
  } else if (/^Backoff/i.test(body)) {
    etapa = "Backoff";
  } else if (/^Finalizado/i.test(body)) {
    etapa = /com erro/i.test(body) ? "Finalizado (erro)" : "Finalizado (ok)";
  } else {
    const svcMatch = body.match(/\[consulta\s+svc=(\d+)\]\s*(.*)$/);
    if (svcMatch) {
      servico = svcMatch[1];
      const rest = svcMatch[2];
      if (/^POST/i.test(rest)) {
        etapa = "POST consulta";
        url = `${CONSIGUP_BASE}/ConsultaMargem.aspx`;
        detalhe = rest;
      } else if (/^response/i.test(rest)) {
        etapa = "Resposta";
        detalhe = rest;
      } else if (/^OK/i.test(rest)) {
        etapa = "Margem encontrada";
        detalhe = rest;
      } else if (/sem margem/i.test(rest)) {
        etapa = "Sem margem";
        detalhe = rest;
      } else {
        etapa = "Consulta serviço";
        detalhe = rest;
      }
    } else {
      const orgaoNum = body.match(/^\[(\d+)\]\s*(.+)$/);
      if (orgaoNum) {
        orgao = orgaoNum[1];
        etapa = "Resumo órgão";
        detalhe = orgaoNum[2];
      } else if (/ajax-delta/i.test(body)) {
        etapa = "Parse AJAX";
      } else if (/\[orgao\]/i.test(body)) {
        etapa = "Carregar órgão";
      } else if (/\[resumo\]/i.test(body)) {
        etapa = "Resumo final";
      }
    }
  }

  return {
    ts: row.created_at,
    level: row.level,
    slot,
    etapa,
    orgao,
    servico,
    url,
    detalhe: detalhe.slice(0, 400),
    raw: msg,
  };
}

function DetalhesSheet({
  consulta,
  onOpenChange,
}: { consulta: Consulta | null; onOpenChange: (open: boolean) => void }) {
  const [logs, setLogs] = useState<LogRow[]>([]);
  const [loadingLogs, setLoadingLogs] = useState(false);

  useEffect(() => {
    if (!consulta) { setLogs([]); return; }
    let cancel = false;
    setLoadingLogs(true);
    (async () => {
      const { data, error } = await supabase
        .from("processar_logs")
        .select("id, consulta_id, level, message, created_at")
        .eq("consulta_id", consulta.id)
        .order("created_at", { ascending: true })
        .order("id", { ascending: true })
        .limit(2000);
      if (cancel) return;
      if (error) toast.error(error.message);
      setLogs((data ?? []) as LogRow[]);
      setLoadingLogs(false);
    })();
    return () => { cancel = true; };
  }, [consulta]);

  const passos = useMemo(() => logs.map(parseLog), [logs]);

  // Apenas a última tentativa: corta no último log "Iniciando processamento"
  const passosUltima = useMemo(() => {
    const idx = (() => {
      for (let i = passos.length - 1; i >= 0; i--) {
        if (passos[i].etapa === "Início CPF") return i;
      }
      return 0;
    })();
    return passos.slice(idx);
  }, [passos]);

  const open = !!consulta;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-2xl overflow-y-auto">
        <SheetHeader>
          <SheetTitle className="text-base">
            Detalhes da tentativa — CPF {consulta?.cpf}
          </SheetTitle>
          <SheetDescription className="text-xs">
            {consulta?.servidor_nome ?? consulta?.nome}
            {" · "}Tentativas: {consulta?.tentativas ?? 0}
            {consulta?.erro_tipo ? ` · Tipo: ${erroTipoLabel(consulta.erro_tipo)}` : ""}
          </SheetDescription>
        </SheetHeader>

        {consulta?.erro && (
          <div className="my-4 rounded-md border border-destructive/30 bg-destructive/5 p-3 text-xs text-destructive">
            <p className="font-semibold">Erro reportado</p>
            <p className="mt-1 whitespace-pre-wrap break-words">{formatErroMsg(consulta.erro)}</p>
            <details className="mt-2">
              <summary className="cursor-pointer text-[11px] opacity-70">Ver mensagem técnica completa</summary>
              <p className="mt-1 whitespace-pre-wrap break-words text-[11px] opacity-80">{consulta.erro}</p>
            </details>
          </div>
        )}

        <div className="mt-4">
          <div className="mb-2 flex items-center justify-between">
            <h3 className="text-sm font-semibold">Passos do fluxo (última tentativa)</h3>
            <span className="text-xs text-muted-foreground">{passosUltima.length} eventos</span>
          </div>

          {loadingLogs ? (
            <div className="flex items-center gap-2 py-8 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" /> Carregando…
            </div>
          ) : passosUltima.length === 0 ? (
            <div className="rounded-md border border-dashed p-6 text-center text-xs text-muted-foreground">
              Sem registros. Reprocesse para gerar passos detalhados.
            </div>
          ) : (
            <ol className="relative border-l border-border pl-4">
              {passosUltima.map((p, i) => (
                <li key={i} className="mb-3 last:mb-0">
                  <span className={`absolute -left-[5px] mt-1.5 h-2.5 w-2.5 rounded-full ${
                    p.level === "error" ? "bg-destructive"
                      : p.level === "warn" ? "bg-warning"
                      : "bg-primary/60"
                  }`} />
                  <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
                    <span className="text-xs font-semibold">{p.etapa}</span>
                    {p.orgao && <Badge variant="outline" className="text-[10px]">Órgão {p.orgao}</Badge>}
                    {p.servico && <Badge variant="outline" className="text-[10px]">svc {p.servico}</Badge>}
                    {p.slot && <span className="text-[10px] text-muted-foreground">slot {p.slot}</span>}
                    <span className="ml-auto text-[10px] tabular-nums text-muted-foreground">
                      {new Date(p.ts).toLocaleTimeString("pt-BR")}
                    </span>
                  </div>
                  {p.url && (
                    <p className="mt-0.5 break-all font-mono text-[10px] text-muted-foreground">
                      {p.url}
                    </p>
                  )}
                  <p className="mt-0.5 whitespace-pre-wrap break-words text-xs text-muted-foreground">
                    {p.detalhe}
                  </p>
                </li>
              ))}
            </ol>
          )}
        </div>

        <details className="mt-4">
          <summary className="cursor-pointer text-xs text-muted-foreground hover:text-foreground">
            Ver log bruto completo ({passos.length} linhas)
          </summary>
          <pre className="mt-2 max-h-[300px] overflow-auto rounded-md border bg-muted/40 p-2 text-[10px] leading-relaxed">
            {logs.map((l) => `[${new Date(l.created_at).toLocaleTimeString("pt-BR")}] [${l.level}] ${l.message}`).join("\n")}
          </pre>
        </details>
      </SheetContent>
    </Sheet>
  );
}
