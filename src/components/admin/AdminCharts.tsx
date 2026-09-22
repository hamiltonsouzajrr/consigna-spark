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
import { getAdminCharts, type SerieItem } from "@/lib/admin/charts.functions";

const CORES = [
  "var(--chart-1)",
  "var(--chart-2)",
  "var(--chart-3)",
  "var(--chart-4)",
  "var(--chart-5)",
  "var(--muted-foreground)",
];

const curto = (s: string, n = 16) => (s.length > n ? `${s.slice(0, n)}…` : s);

function Barras({ dados }: { dados: SerieItem[] }) {
  if (dados.length === 0) return <Vazio />;
  return (
    <ResponsiveContainer width="100%" height={260}>
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
        <Tooltip
          contentStyle={{ fontSize: 12, borderRadius: 8 }}
          formatter={(v: number) => [v, "Total"]}
        />
        <Bar dataKey="valor" fill="var(--chart-1)" radius={[0, 4, 4, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}

function Vazio() {
  return (
    <div className="flex h-[260px] items-center justify-center text-sm text-muted-foreground">
      Sem dados no período.
    </div>
  );
}

/** Gráficos do hub admin, revalidados automaticamente a cada 60s. */
export function AdminCharts() {
  const fetchCharts = useServerFn(getAdminCharts);
  const { data, isLoading } = useQuery({
    queryKey: ["admin", "charts"],
    queryFn: () => fetchCharts(),
    refetchInterval: 60_000,
    refetchOnWindowFocus: true,
  });

  if (isLoading || !data) {
    return (
      <div className="grid gap-4 lg:grid-cols-2">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-[320px] w-full" />
        ))}
      </div>
    );
  }

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <Card className="shadow-sm">
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Leads por consultora</CardTitle>
          <CardDescription>Promovidos distribuídos, top 10.</CardDescription>
        </CardHeader>
        <CardContent>
          <Barras dados={data.leadsPorConsultora} />
        </CardContent>
      </Card>

      <Card className="shadow-sm">
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Follow-ups por consultora</CardTitle>
          <CardDescription>Tarefas de acompanhamento registradas, top 10.</CardDescription>
        </CardHeader>
        <CardContent>
          <Barras dados={data.followupsPorConsultora} />
        </CardContent>
      </Card>

      <Card className="shadow-sm">
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Tomadores por origem</CardTitle>
          <CardDescription>Distribuição do estoque por órgão.</CardDescription>
        </CardHeader>
        <CardContent>
          {data.tomadoresPorOrigem.length === 0 ? (
            <Vazio />
          ) : (
            <ResponsiveContainer width="100%" height={260}>
              <PieChart>
                <Pie
                  data={data.tomadoresPorOrigem}
                  dataKey="valor"
                  nameKey="label"
                  innerRadius={55}
                  outerRadius={95}
                  paddingAngle={2}
                >
                  {data.tomadoresPorOrigem.map((_, i) => (
                    <Cell key={i} fill={CORES[i % CORES.length]} />
                  ))}
                </Pie>
                <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8 }} />
              </PieChart>
            </ResponsiveContainer>
          )}
        </CardContent>
      </Card>

      <Card className="shadow-sm">
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Evolução da carteira</CardTitle>
          <CardDescription>Tomadores atribuídos por dia (14 dias).</CardDescription>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={260}>
            <LineChart data={data.evolucaoCarteira} margin={{ left: 4, right: 12 }}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
              <XAxis
                dataKey="dia"
                tick={{ fontSize: 11 }}
                tickFormatter={(d: string) => d.slice(8, 10) + "/" + d.slice(5, 7)}
              />
              <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
              <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8 }} />
              <Line
                type="monotone"
                dataKey="atribuidos"
                 stroke="var(--chart-1)"
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
