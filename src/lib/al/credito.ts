// Estimativa de crédito liberado a partir da margem.
// Multiplicadores são MÉDIOS — variam por banco, idade, prazo, taxa e produto.
// Apresentar sempre como faixa (min–max), nunca como valor exato.

export type MultiplicadorCredito = {
  min: number;
  medio: number;
  max: number;
};

export const MULT_PRINCIPAL: MultiplicadorCredito = { min: 40, medio: 45, max: 53 };
export const MULT_CARTAO_BENEFICIO: MultiplicadorCredito = { min: 22, medio: 27, max: 35 };
export const MULT_CARTAO_CONSIGNADO: MultiplicadorCredito = { min: 18, medio: 22, max: 28 };

export type EstimativaCredito = {
  principal: { min: number; medio: number; max: number };
  cartaoBeneficio: { min: number; medio: number; max: number };
  cartaoConsignado: { min: number; medio: number; max: number };
  total: { min: number; medio: number; max: number };
};

function aplicar(margem: number, m: MultiplicadorCredito) {
  return { min: margem * m.min, medio: margem * m.medio, max: margem * m.max };
}

export function estimarCredito(margens: {
  principal: number;
  cartaoBeneficio: number;
  cartaoConsignado: number;
}): EstimativaCredito | null {
  const vals = [margens.principal, margens.cartaoBeneficio, margens.cartaoConsignado];
  if (vals.some((v) => !Number.isFinite(v) || v < 0)) return null;

  const principal = aplicar(margens.principal, MULT_PRINCIPAL);
  const cartaoBeneficio = aplicar(margens.cartaoBeneficio, MULT_CARTAO_BENEFICIO);
  const cartaoConsignado = aplicar(margens.cartaoConsignado, MULT_CARTAO_CONSIGNADO);

  return {
    principal, cartaoBeneficio, cartaoConsignado,
    total: {
      min: principal.min + cartaoBeneficio.min + cartaoConsignado.min,
      medio: principal.medio + cartaoBeneficio.medio + cartaoConsignado.medio,
      max: principal.max + cartaoBeneficio.max + cartaoConsignado.max,
    },
  };
}
