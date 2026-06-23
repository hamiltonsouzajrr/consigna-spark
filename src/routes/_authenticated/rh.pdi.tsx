import { createFileRoute } from "@tanstack/react-router";
import { Plus } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { toast } from "sonner";
import { RhPageHeader, StatusBadge } from "@/components/rh/RhLayout";
import { pdis } from "@/lib/rh/extra";
import { formatDate } from "@/lib/rh/mock";

export const Route = createFileRoute("/_authenticated/_authenticated/rh/pdi")({
  component: PdiPage,
});

function PdiPage() {
  return (
    <div>
      <RhPageHeader
        title="PDI — Plano de Desenvolvimento Individual"
        description="Competências, metas, cursos e progresso."
        actions={<Button size="sm" onClick={() => toast.info("Novo PDI (demonstração)")}><Plus className="mr-2 h-4 w-4" /> Novo PDI</Button>}
      />
      <div className="grid gap-4 md:grid-cols-2">
        {pdis.map((p) => (
          <Card key={p.id}>
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base">{p.colaborador}</CardTitle>
                <StatusBadge status={p.status === "Em andamento" ? "Pendente" : p.status} />
              </div>
              <p className="text-sm text-muted-foreground">{p.competencia}</p>
            </CardHeader>
            <CardContent>
              <p className="text-sm">{p.meta}</p>
              <div className="mt-3 flex items-center gap-3">
                <Progress value={p.progresso} className="h-2" />
                <span className="text-xs font-medium text-muted-foreground">{p.progresso}%</span>
              </div>
              <p className="mt-2 text-xs text-muted-foreground">Prazo: {formatDate(p.prazo)}</p>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
