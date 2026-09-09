// Tela do gestor: metas semanais por consultora e o progresso real da semana.
import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { ArrowLeft, RefreshCw, Target, Save } from "lucide-react";
import { toast } from "sonner";
import { AppShell } from "@/components/AppShell";
import { AdminGate } from "@/components/security/AdminGate";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { MetasResumo } from "@/components/prospeccao/admin/MetasResumo";
import { MetasTable } from "@/components/prospeccao/admin/MetasTable";
import {
  getMetasSemana,
  salvarMetaConsultora,
  salvarMetaPadrao,
  removerMetaConsultora,
} from "@/lib/prospeccao/metas.functions";

export const Route = createFileRoute("/_authenticated/prospeccao/admin/metas")({
  head: () => ({
    meta: [
      { title: "Metas por consultora — acompanhamento da campanha" },
      {
        name: "description",
        content:
          "Defina metas semanais de contatos, vendas confirmadas e tempo ativo por consultora e acompanhe o progresso real da semana.",
      },
      { property: "og:title", content: "Metas por consultora — acompanhamento da campanha" },
      {
        property: "og:description",
        content: "Metas semanais e progresso real de cada consultora na campanha.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex,nofollow" },
    ],
  }),
  component: () => (
    <AdminGate>
      <Page />
    </AdminGate>
  ),
});

const DIA_MS = 86_400_000;

/** Segunda-feira (Maceió) de N semanas atrás, no formato YYYY-MM-DD. */
function segundaDe(semanasAtras: number): string {
  const local = new Date(new Date().toLocaleString("en-US", { timeZone: "America/Maceio" }));
  const dow = (local.getDay() + 6) % 7;
  const base = new Date(local.getTime() - dow * DIA_MS - semanasAtras * 7 * DIA_MS);
  const y = base.getFullYear();
  const m = String(base.getMonth() + 1).padStart(2, "0");
  const d = String(base.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function rotuloSemana(ws: string, i: number) {
  const [y, m, d] = ws.split("-").map(Number);
  const inicio = new Date(Date.UTC(y!, (m ?? 1) - 1, d ?? 1, 12));
  const fim = new Date(inicio.getTime() + 4 * DIA_MS);
  const f = (dt: Date) => `${String(dt.getUTCDate()).padStart(2, "0")}/${String(dt.getUTCMonth() + 1).padStart(2, "0")}`;
  return `${i === 0 ? "Semana atual" : `${i} semana(s) atrás`} — ${f(inicio)} a ${f(fim)}`;
}

function Page() {
  const semanas = Array.from({ length: 8 }, (_, i) => segundaDe(i));
  const [semana, setSemana] = useState(semanas[0]!);
  const qc = useQueryClient();

  const buscar = useServerFn(getMetasSemana);
  const salvarUma = useServerFn(salvarMetaConsultora);
  const removerUma = useServerFn(removerMetaConsultora);
  const salvarPadrao = useServerFn(salvarMetaPadrao);

  const { data, isLoading, isFetching, refetch, error } = useQuery({
    queryKey: ["prospect-metas", semana],
    queryFn: () => buscar({ data: { weekStart: semana } }),
    refetchInterval: 60_000,
  });

  const [padrao, setPadrao] = useState({ meta_contatos: 0, meta_vendas: 0, meta_horas: 0 });
  useEffect(() => {
    if (data?.padrao) setPadrao(data.padrao);
  }, [data?.padrao]);

  const invalidar = () => qc.invalidateQueries({ queryKey: ["prospect-metas"] });

  const mutIndividual = useMutation({
    mutationFn: (v: { userId: string; meta_contatos: number; meta_vendas: number; meta_horas: number }) =>
      salvarUma({ data: v }),
    onSuccess: () => {
      toast.success("Meta da consultora atualizada.");
      invalidar();
    },
    onError: (e: any) => toast.error(e?.message ?? "Não foi possível salvar a meta."),
  });

  const mutRemover = useMutation({
    mutationFn: (userId: string) => removerUma({ data: { userId } }),
    onSuccess: () => {
      toast.success("Voltou para a meta padrão da equipe.");
      invalidar();
    },
    onError: (e: any) => toast.error(e?.message ?? "Não foi possível remover a meta."),
  });

  const mutPadrao = useMutation({
    mutationFn: () => salvarPadrao({ data: padrao }),
    onSuccess: () => {
      toast.success("Meta padrão da equipe salva.");
      invalidar();
    },
    onError: (e: any) => toast.error(e?.message ?? "Não foi possível salvar a meta padrão."),
  });

  return (
    <AppShell>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/15 text-primary">
            <Target className="h-5 w-5" />
          </div>
          <div>
            <h1 className="text-2xl font-bold">Metas por consultora</h1>
            <p className="text-sm text-muted-foreground">
              Meta da semana x o que já foi feito de verdade: contatos, vendas confirmadas e horas ativas.
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Select value={semana} onValueChange={setSemana}>
            <SelectTrigger className="w-64">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {semanas.map((s, i) => (
                <SelectItem key={s} value={s}>
                  {rotuloSemana(s, i)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button variant="outline" size="icon" onClick={() => refetch()} title="Atualizar">
            <RefreshCw className={`h-4 w-4 ${isFetching ? "animate-spin" : ""}`} />
          </Button>
          <Button variant="ghost" size="sm" asChild>
            <Link to="/prospeccao">
              <ArrowLeft className="mr-1 h-4 w-4" /> Prospecção
            </Link>
          </Button>
        </div>
      </div>

      {isLoading ? (
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3 md:grid-cols-6">
            {Array.from({ length: 6 }).map((_, i) => (
              <Skeleton key={i} className="h-24 w-full" />
            ))}
          </div>
          <Skeleton className="h-72 w-full" />
        </div>
      ) : error ? (
        <div className="rounded-xl border bg-card p-10 text-center text-sm text-muted-foreground">
          Não foi possível carregar as metas. Tente atualizar em alguns instantes.
        </div>
      ) : data ? (
        <div className="space-y-6">
          <MetasResumo dados={data} />

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Meta padrão da equipe</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex flex-wrap items-end gap-4">
                <label className="text-sm">
                  <span className="mb-1 block text-muted-foreground">Contatos</span>
                  <Input
                    type="number"
                    min={0}
                    className="w-28"
                    value={padrao.meta_contatos}
                    onChange={(e) => setPadrao((p) => ({ ...p, meta_contatos: Number(e.target.value) }))}
                  />
                </label>
                <label className="text-sm">
                  <span className="mb-1 block text-muted-foreground">Vendas confirmadas</span>
                  <Input
                    type="number"
                    min={0}
                    className="w-24"
                    value={padrao.meta_vendas}
                    onChange={(e) => setPadrao((p) => ({ ...p, meta_vendas: Number(e.target.value) }))}
                  />
                </label>
                <label className="text-sm">
                  <span className="mb-1 block text-muted-foreground">Horas ativas</span>
                  <Input
                    type="number"
                    min={0}
                    step="0.5"
                    className="w-24"
                    value={padrao.meta_horas}
                    onChange={(e) => setPadrao((p) => ({ ...p, meta_horas: Number(e.target.value) }))}
                  />
                </label>
                <Button onClick={() => mutPadrao.mutate()} disabled={mutPadrao.isPending}>
                  <Save className="mr-1 h-4 w-4" /> Salvar padrão
                </Button>
                <p className="text-xs text-muted-foreground">
                  Vale para todas as consultoras sem meta própria e continua valendo nas próximas semanas.
                </p>
              </div>
            </CardContent>
          </Card>

          <MetasTable
            dados={data}
            salvando={mutIndividual.isPending || mutRemover.isPending}
            onSalvar={(v) => mutIndividual.mutate(v)}
            onRemover={(id) => mutRemover.mutate(id)}
          />
        </div>
      ) : null}
    </AppShell>
  );
}
