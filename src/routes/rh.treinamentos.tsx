import { createFileRoute } from "@tanstack/react-router";
import { Plus } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { toast } from "sonner";
import { RhPageHeader, StatusBadge } from "@/components/rh/RhLayout";
import { RhStatCard } from "@/components/rh/RhStatCard";
import { treinamentos, formatDate } from "@/lib/rh/mock";
import { GraduationCap, CheckCircle2, Clock, XCircle } from "lucide-react";

export const Route = createFileRoute("/rh/treinamentos")({
  component: Treinamentos,
});

function Treinamentos() {
  const concluidos = treinamentos.filter((t) => t.status === "Concluído").length;
  const pendentes = treinamentos.filter((t) => t.status === "Pendente").length;
  const vencidos = treinamentos.filter((t) => t.status === "Vencido").length;

  return (
    <div>
      <RhPageHeader
        title="Treinamentos"
        description="Cursos, certificados e validades."
        actions={<Button size="sm" onClick={() => toast.info("Novo treinamento (demonstração)")}><Plus className="mr-2 h-4 w-4" /> Novo Treinamento</Button>}
      />

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <RhStatCard label="Total" value={treinamentos.length} icon={GraduationCap} />
        <RhStatCard label="Concluídos" value={concluidos} icon={CheckCircle2} tone="emerald" />
        <RhStatCard label="Pendentes" value={pendentes} icon={Clock} tone="amber" />
        <RhStatCard label="Vencidos" value={vencidos} icon={XCircle} tone="rose" />
      </div>

      <Card className="mt-6">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Colaborador</TableHead>
                <TableHead>Curso</TableHead>
                <TableHead>Validade</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {treinamentos.map((t) => (
                <TableRow key={t.id}>
                  <TableCell className="font-medium">{t.colaborador}</TableCell>
                  <TableCell className="text-sm">{t.curso}</TableCell>
                  <TableCell className="text-sm">{formatDate(t.validade)}</TableCell>
                  <TableCell><StatusBadge status={t.status} /></TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </Card>
    </div>
  );
}
