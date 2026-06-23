import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { Clock, TrendingUp, TrendingDown, Trash2 } from "lucide-react";
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid, Legend } from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { toast } from "sonner";
import { RhPageHeader } from "@/components/rh/RhLayout";
import { RhStatCard } from "@/components/rh/RhStatCard";
import { pontos as pontosData, formatDate } from "@/lib/rh/mock";

export const Route = createFileRoute("/_authenticated/_authenticated/rh/banco-horas")({
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
  const [pontos, setPontos] = useState(pontosData);
  const totalExtras = pontos.reduce((a, p) => a + p.extras, 0);
  const totalAtrasos = pontos.reduce((a, p) => a + p.atraso, 0);
  const faltas = pontos.filter((p) => p.falta).length;
  const saldo = pontos.reduce((a, p) => a + p.saldo, 0);

  const remove = (id: string, nome: string) => {
    setPontos((prev) => prev.filter((p) => p.id !== id));
    toast.success(`Registro de ${nome} excluído`);
  };


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
                <TableHead className="text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {pontos.length === 0 && (
                <TableRow>
                  <TableCell colSpan={9} className="py-10 text-center text-sm text-muted-foreground">
                    Nenhum registro de ponto.
                  </TableCell>
                </TableRow>
              )}
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
                  <TableCell>
                    <div className="flex justify-end">
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-8 w-8 text-rose-600 hover:text-rose-700">
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>Excluir registro?</AlertDialogTitle>
                            <AlertDialogDescription>
                              Esta ação removerá o registro de {p.colaborador} ({formatDate(p.data)}). Não é possível desfazer.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Cancelar</AlertDialogCancel>
                            <AlertDialogAction onClick={() => remove(p.id, p.colaborador)}>Excluir</AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    </div>
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
