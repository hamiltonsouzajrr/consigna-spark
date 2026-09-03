// Central de Comando do CRM na visão do ADMINISTRADOR.
// Consultoras continuam vendo o CrmCockpit operacional (meta, ligações, follow-ups).
// Aqui o foco é gestão: saúde da operação, cobertura da carteira, desempenho por
// consultora/origem e atalhos para as ações administrativas.
import { Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { CompeticaoRanking } from "@/components/prospeccao/CompeticaoRanking";
import { getAdminStats } from "@/lib/prospeccao/prospeccao.functions";
import { getAdminHealth } from "@/lib/admin/health.functions";
import { STATUS_LABEL, type LeadStatus } from "@/lib/prospeccao/constants";
import { cn } from "@/lib/utils";
import {
  Activity, AlertTriangle, Ghost, Layers, Radar, ShieldAlert, Share2, Trophy,
  Users, UploadCloud, ChevronRight, Settings2, BarChart3,
} from "lucide-react";

function Metric({
  label, value, tone, hint, to,
}: {
  label: string;
  value: string | number;
  tone?: string;
  hint?: string;
  to?: string;
}) {
  const inner = (
    <div className="rounded-lg border bg-muted/30 p-2.5 transition hover:bg-muted/60">
      <p className="text-[11px] leading-tight text-muted-foreground">{label}</p>
      <p className={cn("mt-0.5 text-lg font-bold tabular-nums", tone)}>{value}</p>
      {hint && <p className="mt-0.5 text-[10px] text-muted-foreground">{hint}</p>}
    </div>
  );
  if (!to) return inner;
  return <Link to={to as never} className="block">{inner}</Link>;
}

function quando(iso: string | null) {
  if (!iso) return "nunca";
  return new Date(iso).toLocaleString("pt-BR", {
    day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit",
  });
}

export function CrmCockpitAdmin() {
  const fetchStats = useServerFn(getAdminStats);
  const fetchHealth = useServerFn(getAdminHealth);

  const statsQ = useQuery({
    queryKey: ["prospect", "admin-stats"],
    queryFn: () => fetchStats(),
    staleTime: 120_000,
  });
  const healthQ = useQuery({
    queryKey: ["admin", "health"],
    queryFn: () => fetchHealth(),
    staleTime: 120_000,
  });

  const stats = statsQ.data;
  const health = healthQ.data;

  const statusRows = Object.entries(stats?.porStatus ?? {})
    .sort((a, b) => b[1] - a[1]);
  const maxStatus = Math.max(1, ...statusRows.map(([, n]) => n));

  const semDono =
    (health?.leadsSemConsultora ?? 0) +
    (health?.promovidosSemConsultora ?? 0) +
    (health?.tomadoresLivres ?? 0);

  return (
    <div className="grid gap-4 xl:grid-cols-3">
      {/* 1. Saúde da operação */}
      <Card className="flex flex-col gap-4 p-4">
        <div className="flex items-center gap-2">
          <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-primary/15 text-primary">
            <Activity className="h-4.5 w-4.5" />
          </span>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold">Saúde da operação</p>
            <p className="text-xs text-muted-foreground">Visão exclusiva do administrador</p>
          </div>
          {semDono > 0 && (
            <Badge variant="outline" className="gap-1 text-[10px] text-amber-600 dark:text-amber-400">
              <AlertTriangle className="h-3 w-3" /> {semDono} sem dono
            </Badge>
          )}
        </div>

        {healthQ.isPending && <Skeleton className="h-40 w-full" />}

        {health && (
          <>
            <div className="rounded-lg border p-3">
              <p className="flex items-center gap-2 text-xs font-medium">
                <Radar className="h-3.5 w-3.5 text-primary" /> Radar Diário Oficial
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                Última execução: {quando(health.radarUltimaExecucao)} · status{" "}
                <span className="font-medium">{health.radarUltimoStatus ?? "—"}</span>
              </p>
              <Button asChild size="sm" variant="ghost" className="mt-1 h-7 px-2 text-xs">
                <Link to="/radar/busca-diaria">Abrir Radar <ChevronRight className="ml-1 h-3 w-3" /></Link>
              </Button>
            </div>

            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
              <Metric label="Leads sem consultora" value={health.leadsSemConsultora}
                tone={health.leadsSemConsultora ? "text-amber-600 dark:text-amber-400" : undefined}
                to="/prospeccao/admin" />
              <Metric label="Promovidos sem dono" value={health.promovidosSemConsultora}
                tone={health.promovidosSemConsultora ? "text-amber-600 dark:text-amber-400" : undefined}
                to="/prospeccao/promovidos-recentes" />
              <Metric label="Tomadores livres" value={health.tomadoresLivres} to="/tomadores-al" />
              <Metric label="Promovidos 15 dias" value={health.promovidosUltimos15Dias} />
              <Metric label="Consultoras ativas" value={health.consultorasAtivas} />
              <Metric label="Inativas 7 dias" value={health.consultorasInativas7d}
                tone={health.consultorasInativas7d ? "text-rose-600 dark:text-rose-400" : undefined} />
            </div>

            <div className="mt-auto flex flex-wrap gap-2 text-xs text-muted-foreground">
              <span className="inline-flex items-center gap-1">
                <ShieldAlert className="h-3 w-3 text-rose-500" /> {health.incidentesAbertos} incidente(s)
              </span>
              <span className="inline-flex items-center gap-1">
                <Users className="h-3 w-3" /> {health.contasBloqueadas} conta(s) bloqueada(s)
              </span>
              <span className="inline-flex items-center gap-1">
                <Settings2 className="h-3 w-3" /> {health.admins} admin(s)
              </span>
            </div>
          </>
        )}
      </Card>

      {/* 2. Cobertura da carteira */}
      <Card className="flex flex-col gap-4 p-4">
        <div className="flex items-center gap-2">
          <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-sky-500/15 text-sky-600 dark:text-sky-400">
            <Layers className="h-4.5 w-4.5" />
          </span>
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold">Cobertura da carteira</p>
            <p className="text-xs text-muted-foreground">Base completa de leads de prospecção</p>
          </div>
        </div>

        {statsQ.isPending && <Skeleton className="h-48 w-full" />}

        {stats && (
          <>
            <div className="grid grid-cols-3 gap-2">
              <Metric label="Total de leads" value={stats.totalLeads} />
              <Metric label="Sem tratativa" value={stats.semTratativa}
                tone="text-amber-600 dark:text-amber-400" />
              <Metric label="Esquecidos 3d+" value={stats.esquecidos}
                tone="text-rose-600 dark:text-rose-400" />
            </div>

            <div className="space-y-1.5">
              <p className="text-xs text-muted-foreground">Distribuição por status</p>
              {statusRows.slice(0, 7).map(([status, total]) => (
                <div key={status} className="flex items-center gap-2 text-xs">
                  <span className="w-24 shrink-0 truncate text-muted-foreground">
                    {STATUS_LABEL[status as LeadStatus] ?? status}
                  </span>
                  <div className="h-2 flex-1 overflow-hidden rounded-full bg-muted">
                    <div className="h-full rounded-full bg-primary/70"
                      style={{ width: `${Math.round((total / maxStatus) * 100)}%` }} />
                  </div>
                  <span className="w-12 shrink-0 text-right tabular-nums">{total}</span>
                </div>
              ))}
              {statusRows.length === 0 && (
                <p className="text-xs text-muted-foreground">Nenhum lead na base.</p>
              )}
            </div>

            <div className="mt-auto space-y-1.5">
              <p className="text-xs text-muted-foreground">Origens com melhor conversão</p>
              {stats.porOrigem.slice(0, 4).map((o) => (
                <div key={o.origem} className="flex items-center justify-between gap-2 text-xs">
                  <span className="min-w-0 truncate">{o.origem}</span>
                  <span className="shrink-0 tabular-nums text-muted-foreground">
                    {o.total} · {o.conversao}%
                  </span>
                </div>
              ))}
              {stats.porOrigem.length === 0 && (
                <p className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                  <Ghost className="h-3 w-3" /> Sem origens registradas.
                </p>
              )}
            </div>
          </>
        )}
      </Card>

      {/* 3. Desempenho + ações */}
      <div className="flex flex-col gap-4">
        <Card className="p-4">
          <div className="flex items-center gap-2">
            <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-amber-500/15 text-amber-600 dark:text-amber-400">
              <Trophy className="h-4.5 w-4.5" />
            </span>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold">Top consultoras</p>
              <p className="text-xs text-muted-foreground">Por ganhos e volume da carteira</p>
            </div>
            <Button asChild size="sm" variant="ghost">
              <Link to="/prospeccao/admin">Painel <ChevronRight className="ml-1 h-3.5 w-3.5" /></Link>
            </Button>
          </div>

          <div className="mt-3 space-y-1.5">
            {statsQ.isPending && <Skeleton className="h-24 w-full" />}
            {(stats?.ranking ?? []).slice(0, 6).map((r, i) => (
              <div key={r.consultantId ?? "none"} className="flex items-center gap-2 rounded-lg border p-2 text-xs">
                <span className="grid h-6 w-6 shrink-0 place-items-center rounded-md bg-muted font-semibold">
                  {i + 1}
                </span>
                <span className="min-w-0 flex-1 truncate">{r.email}</span>
                <span className="shrink-0 tabular-nums text-muted-foreground">
                  {r.total} leads · {r.ganhos} ganhos · {r.conversao}%
                </span>
              </div>
            ))}
            {!statsQ.isPending && !stats?.ranking.length && (
              <p className="rounded-lg border border-dashed p-3 text-xs text-muted-foreground">
                Nenhuma consultora com leads atribuídos.
              </p>
            )}
          </div>

          <div className="mt-3 grid grid-cols-2 gap-2">
            <Button asChild size="sm" variant="outline" className="text-xs">
              <Link to="/prospeccao/admin"><Share2 className="mr-1 h-3.5 w-3.5" /> Distribuir</Link>
            </Button>
            <Button asChild size="sm" variant="outline" className="text-xs">
              <Link to="/prospeccao/admin/leads"><UploadCloud className="mr-1 h-3.5 w-3.5" /> Importar</Link>
            </Button>
            <Button asChild size="sm" variant="outline" className="text-xs">
              <Link to="/prospeccao/qualidade"><BarChart3 className="mr-1 h-3.5 w-3.5" /> Qualidade</Link>
            </Button>
            <Button asChild size="sm" variant="outline" className="text-xs">
              <Link to="/rh/acessos"><Users className="mr-1 h-3.5 w-3.5" /> Acessos</Link>
            </Button>
          </div>
        </Card>

        <Link to="/producao/competicao" className="block">
          <CompeticaoRanking compact />
        </Link>
      </div>
    </div>
  );
}
