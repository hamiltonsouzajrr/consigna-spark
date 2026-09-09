// Tabela de coeficientes Banese (prazo -> coeficiente), usada tanto na
// calculadora de margem quanto na estimativa de crédito na ficha do lead.
// Coeficientes de referência: valor liberado = parcela (margem) x coeficiente.

export const COEFICIENTES: Record<number, number> = {
  1: 0.98, 2: 1.93, 3: 2.85, 4: 3.75, 5: 4.62, 6: 5.47, 7: 6.3, 8: 7.1, 9: 7.89,
  10: 8.65, 11: 9.4, 12: 10.2564, 13: 10.93, 14: 11.58, 15: 12.22, 16: 12.85,
  17: 13.46, 18: 14.06, 19: 14.65, 20: 15.22, 21: 15.78, 22: 16.33, 23: 16.87,
  24: 17.9144, 25: 18.35, 26: 18.79, 27: 19.23, 28: 19.67, 29: 20.11, 30: 20.56,
  31: 21.0, 32: 21.44, 33: 21.88, 34: 22.33, 35: 22.77, 36: 23.5987, 37: 24.13,
  38: 24.66, 39: 25.19, 40: 25.72, 41: 26.25, 42: 26.78, 43: 27.31, 44: 27.49,
  45: 27.61, 46: 27.72, 47: 27.78, 48: 27.8347, 49: 28.09, 50: 28.35, 51: 28.61,
  52: 28.87, 53: 29.13, 54: 29.39, 55: 29.65, 56: 29.91, 57: 30.17, 58: 30.43,
  59: 30.69, 60: 30.95, 61: 31.25, 62: 31.55, 63: 31.84, 64: 32.14, 65: 32.44,
  66: 32.74, 67: 33.03, 68: 33.33, 69: 33.63, 70: 33.92, 71: 34.22, 72: 34.52,
  73: 34.82, 74: 35.11, 75: 35.41, 76: 35.71, 77: 36.0, 78: 36.3, 79: 36.6,
  80: 36.9, 81: 37.19, 82: 37.49, 83: 37.79, 84: 38.09, 85: 38.2, 86: 38.31,
  87: 38.42, 88: 38.53, 89: 38.64, 90: 38.75, 91: 38.86, 92: 38.97, 93: 39.08,
  94: 39.19, 95: 39.3, 96: 39.41, 97: 39.52, 98: 39.63, 99: 39.74, 100: 39.86,
  101: 39.97, 102: 40.08, 103: 40.19, 104: 40.3, 105: 40.41, 106: 40.52,
  107: 40.63, 108: 40.74, 109: 40.85, 110: 40.96, 111: 41.07, 112: 41.18,
  113: 41.29, 114: 41.4, 115: 41.51, 116: 41.62, 117: 41.73, 118: 41.83,
  119: 41.94, 120: 42.0415,
};

/** Prazo padrão para margem de empréstimo. */
export const PRAZO_EMPRESTIMO_PADRAO = 96;
/** Prazo fixo dos cartões (crédito e benefício). */
export const PRAZO_CARTAO = 90;

/** Prazos oferecidos no seletor da ficha do lead. */
export const PRAZOS_FICHA = [24, 36, 48, 60, 72, 84, 96, 108, 120];

/** Valor liberado aproximado para uma margem no prazo informado. */
export function valorLiberado(margem: number | null, prazo: number): number | null {
  const coef = COEFICIENTES[prazo];
  if (margem == null || !Number.isFinite(margem) || margem <= 0 || !coef) return null;
  return Math.round(margem * coef * 100) / 100;
}
