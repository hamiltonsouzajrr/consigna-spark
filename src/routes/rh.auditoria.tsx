import { createFileRoute } from "@tanstack/react-router";
import { Card } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { RhPageHeader } from "@/components/rh/RhLayout";
import { auditLogs } from "@/lib/rh/extra";

export const Route = createFileRoute("/rh/auditoria")({
  component: Auditoria,
});

function Auditoria() {
  return (
    <div>
      <RhPageHeader title="Auditoria" description="Registro de ações realizadas no sistema." />
      <Card>
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Data</TableHead>
                <TableHead>Usuário</TableHead>
                <TableHead>Ação</TableHead>
                <TableHead>Tabela</TableHead>
                <TableHead>Registro</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {auditLogs.map((l) => (
                <TableRow key={l.id}>
                  <TableCell className="whitespace-nowrap text-sm text-muted-foreground">{l.data}</TableCell>
                  <TableCell className="font-medium">{l.usuario}</TableCell>
                  <TableCell className="text-sm">{l.acao}</TableCell>
                  <TableCell><Badge variant="outline">{l.tabela}</Badge></TableCell>
                  <TableCell className="text-sm">{l.registro}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </Card>
    </div>
  );
}
