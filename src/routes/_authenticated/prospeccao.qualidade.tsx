import { createFileRoute, Navigate, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useAuth } from "@/lib/auth";
import { useRhAccess } from "@/hooks/use-rh-access";
import { AppShell } from "@/components/AppShell";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { RhStatCard } from "@/components/rh/RhStatCard";
import { getCallQualityStats, type CallQualityStats } from "@/lib/prospeccao/prospeccao.functions";
import {
  ArrowLeft, PhoneCall, PhoneIncoming, Target, TrendingUp, Percent, Loader2,
} from "lucide-react";
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  LineChart, Line, ReferenceLine,
} from "recharts";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

export const Route = createFileRoute("/_authenticated/_authenticated/prospeccao/qualidade")({
  head: () => ({ meta: [{ title: "Qualidade de ligações — Prospecção" }, { name: "robots", content: "noindex,nofollow" }] }),
  component: Page,
});

function Page() {
  const { user, loading } = useAuth();
  const { isAdmin } = useRhAccess();
  const fetchStats = useServerFn(getCallQualityStats);
  const [stats, setStats] = useState<CallQualityStats | null>(null);
  const [loadingStats, setLoadingStats] = useState(true);

  useEffect(() => {
    if (!user || !isAdmin) return;
    let cancelled = false;
    setLoadingStats(true);
    fetchStats()
      .then((r) => { if (!cancelled) setStats(r); })
      .catch(() => { if (!cancelled) setStats(null); })
      .finally(() => { if (!cancelled) setLoadingStats(false); });
    return () => { cancelled = true; };
  }, [user, isAdmin, fetchStats]);

  if (loading) return null;
  if (!user) return <Navigate to="/login" />;
  if (!isAdmin) return <Navigate to="/prospeccao" />;

  return (
    <AppShell>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <div>
          <h1 className="text-2xl font-bold">Qualidade de ligações</h1>
          <p className="text-sm text-muted-foreground">Acompanhe a produtividade e a conversão das ligações nos últimos 7 dias.</p>
        </div>
        <Button asChild variant="ghost" size="sm"><Link to="/prospeccao/admin"><ArrowLeft className="mr-2 h-4 w-4" /> Painel admin</Link></Button>
      </div>

      {loadingStats && (
        <div className="flex items-center gap-2 py-10 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" /> Carregando indicadores…
        </div>
      )}

      {!loadingStats && stats && (
        <>
          <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
            <RhStatCard label="Ligações (7 dias)" value={stats.totalCalls7d} icon={PhoneCall} tone="sky" />
            <RhStatCard label="Média por dia" value={stats.avgPerDay} icon={TrendingUp} tone="violet" />
            <RhStatCard label="Atendidas" value={stats.answered7d} icon={PhoneIncoming} tone="emerald" />
            <RhStatCard label="Taxa de atendimento" value={`${stats.answerRate}%`} icon={Percent} tone="amber" />
            <RhStatCard label="Leads qualificados" value={stats.qualifiedLeads} icon={Target} tone="rose" />
          </div>

          <div className="mt-4 grid gap-4 lg:grid-cols-3">
            {/* Weekly average line chart */}
            <Card className="p-5 lg:col-span-2">
              <p className="mb-1 text-sm font-semibold">Ligações por dia (média da semana)</p>
              <p className="mb-4 text-xs text-muted-foreground">A linha tracejada mostra a média diária de {stats.avgPerDay} ligações.</p>
              <div className="h-72">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={stats.daily} margin={{ top: 8, right: 12, left: -16, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis dataKey="label" tick={{ fontSize: 12 }} stroke="hsl(var(--muted-foreground))" />
                    <YAxis allowDecimals={false} tick={{ fontSize: 12 }} stroke="hsl(var(--muted-foreground))" />
                    <Tooltip
                      contentStyle={{ background: "hsl(var(--popover))", border: "1px solid hsl(var(--border))", borderRadius: 8, fontSize: 12 }}
                      labelStyle={{ color: "hsl(var(--foreground))" }}
                    />
                    <Legend wrapperStyle={{ fontSize: 12 }} />
                    <ReferenceLine y={stats.avgPerDay} stroke="hsl(var(--primary))" strokeDasharray="4 4" />
                    <Line type="monotone" dataKey="total" name="Ligações" stroke="hsl(var(--primary))" strokeWidth={2} dot={{ r: 3 }} />
                    <Line type="monotone" dataKey="answered" name="Atendidas" stroke="#10b981" strokeWidth={2} dot={{ r: 3 }} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </Card>

            {/* Outcome breakdown */}
            <Card className="p-5">
              <p className="mb-4 text-sm font-semibold">Qualidade por resultado</p>
              {stats.outcomes.length === 0 && <p className="text-sm text-muted-foreground">Sem ligações registradas no período.</p>}
              <div className="h-72">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={stats.outcomes} layout="vertical" margin={{ top: 0, right: 12, left: 8, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" horizontal={false} />
                    <XAxis type="number" allowDecimals={false} tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" />
                    <YAxis type="category" dataKey="outcome" width={110} tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" />
                    <Tooltip
                      contentStyle={{ background: "hsl(var(--popover))", border: "1px solid hsl(var(--border))", borderRadius: 8, fontSize: 12 }}
                      cursor={{ fill: "hsl(var(--muted))" }}
                    />
                    <Bar dataKey="count" name="Ligações" fill="hsl(var(--primary))" radius={[0, 4, 4, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </Card>
          </div>

          {/* Per-consultant quality table */}
          <Card className="mt-4 p-5">
            <p className="mb-4 text-sm font-semibold">Desempenho por consultor (7 dias)</p>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Consultor</TableHead>
                  <TableHead className="text-right">Ligações</TableHead>
                  <TableHead className="text-right">Atendidas</TableHead>
                  <TableHead className="text-right">Taxa atend.</TableHead>
                  <TableHead className="text-right">Qualificados</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {stats.byConsultant.length === 0 && (
                  <TableRow><TableCell colSpan={5} className="text-center text-sm text-muted-foreground">Sem dados no período.</TableCell></TableRow>
                )}
                {stats.byConsultant.map((c) => (
                  <TableRow key={c.email}>
                    <TableCell className="font-medium">{c.email}</TableCell>
                    <TableCell className="text-right tabular-nums">{c.calls}</TableCell>
                    <TableCell className="text-right tabular-nums">{c.answered}</TableCell>
                    <TableCell className="text-right tabular-nums">{c.calls ? Math.round((c.answered / c.calls) * 100) : 0}%</TableCell>
                    <TableCell className="text-right tabular-nums">{c.qualified}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Card>
        </>
      )}
    </AppShell>
  );
}
