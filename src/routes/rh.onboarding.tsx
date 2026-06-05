import { createFileRoute } from "@tanstack/react-router";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Progress } from "@/components/ui/progress";
import { RhPageHeader } from "@/components/rh/RhLayout";
import { onboarding } from "@/lib/rh/mock";

export const Route = createFileRoute("/rh/onboarding")({
  component: Onboarding,
});

function Onboarding() {
  return (
    <div>
      <RhPageHeader title="Onboarding" description="Checklist de integração de novos colaboradores." />
      <div className="grid gap-4 md:grid-cols-2">
        {onboarding.map((o) => {
          const done = o.tarefas.filter((t) => t.done).length;
          const pct = Math.round((done / o.tarefas.length) * 100);
          return (
            <Card key={o.id}>
              <CardHeader className="pb-2">
                <CardTitle className="flex items-center justify-between text-base">
                  {o.colaborador}
                  <span className="text-sm font-normal text-muted-foreground">{pct}% concluído</span>
                </CardTitle>
                <Progress value={pct} className="h-2" />
              </CardHeader>
              <CardContent className="space-y-3">
                {o.tarefas.map((t, i) => (
                  <label key={i} className="flex items-center gap-3 text-sm">
                    <Checkbox checked={t.done} />
                    <span className={t.done ? "text-muted-foreground line-through" : ""}>{t.label}</span>
                  </label>
                ))}
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
