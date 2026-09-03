import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { getProspeccaoCharts, type SerieItem } from "@/lib/prospeccao/charts.functions";

const CORES = [
  "hsl(var(--primary))",
  "hsl(var(--chart-2, 200 80% 45%))",
  "hsl(var(--chart-3, 262 70% 55%))",
  "hsl(var(--chart-4, 24 85% 55%))",
  "hsl(var(--chart-5, 150 60% 40%))",
  "hsl(var(--muted-foreground))",
];

const curto = (s: string, n = 16) => (s.length > n ? `${s.slice(0, n)}…` : s);

function Vazio() {
  return (
    <div className="flex h-[240px] items-center justify-center text-sm text-muted-foreground">
      Sem dados no período.
    </div>
  );
}

function Barras({ dados, destaque }: { dados: SerieItem[]; destaque?: string | null }) {
  if (dados.length === 0) return <Vazio />;
  return (
    <ResponsiveContainer width="100%" height={240}>
      <BarChart data={dados} layout="vertical" margin={{ left: 8, right: 12 }}>
        <CartesianGrid strokeDasharray="3 3" horizontal={false} className="stroke-border" />
        <XAxis type="number" tick={{ fontSize: 11 }} allowDecimals={false} />
        <YAxis
          type="category"
          dataKey="label"
          width={120}
          tick={{ fontSize: 11 }}
          tickFormatter={(v: string) => curto(v)}
        />
        <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8 }} formatter={(v: number) => [v, "Total"]} />
        <Bar dataKey="valor" radius={[0, 4, 4, 0]}>
          {dados.map((d, i) => (
            <Cell
              key={i}
              fill={
                destaque && d.label === destaque
                  ? "hsl(var(--primary))"
                  : "hsl(var(--muted-foreground) / 0.5)"
              }
            />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}

/** Indicadores visuais da prospecção, disponíveis para as consultoras. */
export function ProspeccaoCharts() {
  const fetchCharts = useServerFn(getProspeccaoCharts);
  const { data, isLoading } = useQuery({
    queryKey: ["prospeccao", "charts"],
    queryFn: () => fetchCharts(),
    refetchInterval: 120_000,
    refetchOnWindowFocus: true,
  });

  if (isLoading || !data) {
    return (
      <div className="grid gap-4 lg:grid-cols-2">
        {Array.from({ length: 3 }).map((_, i) => (
          <Skeleton key={i} className="h-[300px] w-full" />
        ))}
      </div>
    );
  }

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Leads por consultora</CardTitle>
          <CardDescription>
            Promovidos distribuídos, top 10{data.minhaConsultora ? " — você em destaque" : ""}.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Barras dados={data.leadsPorConsultora} destaque={data.minhaConsultora} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Follow-ups por origem</CardTitle>
          <CardDescription>De onde vêm os acompanhamentos agendados.</CardDescription>
        </CardHeader>
        <CardContent>
          {data.followupsPorOrigem.length === 0 ? (
            <Vazio />
          ) : (
            <ResponsiveContainer width="100%" height={240}>
              <PieChart>
                <Pie
                  data={data.followupsPorOrigem}
                  dataKey="valor"
                  nameKey="label"
                  innerRadius={50}
                  outerRadius={90}
                  paddingAngle={2}
                >
                  {data.followupsPorOrigem.map((_, i) => (
                    <Cell key={i} fill={CORES[i % CORES.length]} />
                  ))}
                </Pie>
                <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8 }} />
              </PieChart>
            </ResponsiveContainer>
          )}
        </CardContent>
      </Card>

      <Card className="lg:col-span-2">
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Evolução da minha carteira</CardTitle>
          <CardDescription>Tomadores atribuídos a você por dia (14 dias).</CardDescription>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={240}>
            <LineChart data={data.evolucaoCarteira} margin={{ left: 4, right: 12 }}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
              <XAxis
                dataKey="dia"
                tick={{ fontSize: 11 }}
                tickFormatter={(d: string) => `${d.slice(8, 10)}/${d.slice(5, 7)}`}
              />
              <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
              <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8 }} />
              <Line
                type="monotone"
                dataKey="atribuidos"
                stroke="hsl(var(--primary))"
                strokeWidth={2}
                dot={false}
              />
            </LineChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>
    </div>
  );
}
