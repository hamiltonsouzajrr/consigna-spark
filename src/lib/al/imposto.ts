// Imposto de Renda — tabela progressiva (Receita Federal 2024+).
// IR também é progressivo: cada faixa tem alíquota e parcela a deduzir.

export type FaixaIR = { ate: number; aliquota: number; deduzir: number };

export const FAIXAS_IR: FaixaIR[] = [
  { ate: 2259.20, aliquota: 0,     deduzir: 0 },
  { ate: 2826.65, aliquota: 0.075, deduzir: 169.44 },
  { ate: 3751.05, aliquota: 0.15,  deduzir: 381.44 },
  { ate: 4664.68, aliquota: 0.225, deduzir: 662.77 },
  { ate: Infinity, aliquota: 0.275, deduzir: 896.00 },
];

function faixaPara(base: number): FaixaIR {
  for (const f of FAIXAS_IR) if (base <= f.ate) return f;
  return FAIXAS_IR[FAIXAS_IR.length - 1];
}

/** Alíquota marginal aplicável ao subsídio. */
export function aliquotaIR(subsidio: number): number {
  if (!Number.isFinite(subsidio) || subsidio < 0) return 0;
  return faixaPara(subsidio).aliquota;
}

/**
 * IR progressivo (alíquota × base − parcela a deduzir).
 * Após desconto da previdência. Retorna null em entrada inválida.
 */
export function calcIRProgressivo(baseTributavel: number): number | null {
  if (!Number.isFinite(baseTributavel) || baseTributavel < 0) return null;
  const f = faixaPara(baseTributavel);
  const ir = baseTributavel * f.aliquota - f.deduzir;
  return Math.max(0, ir);
}

/**
 * IR incremental sobre um aumento, após considerar a previdência incremental.
 * baseAtual e baseNova devem ser bases tributáveis (subsídio - previdência).
 */
export function calcIRIncremental(
  baseAtual: number,
  baseNova: number,
): number | null {
  const a = calcIRProgressivo(baseAtual);
  const b = calcIRProgressivo(baseNova);
  if (a === null || b === null) return null;
  return Math.max(0, b - a);
}
