import { createFileRoute } from "@tanstack/react-router";
import { Plus } from "lucide-react";
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid } from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { toast } from "sonner";
import { RhPageHeader } from "@/components/rh/RhLayout";
import { avaliacoes } from "@/lib/rh/mock";

export const Route = createFileRoute("/rh/avaliacoes")({
  component: Avaliacoes,
});

function Avaliacoes() {
  const grafico = avaliacoes.map((a) => ({ nome: a.colaborador.split(" ")[0], nota: a.notaFinal }));
  return (
    <div>
      <RhPageHeader
        title="Avaliações de Desempenho"
        description="Metas, feedbacks e notas dos colaboradores."
        actions={<Button size="sm" onClick={() => toast.info("Nova avaliação (demonstração)")}><Plus className="mr-2 h-4 w-4" /> Nova Avaliação</Button>}
      />

      <Card className="mb-6">
        <CardHeader className="pb-2"><CardTitle className="text-base">Notas de desempenho</CardTitle></CardHeader>
        <CardContent className="h-72">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={grafico}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-muted" vertical={false} />
              <XAxis dataKey="nome" tick={{ fontSize: 12 }} />
              <YAxis domain={[0, 10]} tick={{ fontSize: 12 }} />
              <Tooltip />
              <Bar dataKey="nota" name="Nota final" fill="#7c3aed" radius={[6, 6, 0, 0]} />
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
                <TableHead>Período</TableHead>
                <TableHead className="w-48">Meta atingida</TableHead>
                <TableHead>Nota final</TableHead>
                <TableHead className="hidden md:table-cell">Feedback</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {avaliacoes.map((a) => (
                <TableRow key={a.id}>
                  <TableCell className="font-medium">{a.colaborador}</TableCell>
                  <TableCell className="text-sm">{a.periodo}</TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <Progress value={Math.min(100, a.resultado)} className="h-2" />
                      <span className="text-xs text-muted-foreground">{a.resultado}%</span>
                    </div>
                  </TableCell>
                  <TableCell className="font-semibold">{a.notaFinal.toFixed(1)}</TableCell>
                  <TableCell className="hidden md:table-cell text-sm text-muted-foreground">{a.feedback}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </Card>
    </div>
  );
}
