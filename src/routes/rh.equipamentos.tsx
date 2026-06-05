import { createFileRoute } from "@tanstack/react-router";
import { Plus } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { toast } from "sonner";
import { RhPageHeader, StatusBadge } from "@/components/rh/RhLayout";
import { equipamentos, formatDate } from "@/lib/rh/mock";

export const Route = createFileRoute("/rh/equipamentos")({
  component: Equipamentos,
});

function Equipamentos() {
  return (
    <div>
      <RhPageHeader
        title="Equipamentos"
        description="Controle de ativos entregues aos colaboradores."
        actions={<Button size="sm" onClick={() => toast.info("Novo equipamento (demonstração)")}><Plus className="mr-2 h-4 w-4" /> Novo Equipamento</Button>}
      />
      <Card>
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Tipo</TableHead>
                <TableHead>Colaborador</TableHead>
                <TableHead>Patrimônio</TableHead>
                <TableHead>Nº de série</TableHead>
                <TableHead>Entrega</TableHead>
                <TableHead>Devolução</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {equipamentos.map((e) => (
                <TableRow key={e.id}>
                  <TableCell><Badge variant="outline">{e.tipo}</Badge></TableCell>
                  <TableCell className="font-medium">{e.colaborador}</TableCell>
                  <TableCell className="text-sm">{e.patrimonio}</TableCell>
                  <TableCell className="text-sm">{e.serie}</TableCell>
                  <TableCell className="text-sm">{formatDate(e.entrega)}</TableCell>
                  <TableCell className="text-sm">{formatDate(e.devolucao)}</TableCell>
                  <TableCell><StatusBadge status={e.status} /></TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </Card>
    </div>
  );
}
