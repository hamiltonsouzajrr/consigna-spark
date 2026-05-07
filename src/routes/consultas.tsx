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
import { Play, Download, RefreshCw, Loader2, FileSpreadsheet, Pause, Square } from "lucide-react";
import { Progress } from "@/components/ui/progress";
import * as XLSX from "xlsx";
import { formatCpf } from "@/lib/cpf";

export const Route = createFileRoute("/consultas")({ component: Page });

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
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [processing, setProcessing] = useState(false);
  const [run, setRun] = useState<Run | null>(null);

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

  useEffect(() => {
    if (!user) return;
    const load = async () => {
      const { data, error } = await supabase
        .from("consultas_margem")
        .select("*")
        .order("updated_at", { ascending: false })
        .limit(1000);
      if (error) toast.error(error.message);
      else setItems((data ?? []) as Consulta[]);
    };
    load();
    const ch = supabase
      .channel("consultas-list")
      .on("postgres_changes", { event: "*", schema: "public", table: "consultas_margem" }, load)
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [user]);

  const filtered = useMemo(() => {
    let f = items;
    if (statusFilter !== "all") f = f.filter((i) => i.status === statusFilter);
    if (search.trim()) {
      const q = search.toLowerCase();
      f = f.filter((i) => i.cpf.includes(q.replace(/\D/g, "")) || i.nome.toLowerCase().includes(q));
    }
    return f;
  }, [items, statusFilter, search]);

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

  const callProcessar = async (ids?: string[]) => {
    setProcessing(true);
    const { error } = await supabase.functions.invoke("processar-margens", { body: { ids } });
    setProcessing(false);
    if (error) toast.error(error.message);
    else toast.success("Processamento iniciado");
  };

  const exportCsv = (onlyDone: boolean) => {
    const data = onlyDone ? items.filter((i) => i.status === "concluido") : items;
    if (!data.length) return toast.info("Nada para exportar");
    const header = ["cpf", "nome", "status", "servidor_nome", "matricula", "categoria", "situacao", "orgao", "margem_emprestimo", "margem_cartao_credito", "margem_cartao_beneficio", "margem_disponivel", "erro", "processed_at"];
    const csv = [header.join(",")].concat(
      data.map((r) => header.map((h) => {
        const v = (r as unknown as Record<string, unknown>)[h];
        const s = v == null ? "" : String(v).replace(/"/g, '""');
        return `"${s}"`;
      }).join(","))
    ).join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = `consultas-${Date.now()}.csv`; a.click();
    URL.revokeObjectURL(url);
  };

  const exportXlsx = (onlyDone: boolean) => {
    const data = onlyDone ? items.filter((i) => i.status === "concluido") : items;
    if (!data.length) return toast.info("Nada para exportar");
    const rows = data.map((r) => ({
      "CPF": formatCpf(r.cpf),
      "Nome (planilha)": r.nome,
      "Servidor": r.servidor_nome ?? "",
      "Matrícula": r.matricula ?? "",
      "Órgão": r.orgao ?? "",
      "Categoria": r.categoria ?? "",
      "Situação": r.situacao ?? "",
      "Status": r.status,
      "Margem Empréstimo": r.margem_emprestimo ?? "",
      "Margem Cartão Crédito": r.margem_cartao_credito ?? "",
      "Margem Cartão Benefício": r.margem_cartao_beneficio ?? "",
      "Margem Total Disponível": r.margem_disponivel ?? "",
      "Erro": r.erro ?? "",
      "Processado em": r.processed_at ? new Date(r.processed_at).toLocaleString("pt-BR") : "",
    }));
    const ws = XLSX.utils.json_to_sheet(rows);
    ws["!cols"] = [
      { wch: 14 }, { wch: 28 }, { wch: 28 }, { wch: 14 }, { wch: 28 },
      { wch: 14 }, { wch: 14 }, { wch: 12 },
      { wch: 18 }, { wch: 20 }, { wch: 22 }, { wch: 22 },
      { wch: 30 }, { wch: 20 },
    ];
    // Formato moeda BRL para colunas de margem (I a L)
    const range = XLSX.utils.decode_range(ws["!ref"] as string);
    for (let R = 1; R <= range.e.r; R++) {
      for (const C of [8, 9, 10, 11]) {
        const addr = XLSX.utils.encode_cell({ r: R, c: C });
        const cell = ws[addr];
        if (cell && typeof cell.v === "number") cell.z = '"R$" #,##0.00';
      }
    }
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Consultas");
    XLSX.writeFile(wb, `consultas-${Date.now()}.xlsx`);
  };

  if (loading) return null;
  if (!user) return <Navigate to="/login" />;

  const selectedErrIds = items.filter((i) => selected.has(i.id) && i.status === "erro").map((i) => i.id);

  return (
    <AppShell>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Consultas</h1>
          <p className="text-sm text-muted-foreground">{filtered.length} registros</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button onClick={() => callProcessar()} disabled={processing || isRunActive}>
            {processing || isRunActive ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Play className="mr-2 h-4 w-4" />}
            {isRunActive ? "Em execução…" : "Iniciar processamento"}
          </Button>
          {selectedErrIds.length > 0 && (
            <Button variant="secondary" onClick={() => callProcessar(selectedErrIds)} disabled={processing || isRunActive}>
              <RefreshCw className="mr-2 h-4 w-4" /> Reprocessar selecionados ({selectedErrIds.length})
            </Button>
          )}
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
              </p>
            </div>
            <div className="flex gap-2">
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
          <Progress value={run.total > 0 ? (run.processed / run.total) * 100 : 0} />
          <p className="mt-2 text-right text-xs text-muted-foreground tabular-nums">
            {run.total > 0 ? Math.round((run.processed / run.total) * 100) : 0}%
          </p>
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
            <Button size="sm" variant="ghost" onClick={() => setRun(null)}>Ocultar</Button>
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
                <TableHead>Erro</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {pageItems.length === 0 ? (
                <TableRow><TableCell colSpan={12} className="py-12 text-center text-muted-foreground">Nenhum registro.</TableCell></TableRow>
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
                  <TableCell className="max-w-[280px] text-xs text-destructive">
                    <span title={r.erro ?? ""} className="block whitespace-normal break-words">
                      {r.status === "erro" ? (r.erro ?? "Erro não informado") : (r.erro ?? "")}
                    </span>
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
    </AppShell>
  );
}
