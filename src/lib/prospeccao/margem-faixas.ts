// Faixas de margem para a base "CLIENTES TOMADORES COM MARGEM - AL".
// Único ponto de calibração: ajustar aqui reflete no filtro (backend) e nos
// destaques dos cards (frontend).

export type TipoMargem = "emprestimo" | "cartao_credito" | "cartao_beneficio" | "qualquer";
export type FaixaMargem = "todas" | "baixa" | "media" | "alta";

export const TIPO_MARGEM_COLUNA: Record<Exclude<TipoMargem, "qualquer">, string> = {
  emprestimo: "margem_disp_emprestimo",
  cartao_credito: "margem_disp_cartao_credito",
  // A planilha não traz "disponível" de benefício; usamos a utilizada como proxy.
  cartao_beneficio: "margem_util_cartao_beneficio",
};

export const TIPO_MARGEM_LABEL: Record<TipoMargem, string> = {
  emprestimo: "Margem principal (empréstimo)",
  cartao_credito: "Cartão de crédito",
  cartao_beneficio: "Cartão benefício",
  qualquer: "Qualquer margem",
};

export const TIPO_MARGEM_CURTO: Record<TipoMargem, string> = {
  emprestimo: "Empréstimo",
  cartao_credito: "Cartão crédito",
  cartao_beneficio: "Cartão benefício",
  qualquer: "Qualquer",
};

// Limites por tipo: baixa < min | média entre min e max | alta >= max
export const FAIXA_LIMITES: Record<Exclude<TipoMargem, "qualquer">, { min: number; max: number }> = {
  emprestimo: { min: 200, max: 600 },
  cartao_credito: { min: 80, max: 200 },
  cartao_beneficio: { min: 60, max: 150 },
};

export const FAIXA_LABEL: Record<FaixaMargem, string> = {
  todas: "Todas as faixas",
  baixa: "Margem baixa",
  media: "Margem média",
  alta: "Margem alta",
};

export const TIPOS_MARGEM: TipoMargem[] = ["emprestimo", "cartao_credito", "cartao_beneficio", "qualquer"];
export const FAIXAS_MARGEM: FaixaMargem[] = ["todas", "baixa", "media", "alta"];

/** Intervalo [min, max) em reais para a faixa/tipo pedidos. */
export function faixaIntervalo(
  tipo: Exclude<TipoMargem, "qualquer">,
  faixa: FaixaMargem,
): { gte: number | null; lt: number | null } {
  const { min, max } = FAIXA_LIMITES[tipo];
  if (faixa === "baixa") return { gte: 0, lt: min };
  if (faixa === "media") return { gte: min, lt: max };
  if (faixa === "alta") return { gte: max, lt: null };
  return { gte: null, lt: null };
}

/** Classifica um valor de margem na faixa correspondente. */
export function faixaDaMargem(valor: number | null | undefined, tipo: TipoMargem): Exclude<FaixaMargem, "todas"> {
  const t = tipo === "qualquer" ? "emprestimo" : tipo;
  const v = Number(valor ?? 0);
  const { min, max } = FAIXA_LIMITES[t];
  if (v >= max) return "alta";
  if (v >= min) return "media";
  return "baixa";
}

export function valorDaMargem(
  row: {
    margem_disp_emprestimo?: number | null;
    margem_disp_cartao_credito?: number | null;
    margem_util_cartao_beneficio?: number | null;
  },
  tipo: TipoMargem,
): number {
  if (tipo === "cartao_credito") return Number(row.margem_disp_cartao_credito ?? 0);
  if (tipo === "cartao_beneficio") return Number(row.margem_util_cartao_beneficio ?? 0);
  if (tipo === "qualquer") {
    return Math.max(
      Number(row.margem_disp_emprestimo ?? 0),
      Number(row.margem_disp_cartao_credito ?? 0),
      Number(row.margem_util_cartao_beneficio ?? 0),
    );
  }
  return Number(row.margem_disp_emprestimo ?? 0);
}
