import { createFileRoute } from "@tanstack/react-router";
import { Plus, Goal } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { toast } from "sonner";
import { RhPageHeader } from "@/components/rh/RhLayout";
import { okrs } from "@/lib/rh/extra";

export const Route = createFileRoute("/rh/okrs")({
  component: Okrs,
});

function Okrs() {
  return (
    <div>
      <RhPageHeader
        title="OKRs"
        description="Objetivos e Key Results por empresa, departamento e colaborador."
        actions={<Button size="sm" onClick={() => toast.info("Novo OKR (demonstração)")}><Plus className="mr-2 h-4 w-4" /> Novo OKR</Button>}
      />
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {okrs.map((o) => (
          <Card key={o.id}>
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between gap-2">
                <Badge variant="outline">{o.nivel}</Badge>
                <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10 text-primary">
                  <Goal className="h-4 w-4" />
                </span>
              </div>
              <CardTitle className="text-base">{o.objetivo}</CardTitle>
              <p className="text-xs text-muted-foreground">Responsável: {o.dono}</p>
            </CardHeader>
            <CardContent>
              <div className="mb-4 flex items-center gap-3">
                <Progress value={o.progresso} className="h-2" />
                <span className="text-xs font-medium text-muted-foreground">{o.progresso}%</span>
              </div>
              <div className="space-y-3">
                {o.krs.map((kr, i) => (
                  <div key={i}>
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">{kr.titulo}</span>
                      <span className="text-xs font-medium">{kr.progresso}%</span>
                    </div>
                    <Progress value={kr.progresso} className="mt-1 h-1.5" />
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
