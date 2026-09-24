// Nota de confiança do telefone (0–100). Pesos simples e fáceis de ajustar.
import type { NivelTelefone, RockdataTelefone } from "@/lib/consultas/rockdata.server";

export type SinaisInternos = {
  respondeuWhatsapp?: boolean;
  contatadoCrm?: boolean;
  informadoConsultora?: boolean;
};

export function pontuarTelefone(t: RockdataTelefone, interno: SinaisInternos = {}): RockdataTelefone {
  const sinais: string[] = [];
  let score = Math.round(Math.min(5, Math.max(0, t.qualificacao)) * 10); // até 50
  if (t.qualificacao > 0) sinais.push(`${t.qualificacao.toLocaleString("pt-BR")} estrelas na RockData`);
  if (t.tipo === "celular") { score += 10; sinais.push("Celular"); }
  if (t.tipo === "fixo") { score -= 5; sinais.push("Fixo"); }
  if (t.whatsapp) { score += 15; sinais.push("Tem WhatsApp"); }
  if (t.restricao) { score -= 25; sinais.push("Com restrição"); }
  if (interno.respondeuWhatsapp) { score += 20; sinais.push("Já respondeu no WhatsApp"); }
  if (interno.contatadoCrm) { score += 10; sinais.push("Já contatado pelo CRM"); }
  if (interno.informadoConsultora) { score += 10; sinais.push("Informado por consultora"); }
  score = Math.max(0, Math.min(100, score));
  const semSinais =
    t.qualificacao <= 0 && !t.tipo && !t.whatsapp && !t.restricao &&
    !interno.respondeuWhatsapp && !interno.contatadoCrm && !interno.informadoConsultora;
  const nivel: NivelTelefone =
    semSinais ? "desconhecido" : t.restricao && score < 30 ? "invalido" : score >= 55 ? "confiavel" : score >= 35 ? "bom" : score >= 15 ? "duvidoso" : "invalido";
  return { ...t, score, nivel, sinais };
}

export const NIVEL_ROTULO: Record<NivelTelefone, string> = {
  confiavel: "Mais confiável",
  bom: "Bom",
  duvidoso: "Duvidoso",
  invalido: "Inválido",
  desconhecido: "Sem avaliação",
};
