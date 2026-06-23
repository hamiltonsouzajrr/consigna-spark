import { createFileRoute } from "@tanstack/react-router";
import { RhPageHeader } from "@/components/rh/RhLayout";
import { ProducaoRanking } from "@/components/rh/ProducaoRanking";

export const Route = createFileRoute("/_authenticated/_authenticated/rh/ranking")({
  component: Ranking,
});

function Ranking() {
  return (
    <div>
      <RhPageHeader
        title="Ranking de Produção"
        description="Classificação das consultoras por produção mensal (valor e contratos)."
      />
      <ProducaoRanking />
    </div>
  );
}
