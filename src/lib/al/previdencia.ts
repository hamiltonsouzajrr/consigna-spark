// Previdência progressiva — Estado de Alagoas
// Cada faixa é aplicada APENAS sobre a parcela do salário dentro dela.
// Nunca aplicar alíquota única sobre o total.

export type Faixa = { ate: number; aliquota: number };

export const FAIXAS_PREVIDENCIA_AL: Faixa[] = [
  { ate: 1300, aliquota: 0.075 },
  { ate: 2570, aliquota: 0.09 },
  { ate: 3850, aliquota: 0.12 },
  { ate: 7500, aliquota: 0.14 },
  { ate: 12800, aliquota: 0.145 },
  { ate: 25700, aliquota: 0.165 },
  { ate: 50000, aliquota: 0.19 },
  { ate: Infinity, aliquota: 0.22 },
];

/**
 * Previdência progressiva: soma das parcelas (teto_faixa - piso_faixa) * alíquota.
 * Retorna null se a base for inválida (NaN, Infinity, negativo).
 */
export function calcPrevidenciaProgressiva(
  base: number,
  faixas: Faixa[] = FAIXAS_PREVIDENCIA_AL,
): number | null {
  if (!Number.isFinite(base) || base < 0) return null;
  if (base === 0) return 0;
  let total = 0;
  let anterior = 0;
  for (const f of faixas) {
    if (base <= anterior) break;
    const teto = Math.min(base, f.ate);
    total += (teto - anterior) * f.aliquota;
    anterior = f.ate;
    if (base <= f.ate) break;
  }
  return Number.isFinite(total) ? total : null;
}

/**
 * Previdência incremental sobre um aumento: diferença entre
 * previdência do novo subsídio e do subsídio atual.
 * Reflete o impacto REAL de um reajuste, considerando mudança de faixa.
 */
export function calcPrevidenciaIncremental(
  subsidioAtual: number,
  novoSubsidio: number,
): number | null {
  const a = calcPrevidenciaProgressiva(subsidioAtual);
  const b = calcPrevidenciaProgressiva(novoSubsidio);
  if (a === null || b === null) return null;
  return Math.max(0, b - a);
}
