import { createFileRoute } from "@tanstack/react-router";
import { Plus, User } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { RhPageHeader } from "@/components/rh/RhLayout";
import { candidatos, vagas, type Candidato } from "@/lib/rh/mock";

export const Route = createFileRoute("/rh/recrutamento")({
  component: Recrutamento,
});

const etapas: Candidato["etapa"][] = ["Triagem", "Entrevista", "Teste", "Proposta", "Contratado"];

function Recrutamento() {
  return (
    <div>
      <RhPageHeader
        title="Recrutamento"
        description="Pipeline do processo seletivo."
        actions={<Button size="sm" onClick={() => toast.info("Nova vaga (demonstração)")}><Plus className="mr-2 h-4 w-4" /> Nova Vaga</Button>}
      />

      <div className="mb-6 grid gap-4 sm:grid-cols-3">
        {vagas.map((v) => (
          <Card key={v.id} className="p-4">
            <p className="font-semibold">{v.titulo}</p>
            <p className="text-xs text-muted-foreground">{v.departamento}</p>
            <Badge variant="outline" className="mt-2">{v.candidatos} candidatos</Badge>
          </Card>
        ))}
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-5">
        {etapas.map((etapa) => {
          const items = candidatos.filter((c) => c.etapa === etapa);
          return (
            <div key={etapa} className="rounded-xl border bg-muted/30 p-3">
              <div className="mb-3 flex items-center justify-between">
                <p className="text-sm font-semibold">{etapa}</p>
                <Badge variant="secondary">{items.length}</Badge>
              </div>
              <div className="space-y-2">
                {items.map((c) => (
                  <Card key={c.id} className="p-3">
                    <div className="flex items-center gap-2">
                      <span className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10 text-primary">
                        <User className="h-4 w-4" />
                      </span>
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium">{c.nome}</p>
                        <p className="truncate text-xs text-muted-foreground">{c.vaga}</p>
                      </div>
                    </div>
                  </Card>
                ))}
                {items.length === 0 && <p className="py-4 text-center text-xs text-muted-foreground">Vazio</p>}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
