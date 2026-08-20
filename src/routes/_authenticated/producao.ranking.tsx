import { createFileRoute, Link } from "@tanstack/react-router";
import { AppShell } from "@/components/AppShell";
import { Card } from "@/components/ui/card";
import { Trophy, ChevronRight, Settings2 } from "lucide-react";
import { ProducaoRanking } from "@/components/rh/ProducaoRanking";
import { useRhAccess } from "@/hooks/use-rh-access";

export const Route = createFileRoute("/_authenticated/producao/ranking")({
  head: () => ({
    meta: [
      { title: "Ranking de Produção — Produção" },
      { name: "description", content: "Classificação das consultoras por produção mensal (valor e contratos)." },
      { name: "robots", content: "noindex,nofollow" },
    ],
  }),
  component: Page,
});

function Page() {
  const { isAdmin } = useRhAccess();

  return (
    <AppShell>
      <div className="mb-6 flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-500/15 text-amber-600 dark:text-amber-400">
          <Trophy className="h-5 w-5" />
        </div>
        <div>
          <h1 className="text-2xl font-bold">Ranking de Produção</h1>
          <p className="text-sm text-muted-foreground">
            Classificação das consultoras por produção mensal (valor e contratos).
          </p>
        </div>
      </div>

      {isAdmin && (
        <Link to="/rh/producao" className="mb-4 block">
          <Card className="flex items-center gap-3 p-4 transition hover:bg-accent/50">
            <Settings2 className="h-5 w-5 text-primary" />
            <span className="flex-1 text-sm font-medium">
              Preencher/importar a produção do mês (área do administrador)
            </span>
            <ChevronRight className="h-4 w-4 text-muted-foreground" />
          </Card>
        </Link>
      )}

      <ProducaoRanking />
    </AppShell>
  );
}
