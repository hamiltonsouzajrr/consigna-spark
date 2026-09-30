/** Regras do roteiro "Compra de Dívida – Transfer NG Card – Gov. Alagoas". */
export const NG = {
  trocoMinimo: 50,
  taxaPlanilha: "3,89%",
  empregador: "000191 - GOVERNO DO ESTADO DE ALAGOAS_CARTAO DE CRED_RMC_TRANSFER NG",
  produto: "59 - Cartão de Crédito Consignado_100_CDD_TRANSFER NG",
  tipoProposta: "Cartão – Compra de Dívida",
  historico: "Carta Saldo",
  banco: "999 - VEM BENEFÍCIOS",
  esteira: "10 - Cartão_Transfer NG_CDD_TEP",
  tabelas: [
    { codigo: "NG00419", taxa: "4,25%" },
    { codigo: "NG00359", taxa: "4,50%" },
    { codigo: "NG00386", taxa: "4,80%" },
    { codigo: "NG00360", taxa: "4,99%" },
  ],
  documentos: [
    "Termo de confissão de dívida",
    "Formulário Vem Benefícios – Solicitação de saldo devedor",
    "Formulário Vem Benefícios – Autorização de quitação de saldo",
  ],
  corteMesa: 14,
  corteFinanceiro: 15,
  liberacaoHoras: 48,
} as const;

export const NG_ETAPAS: Record<string, { label: string; cls: string }> = {
  novo: { label: "Novo", cls: "bg-sky-100 text-sky-800" },
  contatado: { label: "Contatado", cls: "bg-slate-100 text-slate-700" },
  interessado: { label: "Interessado", cls: "bg-amber-100 text-amber-800" },
  documentos: { label: "Documentos pendentes", cls: "bg-orange-100 text-orange-800" },
  digitada: { label: "Digitada", cls: "bg-indigo-100 text-indigo-800" },
  validacao: { label: "Aguardando validação do órgão", cls: "bg-violet-100 text-violet-800" },
  liberada: { label: "Liberada", cls: "bg-emerald-100 text-emerald-800" },
  recusada: { label: "Recusada", cls: "bg-rose-100 text-rose-700" },
};

export const NG_CHECKLIST = [
  { k: "cliente_novo", l: "Cliente é novo (roteiro aceita somente clientes novos)" },
  { k: "empregador", l: `Empregador ${NG.empregador.split(" - ")[0]}, produto 59 e tipo "${NG.tipoProposta}"` },
  { k: "carta_saldo", l: `Histórico "${NG.historico}" (boleto não é permitido) e banco ${NG.banco}` },
  { k: "contratos", l: "Consultar pela lupa, carregar e selecionar TODOS os contratos" },
  { k: "tabela", l: "Exibir Tabelas → escolher a taxa → Simular Saque → Solicitar Proposta" },
  { k: "docs", l: "Termo de confissão de dívida + 2 formulários Vem Benefícios" },
] as const;

/** Hora atual em Maceió (UTC-3). */
export function agoraMaceio(now = Date.now()) {
  const d = new Date(now - 3 * 3600_000);
  return { h: d.getUTCHours(), m: d.getUTCMinutes(), dow: d.getUTCDay() };
}

/** Previsão de liberação: 48h a partir do envio; após o corte do financeiro conta a partir do próximo dia útil. */
export function previsaoLiberacao(now = Date.now()): Date {
  const { h, dow } = agoraMaceio(now);
  let base = now;
  if (h >= NG.corteFinanceiro || dow === 0 || dow === 6) {
    const d = new Date(now - 3 * 3600_000);
    d.setUTCHours(9 + 3, 0, 0, 0);
    do { d.setUTCDate(d.getUTCDate() + 1); } while (d.getUTCDay() === 0 || d.getUTCDay() === 6);
    base = d.getTime();
  }
  return new Date(base + NG.liberacaoHoras * 3600_000);
}

/** Nota de prioridade 0–100: troco, proporção paga e status aprovado. */
export function prioridadeNg(c: { prazos?: Record<string, { troco: number | null }>; pagas?: number | null; plano?: number | null; status?: string | null }) {
  const trocos = Object.values(c.prazos ?? {}).map((p) => p.troco ?? -Infinity);
  const melhor = trocos.length ? Math.max(...trocos) : 0;
  const t = Math.max(0, Math.min(1, melhor / 3000)) * 55;
  const p = c.pagas && c.plano ? Math.min(1, c.pagas / c.plano) * 30 : 0;
  const s = /aprovad/i.test(c.status ?? "") ? 15 : 0;
  return Math.round(t + p + s);
}

export function melhorTrocoNg(prazos?: Record<string, { troco: number | null }>) {
  let best: number | null = null;
  for (const v of Object.values(prazos ?? {})) if (v.troco != null && (best == null || v.troco > best)) best = v.troco;
  return best;
}
