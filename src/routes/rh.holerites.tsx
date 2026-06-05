import { createFileRoute } from "@tanstack/react-router";
import { Upload, Download, FileSignature, FileText } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { toast } from "sonner";
import { RhPageHeader } from "@/components/rh/RhLayout";
import { holerites, fmtBRL } from "@/lib/rh/extra";

export const Route = createFileRoute("/rh/holerites")({
  component: Holerites,
});

function Holerites() {
  return (
    <div>
      <RhPageHeader
        title="Holerites"
        description="Histórico, download e assinatura de holerites."
        actions={<Button size="sm" onClick={() => toast.info("Upload de holerite (demonstração)")}><Upload className="mr-2 h-4 w-4" /> Enviar Holerite</Button>}
      />
      <Card>
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Colaborador</TableHead>
                <TableHead>Referência</TableHead>
                <TableHead>Salário</TableHead>
                <TableHead>Descontos</TableHead>
                <TableHead>Líquido</TableHead>
                <TableHead>Assinatura</TableHead>
                <TableHead className="text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {holerites.map((h) => (
                <TableRow key={h.id}>
                  <TableCell className="font-medium">{h.colaborador}</TableCell>
                  <TableCell className="text-sm">{h.referencia}</TableCell>
                  <TableCell className="text-sm">{fmtBRL(h.salario)}</TableCell>
                  <TableCell className="text-sm text-rose-600">- {fmtBRL(h.descontos)}</TableCell>
                  <TableCell className="text-sm font-semibold text-emerald-600">{fmtBRL(h.liquido)}</TableCell>
                  <TableCell>
                    {h.assinado
                      ? <Badge className="border-0 bg-emerald-100 text-emerald-700">Assinado</Badge>
                      : <Badge className="border-0 bg-amber-100 text-amber-700">Pendente</Badge>}
                  </TableCell>
                  <TableCell>
                    <div className="flex justify-end gap-1">
                      <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => toast.success("Download iniciado (demonstração)")}>
                        <Download className="h-4 w-4" />
                      </Button>
                      {!h.assinado && (
                        <Button variant="ghost" size="icon" className="h-8 w-8 text-primary" onClick={() => toast.success("Holerite assinado (demonstração)")}>
                          <FileSignature className="h-4 w-4" />
                        </Button>
                      )}
                      <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => toast.info("Visualizar PDF (demonstração)")}>
                        <FileText className="h-4 w-4" />
                      </Button>
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
