import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/AppShell";
import { Trophy } from "lucide-react";
import { CompeticaoRanking } from "@/components/prospeccao/CompeticaoRanking";

export const Route = createFileRoute("/_authenticated/producao/competicao")({
  head: () => ({
    meta: [
      { title: "Competição de Prospecção — Prêmio da Semana" },
      {
        name: "description",
        content:
          "Ranking semanal de prospecção: contatos, qualificações e follow-ups cumpridos disputam o Prêmio Misterioso da semana.",
      },
      { property: "og:title", content: "Competição de Prospecção — Prêmio da Semana" },
      {
        property: "og:description",
        content: "Placar ao vivo da competição semanal de prospecção das consultoras.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex,nofollow" },
    ],
  }),
  component: Page,
});

function Page() {
  return (
    <AppShell>
      <div className="mb-6 flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-500/15 text-amber-600 dark:text-amber-400">
          <Trophy className="h-5 w-5" />
        </div>
        <div>
          <h1 className="text-2xl font-bold">Competição de Prospecção</h1>
          <p className="text-sm text-muted-foreground">
            Quem mais prospecta, qualifica e cumpre follow-up leva o Prêmio Misterioso da semana.
          </p>
        </div>
      </div>

      <CompeticaoRanking />
    </AppShell>
  );
}
