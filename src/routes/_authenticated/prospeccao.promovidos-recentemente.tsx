// Atalho: /prospeccao/promovidos-recentemente leva para a aba oficial
// "Promovidos Recentemente" (/prospeccao/promovidos-recentes).
import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/_authenticated/prospeccao/promovidos-recentemente")({
  beforeLoad: () => {
    throw redirect({ to: "/prospeccao/promovidos-recentes" });
  },
  component: () => null,
});
