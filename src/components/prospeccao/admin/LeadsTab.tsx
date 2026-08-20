import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Search } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { adminAssignLeads } from "@/lib/prospeccao/prospeccao.functions";
import { STATUS_LABEL, STATUS_TONE, type LeadStatus } from "@/lib/prospeccao/constants";

type Consultant = { id: string; email: string };
type LeadRow = { id: string; nome: string; cidade: string | null; origem: string | null; status: LeadStatus; score: number; consultant_id: string | null; created_at: string };

const PAGE_SIZE = 25;

export function LeadsTab({ consultants }: { consultants: Consultant[] }) {
  const qc = useQueryClient();
  const assignLeads = useServerFn(adminAssignLeads);
  const [term, setTerm] = useState("");
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("all");
  const [owner, setOwner] = useState("all");
  const [page, setPage] = useState(0);

  const leadsQ = useQuery({
    queryKey: ["prospect", "admin-leads", { search, status, owner, page }],
    queryFn: async () => {
      let q = supabase
        .from("prospect_leads")
        .select("id,nome,cidade,origem,status,score,consultant_id,created_at", { count: "exact" })
        .order("created_at", { ascending: false })
        .range(page * PAGE_SIZE, page * PAGE_SIZE + PAGE_SIZE - 1);
      if (search.trim()) q = q.ilike("nome", `%${search.trim()}%`);
      if (status !== "all") q = q.eq("status", status as LeadStatus);
      if (owner === "none") q = q.is("consultant_id", null);
      else if (owner !== "all") q = q.eq("consultant_id", owner);
      const { data, error, count } = await q;
      if (error) throw new Error(error.message);
      return { rows: (data ?? []) as LeadRow[], count: count ?? 0 };
    },
  });

  const rows = leadsQ.data?.rows ?? [];
  const total = leadsQ.data?.count ?? 0;
  const lastPage = Math.max(0, Math.ceil(total / PAGE_SIZE) - 1);

  const applySearch = () => { setSearch(term); setPage(0); };

  const reassign = async (leadId: string, consultantId: string) => {
    try {
      await assignLeads({ data: { leadIds: [leadId], consultantId: consultantId === "none" ? null : consultantId } });
      qc.invalidateQueries({ queryKey: ["prospect"] });
      toast.success("Lead atribuído.");
    } catch (e) { toast.error(e instanceof Error ? e.message : "Falha ao atribuir."); }
  };

  return (
    <Card className="overflow-hidden">
      <div className="flex flex-wrap items-end gap-2 border-b px-5 py-4">
        <div className="flex-1 min-w-[200px]">
          <p className="mb-1 text-sm font-semibold">Leads ({total})</p>
          <div className="flex gap-2">
            <Input placeholder="Buscar por nome…" value={term} onChange={(e) => setTerm(e.target.value)} onKeyDown={(e) => e.key === "Enter" && applySearch()} />
            <Button variant="secondary" size="icon" onClick={applySearch} aria-label="Buscar"><Search className="h-4 w-4" /></Button>
          </div>
        </div>
        <Select value={status} onValueChange={(v) => { setStatus(v); setPage(0); }}>
          <SelectTrigger className="w-[160px]"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos os status</SelectItem>
            {(Object.keys(STATUS_LABEL) as LeadStatus[]).map((s) => <SelectItem key={s} value={s}>{STATUS_LABEL[s]}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={owner} onValueChange={(v) => { setOwner(v); setPage(0); }}>
          <SelectTrigger className="w-[220px]"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas as consultoras</SelectItem>
            <SelectItem value="none">Sem responsável</SelectItem>
            {consultants.map((c) => <SelectItem key={c.id} value={c.id}>{c.email}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      <div className="max-h-[560px] overflow-auto">
        <Table>
          <TableHeader>
            <TableRow><TableHead>Nome</TableHead><TableHead>Cidade</TableHead><TableHead>Status</TableHead><TableHead className="text-right">Score</TableHead><TableHead>Consultora</TableHead></TableRow>
          </TableHeader>
          <TableBody>
            {leadsQ.isPending && Array.from({ length: 5 }).map((_, i) => (
              <TableRow key={`sk-${i}`}><TableCell colSpan={5}><Skeleton className="h-6 w-full" /></TableCell></TableRow>
            ))}
            {leadsQ.isError && (
              <TableRow><TableCell colSpan={5} className="text-center text-sm text-destructive">
                Falha ao carregar leads. <Button variant="link" size="sm" onClick={() => leadsQ.refetch()}>Tentar novamente</Button>
              </TableCell></TableRow>
            )}
            {!leadsQ.isPending && !leadsQ.isError && rows.map((l) => (
              <TableRow key={l.id}>
                <TableCell><Link to="/prospeccao/$leadId" params={{ leadId: l.id }} className="font-medium hover:underline">{l.nome}</Link></TableCell>
                <TableCell className="text-muted-foreground">{l.cidade ?? "—"}</TableCell>
                <TableCell><Badge variant="outline" className={STATUS_TONE[l.status]}>{STATUS_LABEL[l.status]}</Badge></TableCell>
                <TableCell className="text-right font-semibold">{l.score}</TableCell>
                <TableCell>
                  <Select value={l.consultant_id ?? "none"} onValueChange={(v) => reassign(l.id, v)}>
                    <SelectTrigger className="h-8 w-[200px]"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">Não atribuído</SelectItem>
                      {consultants.map((c) => <SelectItem key={c.id} value={c.id}>{c.email}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </TableCell>
              </TableRow>
            ))}
            {!leadsQ.isPending && !leadsQ.isError && !rows.length && (
              <TableRow><TableCell colSpan={5} className="text-center text-sm text-muted-foreground">Nenhum lead encontrado com esses filtros.</TableCell></TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      <div className="flex items-center justify-between border-t px-5 py-3 text-xs text-muted-foreground">
        <span>Página {page + 1} de {lastPage + 1}</span>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" disabled={page === 0 || leadsQ.isFetching} onClick={() => setPage((p) => Math.max(0, p - 1))}>Anterior</Button>
          <Button variant="outline" size="sm" disabled={page >= lastPage || leadsQ.isFetching} onClick={() => setPage((p) => p + 1)}>Próxima</Button>
        </div>
      </div>
    </Card>
  );
}
