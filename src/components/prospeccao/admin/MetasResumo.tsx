// Resumo da equipe no topo da tela de metas: realizado x meta e quem está atrasada.
import { Card, CardContent } from "@/components/ui/card";
import type { MetasSemana } from "@/lib/prospeccao/metas.functions";

function pct(feito: number, meta: number) {
  if (meta <= 0) return 100;
  return Math.round((feito / meta) * 100);
}

export function noRitmo(linha: MetasSemana["linhas"][number], pctEsperado: number) {
  const p = Math.min(
    pct(linha.contatos, linha.meta.meta_contatos),
    pct(linha.vendas, linha.meta.meta_vendas),
    pct(linha.horas, linha.meta.meta_horas),
  );
  return p >= pctEsperado;
}

export function MetasResumo({ dados }: { dados: MetasSemana }) {
  const linhas = dados.linhas;
  const soma = (f: (l: MetasSemana["linhas"][number]) => number) => linhas.reduce((s, l) => s + f(l), 0);

  const emRitmo = linhas.filter((l) => noRitmo(l, dados.pctEsperado)).length;
  const atrasadas = linhas.length - emRitmo;

  const cards = [
    { label: "Consultoras", valor: String(linhas.length), extra: `${dados.pctEsperado}% da semana decorrido` },
    { label: "No ritmo", valor: String(emRitmo), extra: "dentro do esperado até hoje", tom: "text-success" },
    { label: "Atrasadas", valor: String(atrasadas), extra: "abaixo do ritmo esperado", tom: "text-destructive" },
    {
      label: "Contatos da equipe",
      valor: soma((l) => l.contatos).toLocaleString("pt-BR"),
      extra: `meta ${soma((l) => l.meta.meta_contatos).toLocaleString("pt-BR")}`,
    },
    {
      label: "Vendas confirmadas",
      valor: String(soma((l) => l.vendas)),
      extra: `meta ${soma((l) => l.meta.meta_vendas)}`,
    },
    {
      label: "Horas ativas",
      valor: `${Math.round(soma((l) => l.horas))}h`,
      extra: `meta ${Math.round(soma((l) => l.meta.meta_horas))}h`,
    },
  ];

  return (
    <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-6">
      {cards.map((c) => (
        <Card key={c.label}>
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground">{c.label}</p>
            <p className={`text-2xl font-bold tabular-nums ${c.tom ?? ""}`}>{c.valor}</p>
            <p className="mt-1 text-xs text-muted-foreground">{c.extra}</p>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
