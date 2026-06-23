import { createFileRoute } from "@tanstack/react-router";
import { Plus, Building2, Users } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { RhPageHeader } from "@/components/rh/RhLayout";
import { departamentos } from "@/lib/rh/mock";

export const Route = createFileRoute("/_authenticated/rh/departamentos")({
  component: Departamentos,
});

function Departamentos() {
  return (
    <div>
      <RhPageHeader
        title="Departamentos"
        description="Estrutura organizacional da empresa."
        actions={<Button size="sm" onClick={() => toast.info("Novo departamento (demonstração)")}><Plus className="mr-2 h-4 w-4" /> Novo Departamento</Button>}
      />
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {departamentos.map((d) => (
          <Card key={d.id}>
            <CardContent className="p-5">
              <div className="flex items-center gap-3">
                <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary/10 text-primary">
                  <Building2 className="h-5 w-5" />
                </span>
                <div>
                  <p className="font-semibold">{d.nome}</p>
                  <p className="text-xs text-muted-foreground">Responsável: {d.responsavel}</p>
                </div>
              </div>
              <div className="mt-4 flex items-center gap-2 text-sm text-muted-foreground">
                <Users className="h-4 w-4" /> {d.colaboradores} colaboradores
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
