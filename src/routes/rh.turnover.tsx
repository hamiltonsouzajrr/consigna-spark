import { createFileRoute } from "@tanstack/react-router";
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid, Cell } from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { RhPageHeader } from "@/components/rh/RhLayout";
import { turnoverPred, turnoverNivel } from "@/lib/rh/extra";

export const Route = createFileRoute("/rh/turnover")({
  component: Turnover,
});

const cor = (s: number) => (s <= 30 ? "#16a34a" : s <= 70 ? "#d97706" : "#dc2626");
const badge = (s: number) => {
  const n = turnoverNivel(s);
  const cls = s <= 30 ? "bg-emerald-100 text-emerald-700" : s <= 70 ? "bg-amber-100 text-amber-700" : "bg-rose-100 text-rose-700";
  return <Badge className={`border-0 ${cls}`}>{n} risco</Badge>;
};

function Turnover() {
  const data = [...turnoverPred].sort((a, b) => b.score - a.score);
  return (
    <div>
      <RhPageHeader title="Predição de Turnover" description="Score de risco de saída por colaborador (IA — demonstração)." />
      <Card className="mb-6">
        <CardHeader className="pb-2"><CardTitle className="text-base">Score de risco</CardTitle></CardHeader>
        <CardContent className="h-80">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data} layout="vertical" margin={{ left: 20 }}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-muted" horizontal={false} />
              <XAxis type="number" domain={[0, 100]} tick={{ fontSize: 12 }} />
              <YAxis type="category" dataKey="colaborador" width={120} tick={{ fontSize: 11 }} />
              <Tooltip />
              <Bar dataKey="score" radius={[0, 6, 6, 0]}>
                {data.map((d, i) => <Cell key={i} fill={cor(d.score)} />)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      <Card>
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Colaborador</TableHead>
                <TableHead>Departamento</TableHead>
                <TableHead className="w-48">Score</TableHead>
                <TableHead>Probabilidade</TableHead>
                <TableHead>Nível</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.map((d) => (
                <TableRow key={d.colaborador}>
                  <TableCell className="font-medium">{d.colaborador}</TableCell>
                  <TableCell className="text-sm">{d.departamento}</TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <Progress value={d.score} className="h-2" />
                      <span className="text-xs">{d.score}</span>
                    </div>
                  </TableCell>
                  <TableCell className="text-sm">{d.probabilidade}%</TableCell>
                  <TableCell>{badge(d.score)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </Card>
    </div>
  );
}
