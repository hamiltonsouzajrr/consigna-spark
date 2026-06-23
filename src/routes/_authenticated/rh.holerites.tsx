import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { Upload, Download, FileSignature, FileText, Trash2 } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
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
import { holerites as holeritesData, fmtBRL, type Holerite } from "@/lib/rh/extra";

export const Route = createFileRoute("/_authenticated/rh/holerites")({
  component: Holerites,
});

function Holerites() {
  const [items, setItems] = useState<Holerite[]>(holeritesData);

  const remove = (id: string, nome: string) => {
    setItems((prev) => prev.filter((h) => h.id !== id));
    toast.success(`Holerite de ${nome} excluído`);
  };

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
              {items.length === 0 && (
                <TableRow>
                  <TableCell colSpan={7} className="py-10 text-center text-sm text-muted-foreground">
                    Nenhum holerite cadastrado.
                  </TableCell>
                </TableRow>
              )}
              {items.map((h) => (
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
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-8 w-8 text-rose-600 hover:text-rose-700">
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>Excluir holerite?</AlertDialogTitle>
                            <AlertDialogDescription>
                              Esta ação removerá o holerite de {h.colaborador} ({h.referencia}). Não é possível desfazer.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Cancelar</AlertDialogCancel>
                            <AlertDialogAction onClick={() => remove(h.id, h.colaborador)}>Excluir</AlertDialogAction>
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
