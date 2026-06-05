import { createFileRoute } from "@tanstack/react-router";
import { Plus } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { toast } from "sonner";
import { RhPageHeader, StatusBadge } from "@/components/rh/RhLayout";
import { ocorrencias, formatDate } from "@/lib/rh/mock";

export const Route = createFileRoute("/rh/ocorrencias")({
  component: Ocorrencias,
});

function Ocorrencias() {
  return (
    <div>
      <RhPageHeader
        title="Ocorrências"
        description="Advertências, elogios e observações."
        actions={<Button size="sm" onClick={() => toast.info("Nova ocorrência (demonstração)")}><Plus className="mr-2 h-4 w-4" /> Nova Ocorrência</Button>}
      />
      <Card>
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Colaborador</TableHead>
                <TableHead>Tipo</TableHead>
                <TableHead>Data</TableHead>
                <TableHead>Descrição</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {ocorrencias.map((o) => (
                <TableRow key={o.id}>
                  <TableCell className="font-medium">{o.colaborador}</TableCell>
                  <TableCell><StatusBadge status={o.tipo} /></TableCell>
                  <TableCell className="text-sm">{formatDate(o.data)}</TableCell>
                  <TableCell className="text-sm text-muted-foreground">{o.descricao}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </Card>
    </div>
  );
}
