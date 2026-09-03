import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { ArrowDownRight, ArrowRight, ArrowUpRight } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { getEvolucaoProspeccao } from "@/lib/prospeccao/evolucao.functions";

function Delta({ atual, anterior }: { atual: number; anterior: number }) {
  const diff = atual - anterior;
  const pct = anterior === 0 ? (atual > 0 ? 100 : 0) : Math.round((diff / anterior) * 100);
  const Icon = diff > 0 ? ArrowUpRight : diff < 0 ? ArrowDownRight : ArrowRight;
  const tone =
    diff > 0
      ? "text-emerald-600 dark:text-emerald-400"
      : diff < 0
        ? "text-rose-600 dark:text-rose-400"
        : "text-muted-foreground";
  return (
    <span className={`inline-flex items-center gap-1 text-xs font-semibold ${tone}`}>
      <Icon className="h-3.5 w-3.5" />
      {diff > 0 ? "+" : ""}
      {pct}% vs. semana anterior
    </span>
  );
}

/** Comparativo semana a semana e mês a mês da prospecção (admin). */
export function EvolucaoProspeccaoPanel() {
  const fetchEvolucao = useServerFn(getEvolucaoProspeccao);
  const { data, isLoading } = useQuery({
    queryKey: ["prospeccao", "evolucao"],
    queryFn: () => fetchEvolucao(),
    refetchInterval: 120_000,
  });

  if (isLoading || !data) {
    return (
      <div className="grid gap-4 lg:grid-cols-2">
        <Skeleton className="h-[220px] w-full" />
        <Skeleton className="h-[220px] w-full" />
      </div>
    );
  }

  const cards = [
    { label: "Contatos (ligação + WhatsApp)", a: data.semanaAtual.contatos, b: data.semanaAnterior.contatos },
    { label: "Follow-ups criados", a: data.semanaAtual.followups, b: data.semanaAnterior.followups },
    { label: "Leads trabalhados", a: data.semanaAtual.leadsTrabalhados, b: data.semanaAnterior.leadsTrabalhados },
  ];

  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-3">
        {cards.map((c) => (
          <Card key={c.label}>
            <CardHeader className="pb-1">
              <CardDescription className="text-xs">{c.label}</CardDescription>
              <CardTitle className="text-2xl">{c.a.toLocaleString("pt-BR")}</CardTitle>
            </CardHeader>
            <CardContent className="pt-0">
              <Delta atual={c.a} anterior={c.b} />
              <p className="mt-1 text-[11px] text-muted-foreground">
                Semana anterior: {c.b.toLocaleString("pt-BR")}
              </p>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Nível de prospecção mês a mês</CardTitle>
          <CardDescription>Contatos, follow-ups e leads trabalhados nos últimos 6 meses.</CardDescription>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={data.meses} margin={{ left: 4, right: 12 }}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
              <XAxis dataKey="label" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
              <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8 }} />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              <Bar dataKey="contatos" name="Contatos" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
              <Bar dataKey="followups" name="Follow-ups" fill="hsl(var(--chart-2, 200 80% 45%))" radius={[4, 4, 0, 0]} />
              <Bar
                dataKey="leadsTrabalhados"
                name="Leads trabalhados"
                fill="hsl(var(--chart-4, 24 85% 55%))"
                radius={[4, 4, 0, 0]}
              />
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>
    </div>
  );
}
