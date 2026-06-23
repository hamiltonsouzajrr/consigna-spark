import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { Upload, FileText, AlertTriangle } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import { RhPageHeader } from "@/components/rh/RhLayout";
import { documentos, formatDate } from "@/lib/rh/mock";

export const Route = createFileRoute("/rh/documentos")({
  component: Documentos,
});

const HOJE = new Date("2026-06-05T00:00:00");
function diasParaVencer(v: string | null) {
  if (!v) return null;
  return Math.round((new Date(v + "T00:00:00").getTime() - HOJE.getTime()) / 86400000);
}

function vencimentoBadge(v: string | null) {
  const d = diasParaVencer(v);
  if (d === null) return <Badge variant="outline">Sem validade</Badge>;
  if (d < 0) return <Badge className="border-0 bg-rose-100 text-rose-700">Vencido</Badge>;
  if (d <= 30) return <Badge className="border-0 bg-amber-100 text-amber-700">Vence em {d}d</Badge>;
  return <Badge className="border-0 bg-emerald-100 text-emerald-700">Em dia</Badge>;
}

function Documentos() {
  const [open, setOpen] = useState(false);
  const vencendo = documentos.filter((d) => {
    const dias = diasParaVencer(d.vencimento);
    return dias !== null && dias <= 30;
  });

  return (
    <div>
      <RhPageHeader
        title="Documentos"
        description="Upload e controle de validade de documentos."
        actions={
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild><Button size="sm"><Upload className="mr-2 h-4 w-4" /> Enviar Documento</Button></DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>Enviar documento</DialogTitle></DialogHeader>
              <form className="space-y-4" onSubmit={(e) => { e.preventDefault(); toast.success("Documento enviado (demonstração)."); setOpen(false); }}>
                <div><Label>Tipo do documento</Label><Input className="mt-1" placeholder="Ex: ASO, CNH, Contrato" /></div>
                <div className="grid grid-cols-2 gap-3">
                  <div><Label>Data de emissão</Label><Input type="date" className="mt-1" /></div>
                  <div><Label>Data de vencimento</Label><Input type="date" className="mt-1" /></div>
                </div>
                <div><Label>Arquivo (PDF, JPG, PNG)</Label><Input type="file" accept=".pdf,.jpg,.jpeg,.png" className="mt-1" /></div>
                <DialogFooter>
                  <Button type="button" variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
                  <Button type="submit">Enviar</Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        }
      />

      {vencendo.length > 0 && (
        <Alert className="mb-6 border-amber-300 bg-amber-50 dark:bg-amber-500/10">
          <AlertTriangle className="h-4 w-4 text-amber-600" />
          <AlertTitle>Atenção</AlertTitle>
          <AlertDescription>
            {vencendo.length} documento(s) vencido(s) ou próximos do vencimento (30 dias).
          </AlertDescription>
        </Alert>
      )}

      <Card>
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Colaborador</TableHead>
                <TableHead>Tipo</TableHead>
                <TableHead>Arquivo</TableHead>
                <TableHead>Emissão</TableHead>
                <TableHead>Vencimento</TableHead>
                <TableHead>Situação</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {documentos.map((d) => (
                <TableRow key={d.id}>
                  <TableCell className="font-medium">{d.colaborador}</TableCell>
                  <TableCell className="text-sm">{d.tipo}</TableCell>
                  <TableCell className="text-sm">
                    <span className="flex items-center gap-2"><FileText className="h-4 w-4 text-muted-foreground" />{d.arquivo}</span>
                  </TableCell>
                  <TableCell className="text-sm">{formatDate(d.emissao)}</TableCell>
                  <TableCell className="text-sm">{formatDate(d.vencimento)}</TableCell>
                  <TableCell>{vencimentoBadge(d.vencimento)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </Card>
    </div>
  );
}
