// Cartão de saúde do Radar Diário Oficial (visão do administrador).
// Mostra se a automação está capturando edições, se há itens presos na fila e
// permite destravar a fila manualmente.

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Activity, AlertTriangle, CheckCircle2, Loader2, Unlock } from "lucide-react";
import { getRadarSaude, destravarFilaRadar } from "@/lib/radar/diario.functions";

function fmt(dt: string | null): string {
  if (!dt) return "—";
  const d = new Date(dt.length === 10 ? `${dt}T12:00:00Z` : dt);
  return d.toLocaleString("pt-BR", { dateStyle: "short", timeStyle: dt.length === 10 ? undefined : "short" });
}

export function RadarSaudeCard() {
  const fetchSaude = useServerFn(getRadarSaude);
  const destravar = useServerFn(destravarFilaRadar);
  const qc = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ["radar-saude"],
    queryFn: () => fetchSaude(),
    refetchInterval: 120_000,
  });

  const mut = useMutation({
    mutationFn: () => destravar(),
    onSuccess: (r: any) => {
      toast.success(
        `Fila destravada: ${r.liberados} liberado(s), ${r.falhados} marcado(s) como erro, ${r.jobsFechados} job(s) encerrado(s).`,
      );
      void qc.invalidateQueries({ queryKey: ["radar-saude"] });
    },
    onError: (e: any) => toast.error(e?.message ?? "Não foi possível destravar a fila."),
  });

  if (isLoading || !data) {
    return (
      <Card className="flex items-center gap-2 p-4 text-sm text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" /> Verificando saúde do Radar…
      </Card>
    );
  }

  const tone =
    data.status === "ok"
      ? "text-emerald-600 dark:text-emerald-400"
      : data.status === "atencao"
        ? "text-amber-600 dark:text-amber-400"
        : "text-destructive";
  const Icon = data.status === "ok" ? CheckCircle2 : AlertTriangle;

  const itens = [
    { label: "Última edição", value: fmt(data.ultimaEdicao) },
    { label: "Última execução", value: fmt(data.ultimaExecucao) },
    { label: "Última entrega", value: fmt(data.ultimaEntrega) },
    { label: "Edições (7 dias)", value: String(data.edicoes7d) },
    { label: "Registros (7 dias)", value: String(data.registros7d) },
    { label: "Entregues (24h)", value: String(data.leadsDistribuidos24h) },
    { label: "Itens presos", value: String(data.itensPresos) },
    { label: "Aguardando liberação", value: String(data.aguardandoLiberacao) },
  ];

  return (
    <Card className="p-4">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <h3 className="flex items-center gap-2 text-sm font-semibold">
          <Activity className="h-4 w-4 text-primary" />
          Saúde da automação
          <Badge variant="outline" className={tone}>
            <Icon className="mr-1 h-3 w-3" />
            {data.status === "ok" ? "Rodando" : data.status === "atencao" ? "Atenção" : "Crítico"}
          </Badge>
        </h3>
        <Button size="sm" variant="outline" disabled={mut.isPending} onClick={() => mut.mutate()}>
          {mut.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Unlock className="mr-2 h-4 w-4" />}
          Destravar fila
        </Button>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {itens.map((i) => (
          <div key={i.label} className="rounded-lg border p-3">
            <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">{i.label}</p>
            <p className="mt-1 text-lg font-semibold tabular-nums">{i.value}</p>
          </div>
        ))}
      </div>

      {data.diasEmBranco.length > 0 && (
        <p className="mt-3 text-xs text-amber-600 dark:text-amber-400">
          Dias úteis sem edição capturada: {data.diasEmBranco.join(", ")} — a varredura noturna tentará novamente.
        </p>
      )}
    </Card>
  );
}
