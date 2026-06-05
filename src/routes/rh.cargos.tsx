import { createFileRoute } from "@tanstack/react-router";
import { Plus } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { toast } from "sonner";
import { RhPageHeader } from "@/components/rh/RhLayout";
import { cargos, brl } from "@/lib/rh/mock";

export const Route = createFileRoute("/rh/cargos")({
  component: Cargos,
});

function Cargos() {
  return (
    <div>
      <RhPageHeader
        title="Cargos"
        description="Cargos e faixas salariais."
        actions={<Button size="sm" onClick={() => toast.info("Novo cargo (demonstração)")}><Plus className="mr-2 h-4 w-4" /> Novo Cargo</Button>}
      />
      <Card>
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Cargo</TableHead>
                <TableHead>Nível</TableHead>
                <TableHead>Salário base</TableHead>
                <TableHead>Colaboradores</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {cargos.map((c) => (
                <TableRow key={c.id}>
                  <TableCell className="font-medium">{c.nome}</TableCell>
                  <TableCell><Badge variant="outline">{c.nivel}</Badge></TableCell>
                  <TableCell>{brl(c.salarioBase)}</TableCell>
                  <TableCell>{c.colaboradores}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </Card>
    </div>
  );
}
