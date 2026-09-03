// Rota oficial única de promovidos: /prospeccao/promovidos-recentes.
// Este caminho antigo permanece apenas como atalho para não quebrar links salvos.
import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/_authenticated/prospeccao/promovidos")({
  beforeLoad: () => {
    throw redirect({ to: "/prospeccao/promovidos-recentes" });
  },
  component: () => null,
});
