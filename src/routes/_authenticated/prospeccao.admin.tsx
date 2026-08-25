import { createFileRoute, Navigate, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/lib/auth";
import { useRhAccess } from "@/hooks/use-rh-access";
import { supabase } from "@/integrations/supabase/client";
import { AppShell } from "@/components/AppShell";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { RhStatCard } from "@/components/rh/RhStatCard";
import { toast } from "sonner";
import { ArrowLeft, Trophy, AlertTriangle, Ghost, UserPlus, RefreshCw, Trash2, FileSpreadsheet } from "lucide-react";
import { getProspectConsultants, getAdminStats, adminListImportBatches, adminDeleteImportBatch } from "@/lib/prospeccao/prospeccao.functions";
import { ImportTab } from "@/components/prospeccao/admin/ImportTab";
import { ManualLeadCard } from "@/components/prospeccao/admin/ManualLeadCard";
import { DistribuicaoTab } from "@/components/prospeccao/admin/DistribuicaoTab";
import { LeadsTab } from "@/components/prospeccao/admin/LeadsTab";
import { CompeticaoTab } from "@/components/prospeccao/admin/CompeticaoTab";
import { AcessosTab } from "@/components/prospeccao/admin/AcessosTab";
import { ConfirmDialog } from "@/components/prospeccao/admin/ConfirmDialog";

export const Route = createFileRoute("/_authenticated/prospeccao/admin")({
  head: () => ({ meta: [{ title: "Painel admin — Prospecção" }, { name: "robots", content: "noindex,nofollow" }] }),
  component: Page,
});

type Consultant = { id: string; email: string };

function Page() {
  const { user, loading } = useAuth();
  const { isAdmin, isLoading: accessLoading } = useRhAccess();
  const qc = useQueryClient();

  const fetchConsultants = useServerFn(getProspectConsultants);
  const fetchStats = useServerFn(getAdminStats);
  const listBatches = useServerFn(adminListImportBatches);
  const deleteBatch = useServerFn(adminDeleteImportBatch);

  const [selectedConsultants, setSelectedConsultants] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState(false);

  const enabled = !!user && isAdmin;
  const consultantsQ = useQuery({ queryKey: ["prospect", "consultants"], queryFn: () => fetchConsultants(), enabled });
  const statsQ = useQuery({ queryKey: ["prospect", "admin-stats"], queryFn: () => fetchStats(), enabled });
  const batchesQ = useQuery({ queryKey: ["prospect", "import-batches"], queryFn: () => listBatches(), enabled });
  const unassignedQ = useQuery({
    queryKey: ["prospect", "unassigned-count"],
    enabled,
    queryFn: async () => {
      const { count, error } = await supabase.from("prospect_leads").select("id", { count: "exact", head: true }).is("consultant_id", null);
      if (error) throw new Error(error.message);
      return count ?? 0;
    },
  });

  const consultants = (consultantsQ.data ?? []) as Consultant[];

  // Default: all consultants participate in distribution/recycle once loaded.
  useEffect(() => {
    if (consultants.length && selectedConsultants.size === 0) {
      setSelectedConsultants(new Set(consultants.map((c) => c.id)));
    }
  }, [consultants.length]);

  if (loading || accessLoading) {
    return (
      <AppShell>
        <div className="space-y-4">
          <Skeleton className="h-8 w-64" />
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">{Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-24 w-full" />)}</div>
          <Skeleton className="h-64 w-full" />
        </div>
      </AppShell>
    );
  }
  if (!user) return <Navigate to="/login" />;
  if (!isAdmin) return <Navigate to="/prospeccao" />;

  const toggleConsultant = (id: string) =>
    setSelectedConsultants((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });

  const removeBatch = async (batch: string | null) => {
    setBusy(true);
    try {
      const r = await deleteBatch({ data: { batch } });
      toast.success(`${r.deleted} lead(s) excluído(s).`);
      qc.invalidateQueries({ queryKey: ["prospect"] });
    } catch (e) { toast.error(e instanceof Error ? e.message : "Falha ao excluir importação."); }
    setBusy(false);
  };

  const stats = statsQ.data;

  return (
    <AppShell>
      <Button asChild variant="ghost" size="sm" className="mb-4"><Link to="/prospeccao"><ArrowLeft className="mr-2 h-4 w-4" /> Voltar à fila</Link></Button>
      <h1 className="mb-1 text-2xl font-bold">Painel admin — Prospecção</h1>
      <p className="mb-6 text-sm text-muted-foreground">Importe planilhas, distribua leads e acompanhe os gargalos.</p>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <RhStatCard label="Total de leads" value={stats?.totalLeads ?? "—"} icon={Trophy} tone="sky" />
        <RhStatCard label="Sem tratativa" value={stats?.semTratativa ?? "—"} icon={AlertTriangle} tone="amber" />
        <RhStatCard label="Esquecidos (3+ dias)" value={stats?.esquecidos ?? "—"} icon={Ghost} tone="rose" />
        <RhStatCard label="Consultoras ativas" value={stats?.ranking.filter((r) => r.consultantId).length ?? "—"} icon={UserPlus} tone="violet" />
      </div>

      <Tabs defaultValue="visao" className="mt-6">
        <TabsList className="flex-wrap">
          <TabsTrigger value="visao">Visão geral</TabsTrigger>
          <TabsTrigger value="importar">Importar</TabsTrigger>
          <TabsTrigger value="distribuir">Distribuição</TabsTrigger>
          <TabsTrigger value="leads">Leads</TabsTrigger>
          <TabsTrigger value="competicao">Competição</TabsTrigger>
          <TabsTrigger value="acessos">Acessos</TabsTrigger>
        </TabsList>

        <TabsContent value="visao" className="mt-4 space-y-4">
          <div className="grid gap-4 lg:grid-cols-2">
            <Card className="p-5">
              <p className="mb-3 flex items-center gap-2 text-sm font-semibold"><Trophy className="h-4 w-4" /> Ranking por consultora</p>
              <Table>
                <TableHeader><TableRow><TableHead>Consultora</TableHead><TableHead className="text-right">Leads</TableHead><TableHead className="text-right">Ganhos</TableHead><TableHead className="text-right">Conv.</TableHead></TableRow></TableHeader>
                <TableBody>
                  {statsQ.isPending && <TableRow><TableCell colSpan={4}><Skeleton className="h-6 w-full" /></TableCell></TableRow>}
                  {(stats?.ranking ?? []).map((r) => (
                    <TableRow key={r.consultantId ?? "none"}>
                      <TableCell className="max-w-[180px] truncate">{r.email}</TableCell>
                      <TableCell className="text-right">{r.total}</TableCell>
                      <TableCell className="text-right">{r.ganhos}</TableCell>
                      <TableCell className="text-right">{r.conversao}%</TableCell>
                    </TableRow>
                  ))}
                  {!statsQ.isPending && !stats?.ranking.length && <TableRow><TableCell colSpan={4} className="text-center text-sm text-muted-foreground">Sem dados.</TableCell></TableRow>}
                </TableBody>
              </Table>
            </Card>
            <Card className="p-5">
              <p className="mb-3 text-sm font-semibold">Origem com melhor conversão</p>
              <Table>
                <TableHeader><TableRow><TableHead>Origem</TableHead><TableHead className="text-right">Leads</TableHead><TableHead className="text-right">Conv.</TableHead></TableRow></TableHeader>
                <TableBody>
                  {statsQ.isPending && <TableRow><TableCell colSpan={3}><Skeleton className="h-6 w-full" /></TableCell></TableRow>}
                  {(stats?.porOrigem ?? []).map((o) => (
                    <TableRow key={o.origem}><TableCell>{o.origem}</TableCell><TableCell className="text-right">{o.total}</TableCell><TableCell className="text-right">{o.conversao}%</TableCell></TableRow>
                  ))}
                  {!statsQ.isPending && !stats?.porOrigem.length && <TableRow><TableCell colSpan={3} className="text-center text-sm text-muted-foreground">Sem dados.</TableCell></TableRow>}
                </TableBody>
              </Table>
            </Card>
          </div>

          <Card className="p-5">
            <div className="mb-3 flex items-center justify-between">
              <p className="flex items-center gap-2 text-sm font-semibold"><FileSpreadsheet className="h-4 w-4 text-primary" /> Planilhas importadas</p>
              <Button variant="ghost" size="sm" onClick={() => batchesQ.refetch()} disabled={batchesQ.isFetching}>
                <RefreshCw className={`mr-2 h-4 w-4 ${batchesQ.isFetching ? "animate-spin" : ""}`} /> Atualizar
              </Button>
            </div>
            {batchesQ.isPending ? (
              <div className="space-y-2">{Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-8 w-full" />)}</div>
            ) : batchesQ.isError ? (
              <p className="text-sm text-destructive">Falha ao carregar importações. <Button variant="link" size="sm" onClick={() => batchesQ.refetch()}>Tentar novamente</Button></p>
            ) : (batchesQ.data?.length ?? 0) === 0 ? (
              <p className="text-sm text-muted-foreground">Nenhuma importação registrada.</p>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Importação</TableHead><TableHead className="text-right">Leads</TableHead>
                      <TableHead className="text-right">Atribuídos</TableHead><TableHead className="text-right">Trabalhados</TableHead>
                      <TableHead>Data</TableHead><TableHead className="text-right">Ações</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {batchesQ.data!.map((b) => (
                      <TableRow key={b.batch ?? "__none__"}>
                        <TableCell className="max-w-[280px] truncate font-medium">{b.label}</TableCell>
                        <TableCell className="text-right">{b.total}</TableCell>
                        <TableCell className="text-right">{b.assigned}</TableCell>
                        <TableCell className="text-right">{b.worked}</TableCell>
                        <TableCell className="text-xs text-muted-foreground">{new Date(b.last_at).toLocaleDateString("pt-BR")}</TableCell>
                        <TableCell className="text-right">
                          <ConfirmDialog
                            title="Excluir importação?"
                            description={`A importação "${b.label}" e seus ${b.total} lead(s) serão apagados. Esta ação não pode ser desfeita.`}
                            confirmLabel="Excluir"
                            destructive
                            onConfirm={() => removeBatch(b.batch)}
                          >
                            <Button variant="ghost" size="sm" className="text-destructive hover:text-destructive" disabled={busy}>
                              <Trash2 className="mr-1 h-4 w-4" /> Excluir
                            </Button>
                          </ConfirmDialog>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </Card>
        </TabsContent>

        <TabsContent value="importar" className="mt-4 space-y-4">
          <ImportTab consultants={consultants} selectedConsultants={selectedConsultants} />
          <div className="grid gap-4 lg:grid-cols-2"><ManualLeadCard consultants={consultants} /></div>
        </TabsContent>

        <TabsContent value="distribuir" className="mt-4">
          <DistribuicaoTab
            consultants={consultants}
            selected={selectedConsultants}
            onToggle={toggleConsultant}
            onSelectAll={() => setSelectedConsultants(new Set(consultants.map((c) => c.id)))}
            onClear={() => setSelectedConsultants(new Set())}
            unassignedCount={unassignedQ.data ?? 0}
          />
        </TabsContent>

        <TabsContent value="leads" className="mt-4">
          <LeadsTab consultants={consultants} />
        </TabsContent>

        <TabsContent value="competicao" className="mt-4">
          <CompeticaoTab />
        </TabsContent>

        <TabsContent value="acessos" className="mt-4">
          <AcessosTab currentUserId={user.id} />
        </TabsContent>
      </Tabs>
    </AppShell>
  );
}
