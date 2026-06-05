import { createFileRoute } from "@tanstack/react-router";
import { Plus, Check, X } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { toast } from "sonner";
import { RhPageHeader } from "@/components/rh/RhLayout";
import { desligamentos, formatDate } from "@/lib/rh/mock";

export const Route = createFileRoute("/rh/desligamentos")({
  component: Desligamentos,
});

const Yes = () => <Check className="h-4 w-4 text-emerald-600" />;
const No = () => <X className="h-4 w-4 text-rose-600" />;

function Desligamentos() {
  return (
    <div>
      <RhPageHeader
        title="Desligamentos"
        description="Controle do processo de desligamento."
        actions={<Button size="sm" onClick={() => toast.info("Novo desligamento (demonstração)")}><Plus className="mr-2 h-4 w-4" /> Novo Desligamento</Button>}
      />
      <Card>
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Colaborador</TableHead>
                <TableHead>Motivo</TableHead>
                <TableHead>Data</TableHead>
                <TableHead>Entrevista de saída</TableHead>
                <TableHead>Equipamentos devolvidos</TableHead>
                <TableHead>Acessos encerrados</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {desligamentos.map((d) => (
                <TableRow key={d.id}>
                  <TableCell className="font-medium">{d.colaborador}</TableCell>
                  <TableCell className="text-sm">{d.motivo}</TableCell>
                  <TableCell className="text-sm">{formatDate(d.data)}</TableCell>
                  <TableCell>{d.entrevistaSaida ? <Yes /> : <No />}</TableCell>
                  <TableCell>{d.equipamentosDevolvidos ? <Yes /> : <No />}</TableCell>
                  <TableCell>{d.acessosEncerrados ? <Yes /> : <No />}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </Card>
    </div>
  );
}
