// Margens consignáveis — coeficientes médios do Estado de Alagoas.
// IMPORTANTE: estes são valores de REFERÊNCIA. Cada órgão pode variar.
// Sempre apresentar como ESTIMATIVA, nunca como valor garantido.

export type CoefMargem = {
  principal: number;
  cartaoBeneficio: number;
  cartaoConsignado: number;
};

export const COEF_MARGEM_AL_PADRAO: CoefMargem = {
  principal: 0.45,
  cartaoBeneficio: 0.15,
  cartaoConsignado: 0.10,
};

/** Coeficientes por órgão. Atualmente todos seguem o padrão — estrutura pronta para divergência futura. */
export const COEF_POR_ORGAO: Record<string, CoefMargem> = {
  estado_al:       COEF_MARGEM_AL_PADRAO,
  educacao:        COEF_MARGEM_AL_PADRAO,
  saude:           COEF_MARGEM_AL_PADRAO,
  pmal:            COEF_MARGEM_AL_PADRAO,
  bombeiros:       COEF_MARGEM_AL_PADRAO,
  tjal:            COEF_MARGEM_AL_PADRAO,
  ale:             COEF_MARGEM_AL_PADRAO,
  mp:              COEF_MARGEM_AL_PADRAO,
  prefeitura:      COEF_MARGEM_AL_PADRAO,
  rpps_municipal:  COEF_MARGEM_AL_PADRAO,
  inss:            COEF_MARGEM_AL_PADRAO,
};

export type Margens = {
  principal: number;
  cartaoBeneficio: number;
  cartaoConsignado: number;
  total: number;
};

/**
 * Calcula margens sobre o líquido consignável. Retorna null em entrada inválida.
 * Líquido consignável = base do servidor após descontos compulsórios.
 */
export function calcMargens(liquidoConsignavel: number, orgao = "estado_al"): Margens | null {
  if (!Number.isFinite(liquidoConsignavel) || liquidoConsignavel < 0) return null;
  const c = COEF_POR_ORGAO[orgao] ?? COEF_MARGEM_AL_PADRAO;
  const principal = liquidoConsignavel * c.principal;
  const cartaoBeneficio = liquidoConsignavel * c.cartaoBeneficio;
  const cartaoConsignado = liquidoConsignavel * c.cartaoConsignado;
  return {
    principal,
    cartaoBeneficio,
    cartaoConsignado,
    total: principal + cartaoBeneficio + cartaoConsignado,
  };
}
