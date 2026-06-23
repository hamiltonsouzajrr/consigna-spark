import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { Plus, Check, X } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { toast } from "sonner";
import { RhPageHeader, StatusBadge } from "@/components/rh/RhLayout";
import { ferias as seed, formatDate, type Ferias } from "@/lib/rh/mock";

export const Route = createFileRoute("/_authenticated/_authenticated/rh/ferias")({
  component: FeriasPage,
});

function FeriasPage() {
  const [data, setData] = useState<Ferias[]>(seed);

  const setStatus = (id: string, status: Ferias["status"]) => {
    setData((d) => d.map((f) => (f.id === id ? { ...f, status } : f)));
    toast.success(`Solicitação ${status.toLowerCase()}.`);
  };

  const periodos = data
    .filter((f) => f.status === "Aprovado")
    .map((f) => ({ from: new Date(f.inicio + "T00:00:00"), to: new Date(f.fim + "T00:00:00") }));

  return (
    <div>
      <RhPageHeader
        title="Férias e Licenças"
        description="Solicitações, aprovações e afastamentos."
        actions={<Button size="sm" onClick={() => toast.info("Solicitar férias (demonstração)")}><Plus className="mr-2 h-4 w-4" /> Solicitar Férias</Button>}
      />

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Colaborador</TableHead>
                  <TableHead>Tipo</TableHead>
                  <TableHead>Período</TableHead>
                  <TableHead>Dias</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.map((f) => (
                  <TableRow key={f.id}>
                    <TableCell className="font-medium">{f.colaborador}</TableCell>
                    <TableCell className="text-sm">{f.tipo}</TableCell>
                    <TableCell className="text-sm">{formatDate(f.inicio)} – {formatDate(f.fim)}</TableCell>
                    <TableCell>{f.dias}</TableCell>
                    <TableCell><StatusBadge status={f.status} /></TableCell>
                    <TableCell>
                      <div className="flex justify-end gap-1">
                        <Button variant="ghost" size="icon" className="h-8 w-8 text-emerald-600"
                          disabled={f.status === "Aprovado"} onClick={() => setStatus(f.id, "Aprovado")}>
                          <Check className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="icon" className="h-8 w-8 text-rose-600"
                          disabled={f.status === "Recusado"} onClick={() => setStatus(f.id, "Recusado")}>
                          <X className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </Card>

        <Card>
          <CardHeader><CardTitle className="text-base">Calendário</CardTitle></CardHeader>
          <CardContent className="flex justify-center">
            <Calendar mode="multiple" selected={periodos.flatMap((p) => {
              const days: Date[] = [];
              const d = new Date(p.from);
              while (d <= p.to) { days.push(new Date(d)); d.setDate(d.getDate() + 1); }
              return days;
            })} />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
