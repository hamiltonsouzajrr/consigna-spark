import { createFileRoute } from "@tanstack/react-router";
import { Plus, Award } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { toast } from "sonner";
import { RhPageHeader } from "@/components/rh/RhLayout";
import { reconhecimentos } from "@/lib/rh/extra";
import { formatDate } from "@/lib/rh/mock";

export const Route = createFileRoute("/rh/reconhecimentos")({
  component: Reconhecimentos,
});

const tipoCor: Record<string, string> = {
  "Trabalho em equipe": "bg-sky-100 text-sky-700 dark:bg-sky-500/15 dark:text-sky-400",
  Liderança: "bg-violet-100 text-violet-700 dark:bg-violet-500/15 dark:text-violet-400",
  Inovação: "bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-400",
  "Destaque do mês": "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-400",
};

function Reconhecimentos() {
  return (
    <div>
      <RhPageHeader
        title="Reconhecimentos"
        description="Elogios e reconhecimentos entre colaboradores."
        actions={<Button size="sm" onClick={() => toast.info("Novo reconhecimento (demonstração)")}><Plus className="mr-2 h-4 w-4" /> Reconhecer</Button>}
      />
      <div className="grid gap-4 md:grid-cols-2">
        {reconhecimentos.map((r) => (
          <Card key={r.id}>
            <CardContent className="p-5">
              <div className="flex items-start gap-3">
                <Avatar className="h-10 w-10">
                  <AvatarFallback>{r.de.slice(0, 2)}</AvatarFallback>
                </Avatar>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="text-sm font-semibold">{r.de}</p>
                    <span className="text-xs text-muted-foreground">→</span>
                    <p className="text-sm font-semibold">{r.para}</p>
                    <span className="flex h-7 w-7 items-center justify-center rounded-full bg-amber-500/15 text-amber-500">
                      <Award className="h-4 w-4" />
                    </span>
                  </div>
                  <Badge variant="secondary" className={`mt-2 border-0 ${tipoCor[r.tipo] ?? "bg-muted text-muted-foreground"}`}>
                    {r.tipo}
                  </Badge>
                  <p className="mt-2 text-sm text-muted-foreground">{r.mensagem}</p>
                  <p className="mt-2 text-xs text-muted-foreground">{formatDate(r.data)}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
