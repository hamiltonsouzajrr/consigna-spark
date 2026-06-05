import { createFileRoute } from "@tanstack/react-router";
import { Bus, Utensils, HeartPulse, Smile, Dumbbell, Home, Plus, Check } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { RhPageHeader } from "@/components/rh/RhLayout";
import { beneficios, beneficiosPorColaborador } from "@/lib/rh/extra";

export const Route = createFileRoute("/rh/beneficios")({
  component: Beneficios,
});

const icons: Record<string, LucideIcon> = {
  "Vale Transporte": Bus,
  "Vale Refeição": Utensils,
  "Plano de Saúde": HeartPulse,
  "Plano Odontológico": Smile,
  "Gympass": Dumbbell,
  "Auxílio Home Office": Home,
};

function Beneficios() {
  return (
    <div>
      <RhPageHeader
        title="Benefícios"
        description="Benefícios oferecidos e adesão dos colaboradores."
        actions={<Button size="sm" onClick={() => toast.info("Novo benefício (demonstração)")}><Plus className="mr-2 h-4 w-4" /> Novo Benefício</Button>}
      />

      <div className="mb-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {beneficios.map((b) => {
          const Icon = icons[b.nome] ?? HeartPulse;
          return (
            <Card key={b.id}>
              <CardContent className="p-5">
                <div className="flex items-center gap-3">
                  <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary/10 text-primary"><Icon className="h-5 w-5" /></span>
                  <div>
                    <p className="font-semibold">{b.nome}</p>
                    <p className="text-xs text-muted-foreground">{b.descricao}</p>
                  </div>
                </div>
                <Badge variant="outline" className="mt-4">{b.aderentes} aderentes</Badge>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-base">Adesão por colaborador</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          {beneficiosPorColaborador.map((c) => (
            <div key={c.colaborador} className="flex flex-col gap-2 border-b py-2 last:border-0 sm:flex-row sm:items-center sm:justify-between">
              <span className="text-sm font-medium">{c.colaborador}</span>
              <div className="flex flex-wrap gap-1.5">
                {c.ativos.map((a) => (
                  <Badge key={a} variant="secondary" className="border-0 bg-emerald-100 text-emerald-700">
                    <Check className="mr-1 h-3 w-3" />{a}
                  </Badge>
                ))}
              </div>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
