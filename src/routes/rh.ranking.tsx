import { createFileRoute } from "@tanstack/react-router";
import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, Tooltip, CartesianGrid } from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Trophy, Medal } from "lucide-react";
import { RhPageHeader } from "@/components/rh/RhLayout";
import { ranking, rankingDepartamentos, rankingEvolucao } from "@/lib/rh/extra";

export const Route = createFileRoute("/rh/ranking")({
  component: Ranking,
});

const medalCor = ["text-amber-500", "text-slate-400", "text-amber-700"];

function Ranking() {
  return (
    <div>
      <RhPageHeader title="Ranking de Desempenho" description="Top colaboradores, departamentos e gamificação." />
      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader className="pb-2"><CardTitle className="text-base">Top 10 colaboradores</CardTitle></CardHeader>
          <CardContent className="space-y-2">
            {ranking.map((r, i) => (
              <div key={r.colaborador} className="flex items-center gap-3 rounded-lg border p-2">
                <span className="w-6 text-center font-bold text-muted-foreground">
                  {i < 3 ? <Medal className={`mx-auto h-5 w-5 ${medalCor[i]}`} /> : i + 1}
                </span>
                <Avatar className="h-9 w-9"><AvatarImage src={r.foto} /><AvatarFallback>{r.colaborador.slice(0, 2)}</AvatarFallback></Avatar>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{r.colaborador}</p>
                  <p className="truncate text-xs text-muted-foreground">{r.departamento}</p>
                </div>
                <div className="hidden gap-1 sm:flex">
                  {r.badges.map((b) => <Badge key={b} variant="secondary" className="border-0">{b}</Badge>)}
                </div>
                <span className="flex items-center gap-1 font-semibold"><Trophy className="h-4 w-4 text-amber-500" />{r.pontos}</span>
              </div>
            ))}
          </CardContent>
        </Card>

        <div className="space-y-4">
          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-base">Top departamentos</CardTitle></CardHeader>
            <CardContent className="space-y-2">
              {rankingDepartamentos.map((d, i) => (
                <div key={d.departamento} className="flex items-center justify-between text-sm">
                  <span>{i + 1}. {d.departamento}</span>
                  <span className="font-semibold">{d.pontos.toLocaleString("pt-BR")}</span>
                </div>
              ))}
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-base">Evolução mensal</CardTitle></CardHeader>
            <CardContent className="h-44">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={rankingEvolucao}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" vertical={false} />
                  <XAxis dataKey="mes" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} />
                  <Tooltip />
                  <Line type="monotone" dataKey="pontos" stroke="#2563eb" strokeWidth={2} dot={false} />
                </LineChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
