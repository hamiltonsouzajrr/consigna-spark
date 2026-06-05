import { createFileRoute } from "@tanstack/react-router";
import { Clock, TrendingUp, TrendingDown } from "lucide-react";
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid, Legend } from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { RhPageHeader } from "@/components/rh/RhLayout";
import { RhStatCard } from "@/components/rh/RhStatCard";
import { pontos, formatDate } from "@/lib/rh/mock";

export const Route = createFileRoute("/rh/banco-horas")({
  component: BancoHoras,
});

const grafico = [
  { mes: "Jan", extras: 18, atrasos: 4 },
  { mes: "Fev", extras: 22, atrasos: 6 },
  { mes: "Mar", extras: 15, atrasos: 2 },
  { mes: "Abr", extras: 28, atrasos: 8 },
  { mes: "Mai", extras: 20, atrasos: 3 },
  { mes: "Jun", extras: 12, atrasos: 5 },
];

function BancoHoras() {
  const totalExtras = pontos.reduce((a, p) => a + p.extras, 0);
  const totalAtrasos = pontos.reduce((a, p) => a + p.atraso, 0);
  const faltas = pontos.filter((p) => p.falta).length;
  const saldo = pontos.reduce((a, p) => a + p.saldo, 0);

  return (
    <div>
      <RhPageHeader title="Banco de Horas" description="Registros de ponto, horas extras e saldo." />

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <RhStatCard label="Horas extras" value={`${totalExtras}h`} icon={TrendingUp} tone="emerald" />
        <RhStatCard label="Atrasos" value={`${totalAtrasos}h`} icon={TrendingDown} tone="amber" />
        <RhStatCard label="Faltas" value={faltas} icon={Clock} tone="rose" />
        <RhStatCard label="Saldo do banco" value={`${saldo.toFixed(1)}h`} icon={Clock} tone={saldo >= 0 ? "sky" : "rose"} />
      </div>

      <Card className="mt-6">
        <CardHeader className="pb-2"><CardTitle className="text-base">Horas extras e atrasos por mês</CardTitle></CardHeader>
        <CardContent className="h-72">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={grafico}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-muted" vertical={false} />
              <XAxis dataKey="mes" tick={{ fontSize: 12 }} />
              <YAxis tick={{ fontSize: 12 }} />
              <Tooltip /><Legend />
              <Bar dataKey="extras" name="Horas extras" fill="#16a34a" radius={[6, 6, 0, 0]} />
              <Bar dataKey="atrasos" name="Atrasos" fill="#d97706" radius={[6, 6, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      <Card className="mt-6">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Colaborador</TableHead>
                <TableHead>Data</TableHead>
                <TableHead>Entrada</TableHead>
                <TableHead>Saída</TableHead>
                <TableHead>Extras</TableHead>
                <TableHead>Atraso</TableHead>
                <TableHead>Falta</TableHead>
                <TableHead>Saldo</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {pontos.map((p) => (
                <TableRow key={p.id}>
                  <TableCell className="font-medium">{p.colaborador}</TableCell>
                  <TableCell className="text-sm">{formatDate(p.data)}</TableCell>
                  <TableCell className="text-sm">{p.entrada}</TableCell>
                  <TableCell className="text-sm">{p.saida}</TableCell>
                  <TableCell className="text-sm text-emerald-600">{p.extras}h</TableCell>
                  <TableCell className="text-sm text-amber-600">{p.atraso}h</TableCell>
                  <TableCell className="text-sm">{p.falta ? "Sim" : "—"}</TableCell>
                  <TableCell className={`text-sm font-medium ${p.saldo >= 0 ? "text-emerald-600" : "text-rose-600"}`}>
                    {p.saldo.toFixed(1)}h
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </Card>
    </div>
  );
}
