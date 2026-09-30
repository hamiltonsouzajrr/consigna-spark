import { createFileRoute } from "@tanstack/react-router";
import { QuitacaoPage } from "@/components/quitacao/QuitacaoPage";

export const Route = createFileRoute("/_authenticated/quitacao-ng")({
  head: () => ({
    meta: [
      { title: "Quitação — Cartão de Crédito (NG) | Compra de dívida Transfer NG" },
      { name: "description", content: "Clientes aptos à compra de dívida Transfer NG Card com prioridade, roteiro de digitação e horários de corte." },
      { property: "og:title", content: "Quitação — Cartão de Crédito (NG)" },
      { property: "og:description", content: "Compra de dívida Transfer NG: prioridade, checklist do roteiro e previsão de liberação." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: () => <QuitacaoPage produto="ng" />,
});
