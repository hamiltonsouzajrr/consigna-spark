import { createFileRoute } from "@tanstack/react-router";
import { QuitacaoPage } from "@/components/quitacao/QuitacaoPage";

export const Route = createFileRoute("/_authenticated/quitacao")({
  head: () => ({
    meta: [
      { title: "Quitação — Cartão de crédito | Prospecção de compra de dívida" },
      { name: "description", content: "Clientes aptos à quitação/compra de dívida com troco estimado por prazo para prospecção." },
      { property: "og:title", content: "Quitação — Cartão de crédito" },
      { property: "og:description", content: "Clientes aptos à compra de dívida com troco estimado por prazo." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: () => <QuitacaoPage produto="geral" />,
});
