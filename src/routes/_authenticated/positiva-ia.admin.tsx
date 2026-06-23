import { createFileRoute, Navigate, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useAuth } from "@/lib/auth";
import { useRhAccess } from "@/hooks/use-rh-access";
import { AppShell } from "@/components/AppShell";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { getAdminDashboard } from "@/lib/positiva/positiva.functions";
import { ATIVIDADE_LABEL, classificacaoScore, type AtividadeTipo } from "@/lib/positiva/constants";
import { ArrowLeft, AlertTriangle, Trophy, Gauge } from "lucide-react";

export const Route = createFileRoute("/positiva-ia/admin")({
  head: () => ({
    meta: [
      { title: "Painel Administrativo — POSITIVA IA" },
      { name: "robots", content: "noindex,nofollow" },
    ],
  }),
  component: Page,
});

function Page() {
  const { user, loading } = useAuth();
  const { isAdmin, isLoading } = useRhAccess();
  const fetchDash = useServerFn(getAdminDashboard);
  const [data, setData] = useState<Awaited<ReturnType<typeof getAdminDashboard>> | null>(null);
  const [err, setErr] = useState(false);

  useEffect(() => {
    if (!isAdmin) return;
    fetchDash().then(setData).catch(() => setErr(true));
  }, [isAdmin, fetchDash]);

  if (loading || isLoading) return null;
  if (!user) return <Navigate to="/login" />;
  if (!isAdmin) return <Navigate to="/positiva-ia" />;

  const tipos: AtividadeTipo[] = ["ligacao", "prospeccao", "proposta", "followup", "contrato", "reativacao"];

  return (
    <AppShell>
      <div className="mb-6 flex items-center gap-3">
        <Link to="/positiva-ia"><Button variant="ghost" size="icon"><ArrowLeft className="h-5 w-5" /></Button></Link>
        <div>
          <h1 className="text-2xl font-bold">Painel Administrativo — POSITIVA IA</h1>
          <p className="text-sm text-muted-foreground">Indicadores do dia (visível apenas para administradores).</p>
        </div>
      </div>

      {err && <Card className="p-6 text-sm text-muted-foreground">Não foi possível carregar os indicadores.</Card>}
      {!err && !data && <Card className="p-6 text-sm text-muted-foreground">Carregando…</Card>}

      {data && (
        <div className="space-y-6">
          <div className="grid grid-cols-2 gap-2 md:grid-cols-4 lg:grid-cols-7">
            {tipos.map((t) => (
              <Card key={t} className="p-3 text-center">
                <p className="text-xs text-muted-foreground">{ATIVIDADE_LABEL[t]}</p>
                <p className="text-2xl font-bold tabular-nums">{data.totals[t] ?? 0}</p>
              </Card>
            ))}
            <Card className="p-3 text-center">
              <p className="text-xs text-muted-foreground">Conversão</p>
              <p className="text-2xl font-bold tabular-nums">{data.conversao}%</p>
            </Card>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <Card className="p-5">
              <h3 className="mb-3 flex items-center gap-2 font-bold"><Gauge className="h-4 w-4" /> Energia da equipe</h3>
              <p className="text-4xl font-extrabold">{data.energiaMedia.toFixed(1)} <span className="text-base font-normal text-muted-foreground">/ 3</span></p>
            </Card>
            <Card className="p-5">
              <h3 className="mb-3 flex items-center gap-2 font-bold"><Trophy className="h-4 w-4" /> Ranking (atividades hoje)</h3>
              {data.ranking.length === 0 ? <p className="text-sm text-muted-foreground">Sem atividades registradas hoje.</p> : (
                <ol className="space-y-1 text-sm">
                  {data.ranking.slice(0, 10).map((r, i) => (
                    <li key={r.user_id} className="flex justify-between"><span>{i + 1}. {r.user_id.slice(0, 8)}…</span><span className="font-semibold tabular-nums">{r.total}</span></li>
                  ))}
                </ol>
              )}
            </Card>
          </div>

          <Card className="p-5">
            <h3 className="mb-3 flex items-center gap-2 font-bold"><Gauge className="h-4 w-4" /> Hunter Score (hoje)</h3>
            {data.scores.length === 0 ? <p className="text-sm text-muted-foreground">Nenhum score registrado hoje.</p> : (
              <div className="flex flex-wrap gap-2">
                {data.scores.map((s) => {
                  const cls = classificacaoScore(s.hunter_score);
                  return <Badge key={s.user_id} variant="outline" className={cls.tone}>{s.user_id.slice(0, 8)}: {s.hunter_score}</Badge>;
                })}
              </div>
            )}
          </Card>

          <Card className="p-5">
            <h3 className="mb-3 flex items-center gap-2 font-bold"><AlertTriangle className="h-4 w-4 text-amber-500" /> Alertas e solicitações de ajuda</h3>
            {data.alertas.length === 0 ? <p className="text-sm text-muted-foreground">Nenhum alerta em aberto. 🎉</p> : (
              <ul className="space-y-2 text-sm">
                {data.alertas.map((a) => (
                  <li key={a.id} className="flex items-center gap-2 rounded-md bg-muted/40 px-3 py-2">
                    <Badge variant="outline">{a.tipo}</Badge>
                    <span className="flex-1">{a.mensagem}</span>
                    <span className="text-xs text-muted-foreground">{a.user_id.slice(0, 8)}…</span>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>
      )}
    </AppShell>
  );
}
