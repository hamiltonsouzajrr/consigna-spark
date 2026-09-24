import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/_authenticated/prospeccao/pesquisar-cliente")({
  validateSearch: (search: Record<string, unknown>): { q: string } => ({ q: typeof search.q === "string" ? search.q : "" }),
  beforeLoad: ({ search }) => {
    throw redirect({ to: "/consulta-servidor", search: { q: search.q } });
  },
  head: () => ({
    meta: [
      { title: "Pesquisar Cliente | Grupo Positive" },
      { name: "description", content: "Busca unificada de clientes nas bases internas e comparação opcional na RockData." },
      { property: "og:title", content: "Pesquisar Cliente | Grupo Positive" },
      { property: "og:description", content: "Busca unificada de clientes nas bases internas e comparação opcional." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
});