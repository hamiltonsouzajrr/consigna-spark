import { createFileRoute, Link, useNavigate, notFound } from "@tanstack/react-router";
import { useSuspenseQuery } from "@tanstack/react-query";
import { zodValidator, fallback } from "@tanstack/zod-adapter";
import { z } from "zod";
import { ArrowLeft } from "lucide-react";
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
} from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { RhPageHeader } from "@/components/rh/RhLayout";
import { formatDate } from "@/lib/rh/mock";
import {
  kpiDetailQueryOptions,
  KPI_KEYS,
  PERIODS,
  type KpiKey,
  type PeriodKey,
} from "@/lib/rh/portal";

const searchSchema = z.object({
  periodo: fallback(z.enum(["3m", "6m", "12m"]), "6m").default("6m"),
});

export const Route = createFileRoute("/rh/portal/$kpi")({
  validateSearch: zodValidator(searchSchema),
  beforeLoad: ({ params }) => {
    if (!KPI_KEYS.includes(params.kpi as KpiKey)) throw notFound();
  },
  component: KpiDetailPage,
  errorComponent: ({ error }) => (
    <div role="alert" className="p-6 text-sm text-destructive">{error.message}</div>
  ),
  notFoundComponent: () => (
    <div className="p-6 text-sm">
      Indicador não encontrado. <Link to="/rh/portal" className="text-primary underline">Voltar ao portal</Link>
    </div>
  ),
});

function KpiDetailPage() {
  const { kpi } = Route.useParams();
  const { periodo } = Route.useSearch();
  const navigate = useNavigate({ from: "/rh/portal/$kpi" });

  const { data } = useSuspenseQuery(kpiDetailQueryOptions(kpi as KpiKey, periodo));

  return (
    <div>
      <div className="mb-4">
        <Button asChild variant="ghost" size="sm" className="-ml-2">
          <Link to="/rh/portal"><ArrowLeft className="mr-1 h-4 w-4" /> Voltar ao portal</Link>
        </Button>
      </div>

      <RhPageHeader
        title={data.title}
        description={data.description}
        actions={
          <Tabs
            value={periodo}
            onValueChange={(v) =>
              navigate({ search: (prev) => ({ ...prev, periodo: v as PeriodKey }) })
            }
          >
            <TabsList>
              {PERIODS.map((p) => (
                <TabsTrigger key={p.value} value={p.value}>{p.label}</TabsTrigger>
              ))}
            </TabsList>
          </Tabs>
        }
      />

      <div className="mb-6 grid gap-4 sm:grid-cols-3">
        {data.resumo.map((r) => (
          <Card key={r.label} className="p-5">
            <p className="text-sm text-muted-foreground">{r.label}</p>
            <p className="mt-2 text-2xl font-bold tracking-tight">{r.value}</p>
          </Card>
        ))}
      </div>

      <Card className="mb-6">
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Evolução no período</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={data.serie} margin={{ top: 8, right: 8, left: -16, bottom: 0 }}>
                <defs>
                  <linearGradient id="kpiFill" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="hsl(var(--primary))" stopOpacity={0.4} />
                    <stop offset="100%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                <XAxis dataKey="mes" fontSize={12} tickLine={false} axisLine={false} />
                <YAxis fontSize={12} tickLine={false} axisLine={false} width={48} />
                <Tooltip
                  contentStyle={{
                    background: "hsl(var(--popover))",
                    border: "1px solid hsl(var(--border))",
                    borderRadius: 8,
                    fontSize: 12,
                  }}
                  formatter={(v: number) => [`${v} ${data.unidade}`, data.title]}
                />
                <Area type="monotone" dataKey="valor" stroke="hsl(var(--primary))" strokeWidth={2} fill="url(#kpiFill)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Histórico</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {data.historico.length ? (
            data.historico.map((h, i) => (
              <div key={i} className="flex items-center justify-between border-b py-2 text-sm last:border-0">
                <div className="min-w-0">
                  <p className="font-medium">{h.descricao}</p>
                  <p className="text-xs text-muted-foreground">
                    {h.data.includes("-") ? formatDate(h.data) : h.data}
                  </p>
                </div>
                <Badge variant="outline">{h.valor}</Badge>
              </div>
            ))
          ) : (
            <p className="text-sm text-muted-foreground">Sem registros no período.</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
