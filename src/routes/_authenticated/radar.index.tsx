import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useAuth } from "@/lib/auth";
import { Card } from "@/components/ui/card";
import { toast } from "sonner";
import { Loader2, FileText, Users, BadgeCheck, TrendingUp, Clock, Target, Phone, CheckCircle2, XCircle } from "lucide-react";
import {
  BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from "recharts";
import { getDashboard, type DashboardData } from "@/lib/radar/radar.functions";

export const Route = createFileRoute("/radar/")({
  component: DashboardPage,
});

function DashboardPage() {
  const { user } = useAuth();
  const fetchDash = useServerFn(getDashboard);
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    (async () => {
      try {
        setData(await fetchDash());
      } catch (e: any) {
        toast.error(e?.message ?? "Erro ao carregar dashboard.");
      } finally {
        setLoading(false);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  if (loading || !data) {
    return (
      <div className="flex min-h-[30vh] items-center justify-center text-muted-foreground">
        <Loader2 className="h-6 w-6 animate-spin" />
      </div>
    );
  }

  const kpis = [
    { label: "Arquivos analisados", value: data.totalArquivos, icon: FileText },
    { label: "Pessoas encontradas", value: data.totalPessoas, icon: Users },
    { label: "Promoções confirmadas", value: data.promocoesConfirmadas, icon: BadgeCheck },
    { label: "Progressões funcionais", value: data.progressoes, icon: TrendingUp },
    { label: "Pendentes de revisão", value: data.pendentes, icon: Clock },
  ];

  const pipeline = [
    { label: "Oportunidades novas", value: data.pipeline.oportunidadesNovas, icon: Target, emoji: "🎯", tone: "text-emerald-600 dark:text-emerald-400" },
    { label: "Em contato", value: data.pipeline.emContato, icon: Phone, emoji: "📞", tone: "text-blue-600 dark:text-blue-400" },
    { label: "Convertidos", value: data.pipeline.convertidos, icon: CheckCircle2, emoji: "✅", tone: "text-emerald-600 dark:text-emerald-400" },
    { label: "Sem interesse", value: data.pipeline.semInteresse, icon: XCircle, emoji: "❌", tone: "text-muted-foreground" },
  ];

  return (
    <div className="space-y-5">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        {kpis.map((k) => {
          const Icon = k.icon;
          return (
            <Card key={k.label} className="p-4">
              <div className="flex items-center justify-between">
                <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{k.label}</p>
                <Icon className="h-4 w-4 text-primary" />
              </div>
              <p className="mt-2 text-3xl font-bold tabular-nums">{k.value}</p>
            </Card>
          );
        })}
      </div>

      <Card className="p-4">
        <h3 className="mb-3 text-sm font-semibold">Pipeline de Abordagem</h3>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {pipeline.map((p) => (
            <div key={p.label} className="rounded-lg border p-4">
              <div className="flex items-center justify-between">
                <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{p.label}</p>
                <span className="text-lg leading-none">{p.emoji}</span>
              </div>
              <p className={`mt-2 text-3xl font-bold tabular-nums ${p.tone}`}>{p.value}</p>
            </div>
          ))}
        </div>
      </Card>


      <div className="grid gap-4 lg:grid-cols-2">
        <Card className="p-4">
          <h3 className="mb-3 text-sm font-semibold">Movimentações por tipo</h3>
          {data.porTipo.length === 0 ? (
            <Empty />
          ) : (
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={data.porTipo} layout="vertical" margin={{ left: 16, right: 16 }}>
                <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                <XAxis type="number" allowDecimals={false} fontSize={11} />
                <YAxis type="category" dataKey="tipo" width={150} fontSize={10} />
                <Tooltip />
                <Bar dataKey="total" fill="hsl(var(--primary))" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </Card>

        <Card className="p-4">
          <h3 className="mb-3 text-sm font-semibold">Registros por data de publicação</h3>
          {data.porData.length === 0 ? (
            <Empty />
          ) : (
            <ResponsiveContainer width="100%" height={280}>
              <LineChart data={data.porData} margin={{ left: 8, right: 16 }}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="data" fontSize={10} />
                <YAxis allowDecimals={false} fontSize={11} />
                <Tooltip />
                <Line type="monotone" dataKey="total" stroke="hsl(var(--primary))" strokeWidth={2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          )}
        </Card>
      </div>

      <Card className="p-4">
        <h3 className="mb-3 text-sm font-semibold">Órgãos com mais movimentações</h3>
        {data.topOrgaos.length === 0 ? (
          <Empty />
        ) : (
          <div className="space-y-2">
            {data.topOrgaos.map((o) => {
              const max = data.topOrgaos[0].total || 1;
              return (
                <div key={o.orgao} className="flex items-center gap-3">
                  <span className="w-56 shrink-0 truncate text-sm" title={o.orgao}>{o.orgao}</span>
                  <div className="h-3 flex-1 overflow-hidden rounded-full bg-muted">
                    <div className="h-full rounded-full bg-primary" style={{ width: `${(o.total / max) * 100}%` }} />
                  </div>
                  <span className="w-10 text-right text-sm tabular-nums">{o.total}</span>
                </div>
              );
            })}
          </div>
        )}
      </Card>
    </div>
  );
}

function Empty() {
  return <p className="py-12 text-center text-sm text-muted-foreground">Sem dados ainda.</p>;
}
