import { createFileRoute, Link } from "@tanstack/react-router";
import { AppShell } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";
import { DashboardConsultorasPanel } from "@/components/prospeccao/DashboardConsultorasPanel";

export const Route = createFileRoute("/_authenticated/prospeccao/dashboard")({
  head: () => ({
    meta: [
      { title: "Dashboard por consultora — Prospecção" },
      { name: "description", content: "Leads abordados, conversões, follow-ups e tempo ativo por consultora, atualizados automaticamente." },
      { property: "og:title", content: "Dashboard por consultora" },
      { property: "og:description", content: "Indicadores de abordagem, conversão, follow-up e tempo ativo da equipe." },
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
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <div>
          <h1 className="text-2xl font-bold">Dashboard por consultora</h1>
          <p className="text-sm text-muted-foreground">
            Leads abordados, conversões, follow-ups e tempo ativo — atualização automática.
          </p>
        </div>
        <Button asChild variant="ghost" size="sm">
          <Link to="/prospeccao"><ArrowLeft className="mr-2 h-4 w-4" /> Prospecção</Link>
        </Button>
      </div>
      <DashboardConsultorasPanel />
    </AppShell>
  );
}
