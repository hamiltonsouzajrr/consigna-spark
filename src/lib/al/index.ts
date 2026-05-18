// Orquestrador — Simulação de Reajuste Salarial AL
// Combina previdência, IR, margem e crédito de forma defensiva.

import { calcPrevidenciaProgressiva, calcPrevidenciaIncremental } from "./previdencia";
import { aliquotaIR, calcIRIncremental } from "./imposto";
import { calcMargens, COEF_POR_ORGAO, type Margens } from "./margem";
import { estimarCredito, type EstimativaCredito } from "./credito";

export type OrgaoAL =
  | "estado_al" | "educacao" | "saude" | "pmal" | "bombeiros"
  | "tjal" | "ale" | "mp" | "prefeitura" | "rpps_municipal" | "inss";

export const ORGAOS_AL: { value: OrgaoAL; label: string; obs?: string }[] = [
  { value: "estado_al",       label: "Estado AL" },
  { value: "educacao",        label: "Educação", obs: "Possui gratificações que podem alterar margem." },
  { value: "saude",           label: "Saúde", obs: "Plantões e produtividade alteram base de cálculo." },
  { value: "pmal",            label: "PMAL", obs: "Risco de vida e gratificações específicas." },
  { value: "bombeiros",       label: "Bombeiros", obs: "Verbas indenizatórias podem alterar margem." },
  { value: "tjal",            label: "TJAL", obs: "Folha possui verbas próprias do Judiciário." },
  { value: "ale",             label: "ALE", obs: "Verbas próprias do Legislativo." },
  { value: "mp",              label: "MP", obs: "Verbas próprias do Ministério Público." },
  { value: "prefeitura",      label: "Prefeitura" },
  { value: "rpps_municipal",  label: "RPPS Municipal" },
  { value: "inss",            label: "INSS" },
];

// ============================================================================
// Validação de input
// ============================================================================
export type ValidationError = { field: "subsidio" | "percentual" | "orgao"; message: string };

const SUBSIDIO_MAX = 200_000;       // R$ 200 mil — limite sanitário
const REAJUSTE_MAX = 1;             // 100%

export function validarEntrada(subsidio: number, percentual: number, orgao: string): ValidationError[] {
  const errs: ValidationError[] = [];
  if (!Number.isFinite(subsidio) || subsidio <= 0) {
    errs.push({ field: "subsidio", message: "Informe um subsídio válido (> 0)." });
  } else if (subsidio > SUBSIDIO_MAX) {
    errs.push({ field: "subsidio", message: `Valor acima do limite (R$ ${SUBSIDIO_MAX.toLocaleString("pt-BR")}).` });
  }
  if (!Number.isFinite(percentual) || percentual <= 0) {
    errs.push({ field: "percentual", message: "Informe um percentual de reajuste válido (> 0%)." });
  } else if (percentual > REAJUSTE_MAX) {
    errs.push({ field: "percentual", message: "Percentual acima de 100% — verifique o valor digitado." });
  }
  if (!COEF_POR_ORGAO[orgao]) {
    errs.push({ field: "orgao", message: "Órgão inválido." });
  }
  return errs;
}

// ============================================================================
// Simulação
// ============================================================================
export type SimulacaoOk = {
  ok: true;
  inputs: { subsidio: number; percentual: number; orgao: OrgaoAL };
  bruto: number;
  novoSubsidio: number;
  descPrevidencia: number;
  aliquotaIRPct: number;
  descIR: number;
  liquido: number;
  margens: Margens;
  credito: EstimativaCredito;
  // metadados para auditoria
  meta: {
    coeficientes: typeof COEF_POR_ORGAO[string];
    calculadoEm: string; // ISO
    versao: string;
  };
};

export type SimulacaoErro = { ok: false; errors: ValidationError[] };
export type ResultadoSimulacao = SimulacaoOk | SimulacaoErro;

const VERSAO_CALCULO = "al.reajuste@1.1.0";

export function simularReajuste(
  subsidio: number,
  percentual: number,
  orgao: OrgaoAL = "estado_al",
): ResultadoSimulacao {
  const errors = validarEntrada(subsidio, percentual, orgao);
  if (errors.length > 0) return { ok: false, errors };

  try {
    const bruto = subsidio * percentual;
    const novoSubsidio = subsidio + bruto;

    // Previdência incremental (progressiva real)
    const descPrevidencia = calcPrevidenciaIncremental(subsidio, novoSubsidio);
    if (descPrevidencia === null) {
      return { ok: false, errors: [{ field: "subsidio", message: "Falha ao calcular previdência." }] };
    }

    // Base tributável = subsídio - previdência (do mês). Aplicamos IR incremental.
    const prevAtual = calcPrevidenciaProgressiva(subsidio) ?? 0;
    const prevNovo = calcPrevidenciaProgressiva(novoSubsidio) ?? 0;
    const baseIRAtual = Math.max(0, subsidio - prevAtual);
    const baseIRNova  = Math.max(0, novoSubsidio - prevNovo);

    const descIR = calcIRIncremental(baseIRAtual, baseIRNova);
    if (descIR === null) {
      return { ok: false, errors: [{ field: "subsidio", message: "Falha ao calcular IR." }] };
    }

    const liquido = Math.max(0, bruto - descPrevidencia - descIR);

    const margens = calcMargens(liquido, orgao);
    if (!margens) {
      return { ok: false, errors: [{ field: "subsidio", message: "Falha ao calcular margens." }] };
    }

    const credito = estimarCredito(margens);
    if (!credito) {
      return { ok: false, errors: [{ field: "subsidio", message: "Falha ao estimar crédito." }] };
    }

    return {
      ok: true,
      inputs: { subsidio, percentual, orgao },
      bruto,
      novoSubsidio,
      descPrevidencia,
      aliquotaIRPct: aliquotaIR(baseIRNova),
      descIR,
      liquido,
      margens,
      credito,
      meta: {
        coeficientes: COEF_POR_ORGAO[orgao],
        calculadoEm: new Date().toISOString(),
        versao: VERSAO_CALCULO,
      },
    };
  } catch {
    return { ok: false, errors: [{ field: "subsidio", message: "Não foi possível calcular." }] };
  }
}

// ============================================================================
// Auditoria / logs locais (não sai do navegador)
// ============================================================================
const LOG_KEY = "al.reajuste.logs";
const LOG_LIMIT = 50;

export type LogSimulacao = {
  at: string;
  subsidio: number;
  percentual: number;
  orgao: string;
  liquido?: number;
  ok: boolean;
};

export function registrarLog(entry: LogSimulacao): void {
  if (typeof window === "undefined") return;
  try {
    const raw = window.localStorage.getItem(LOG_KEY);
    const arr: LogSimulacao[] = raw ? JSON.parse(raw) : [];
    arr.unshift(entry);
    window.localStorage.setItem(LOG_KEY, JSON.stringify(arr.slice(0, LOG_LIMIT)));
  } catch {
    // silencioso — log é best-effort
  }
}

export function lerLogs(): LogSimulacao[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(LOG_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

// ============================================================================
// Formatação
// ============================================================================
export const brl = (n: number) =>
  (Number.isFinite(n) ? n : 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

export function gerarTextoWhatsapp(sim: SimulacaoOk): string {
  const pct = (sim.inputs.percentual * 100).toFixed(sim.inputs.percentual * 100 % 1 === 0 ? 0 : 1);
  return (
`Com o reajuste salarial de ${pct}%, seu aumento líquido estimado será de ${brl(sim.liquido)}.

Isso poderá liberar aproximadamente:

• ${brl(sim.margens.principal)} de margem principal
• ${brl(sim.margens.cartaoBeneficio)} de cartão benefício
• ${brl(sim.margens.cartaoConsignado)} de cartão consignado

Estimativa média de crédito disponível:
${brl(sim.credito.total.min)} a ${brl(sim.credito.total.max)} (média ${brl(sim.credito.total.medio)}), dependendo da análise.

* Valores simulados com base em estimativas médias do Estado de Alagoas.`
  );
}

// Re-exports convenientes
export { COEF_POR_ORGAO };
