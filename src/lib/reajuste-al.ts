// Módulos de cálculo para Simulação de Reajuste Salarial AL
// Arquitetura escalável: cada função é independente e parametrizável.

export type OrgaoAL =
  | "estado_al"
  | "educacao"
  | "saude"
  | "pmal"
  | "bombeiros"
  | "tjal"
  | "ale"
  | "mp"
  | "prefeitura"
  | "rpps_municipal"
  | "inss";

export const ORGAOS_AL: { value: OrgaoAL; label: string }[] = [
  { value: "estado_al", label: "Estado AL" },
  { value: "educacao", label: "Educação" },
  { value: "saude", label: "Saúde" },
  { value: "pmal", label: "PMAL" },
  { value: "bombeiros", label: "Bombeiros" },
  { value: "tjal", label: "TJAL" },
  { value: "ale", label: "ALE" },
  { value: "mp", label: "MP" },
  { value: "prefeitura", label: "Prefeitura" },
  { value: "rpps_municipal", label: "RPPS Municipal" },
  { value: "inss", label: "INSS" },
];

// ============================================================================
// Tabela progressiva AL Previdência
// ============================================================================
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
 * Calcula previdência progressiva sobre uma base (ex: novo subsídio).
 * Cada faixa aplica sua alíquota apenas sobre a parcela dentro dela.
 */
export function calcPrevidenciaProgressiva(base: number, faixas: Faixa[] = FAIXAS_PREVIDENCIA_AL): number {
  if (base <= 0) return 0;
  let total = 0;
  let anterior = 0;
  for (const f of faixas) {
    if (base <= anterior) break;
    const teto = Math.min(base, f.ate);
    total += (teto - anterior) * f.aliquota;
    anterior = f.ate;
    if (base <= f.ate) break;
  }
  return total;
}

// ============================================================================
// Imposto de Renda (tabela simplificada por faixa marginal sobre o aumento)
// ============================================================================
export const FAIXAS_IR: Faixa[] = [
  { ate: 2259, aliquota: 0 },
  { ate: 2826, aliquota: 0.075 },
  { ate: 3751, aliquota: 0.15 },
  { ate: 4665, aliquota: 0.225 },
  { ate: Infinity, aliquota: 0.275 },
];

export function aliquotaIR(subsidio: number): number {
  for (const f of FAIXAS_IR) if (subsidio <= f.ate) return f.aliquota;
  return 0.275;
}

// ============================================================================
// Coeficientes de margem do Estado de Alagoas
// ============================================================================
export const COEF_MARGEM_AL = {
  principal: 0.40,
  cartaoBeneficio: 0.15,
  cartaoConsignado: 0.10,
} as const;

export function calcMargens(liquido: number) {
  return {
    principal: liquido * COEF_MARGEM_AL.principal,
    cartaoBeneficio: liquido * COEF_MARGEM_AL.cartaoBeneficio,
    cartaoConsignado: liquido * COEF_MARGEM_AL.cartaoConsignado,
  };
}

// ============================================================================
// Multiplicadores médios de estimativa de crédito
// ============================================================================
export const MULT_CREDITO = {
  principal: 45,
  cartaoBeneficio: 27,
  cartaoConsignado: 22,
} as const;

export function estimarCredito(margens: ReturnType<typeof calcMargens>) {
  return {
    principal: margens.principal * MULT_CREDITO.principal,
    cartaoBeneficio: margens.cartaoBeneficio * MULT_CREDITO.cartaoBeneficio,
    cartaoConsignado: margens.cartaoConsignado * MULT_CREDITO.cartaoConsignado,
    get total() {
      return this.principal + this.cartaoBeneficio + this.cartaoConsignado;
    },
  };
}

// ============================================================================
// Simulação completa
// ============================================================================
export type SimulacaoReajuste = {
  subsidio: number;
  percentual: number;
  orgao: OrgaoAL;
  bruto: number;
  novoSubsidio: number;
  descPrevidencia: number;
  aliquotaIRPct: number;
  descIR: number;
  liquido: number;
  margens: ReturnType<typeof calcMargens>;
  credito: ReturnType<typeof estimarCredito>;
};

export function simularReajuste(
  subsidio: number,
  percentual: number,
  orgao: OrgaoAL = "estado_al"
): SimulacaoReajuste | null {
  if (subsidio <= 0 || percentual <= 0) return null;
  const bruto = subsidio * percentual;
  const novoSubsidio = subsidio + bruto;

  // Previdência incremental: diferença entre prev(novo) e prev(atual)
  const prevAtual = calcPrevidenciaProgressiva(subsidio);
  const prevNovo = calcPrevidenciaProgressiva(novoSubsidio);
  const descPrevidencia = prevNovo - prevAtual;

  const aliqIR = aliquotaIR(novoSubsidio);
  const descIR = bruto * aliqIR;

  const liquido = Math.max(0, bruto - descPrevidencia - descIR);
  const margens = calcMargens(liquido);
  const credito = estimarCredito(margens);

  return {
    subsidio, percentual, orgao,
    bruto, novoSubsidio,
    descPrevidencia, aliquotaIRPct: aliqIR, descIR,
    liquido, margens, credito,
  };
}

// ============================================================================
// Formatação BRL
// ============================================================================
export const brl = (n: number) =>
  (isFinite(n) ? n : 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

export function gerarTextoWhatsapp(sim: SimulacaoReajuste): string {
  const pct = (sim.percentual * 100).toFixed(sim.percentual * 100 % 1 === 0 ? 0 : 1);
  return (
`Com o reajuste salarial de ${pct}%, seu aumento líquido estimado será de ${brl(sim.liquido)}.

Isso poderá liberar aproximadamente:

• ${brl(sim.margens.principal)} de margem principal
• ${brl(sim.margens.cartaoBeneficio)} de cartão benefício
• ${brl(sim.margens.cartaoConsignado)} de cartão consignado

Estimativa média de crédito disponível:
até ${brl(sim.credito.total)} dependendo da análise.`
  );
}
