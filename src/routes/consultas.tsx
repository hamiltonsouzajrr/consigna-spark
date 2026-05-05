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
import { Play, Download, RefreshCw, Loader2 } from "lucide-react";

export const Route = createFileRoute("/consultas")({ component: Page });

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
          <Button onClick={() => callProcessar()} disabled={processing}>
            {processing ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Play className="mr-2 h-4 w-4" />}
            Iniciar processamento
          </Button>
          {selectedErrIds.length > 0 && (
            <Button variant="secondary" onClick={() => callProcessar(selectedErrIds)}>
              <RefreshCw className="mr-2 h-4 w-4" /> Reprocessar selecionados ({selectedErrIds.length})
            </Button>
          )}
          <Button variant="outline" onClick={() => exportCsv(true)}><Download className="mr-2 h-4 w-4" /> Concluídos</Button>
          <Button variant="outline" onClick={() => exportCsv(false)}><Download className="mr-2 h-4 w-4" /> Todos</Button>
        </div>
      </div>

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
                  <TableCell className="max-w-[200px] truncate text-xs text-destructive">{r.erro ?? ""}</TableCell>
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
