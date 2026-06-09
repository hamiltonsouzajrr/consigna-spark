// Shared constants & helpers for the Prospecção (CRM) area.

export type LeadStatus = "novo" | "qualificado" | "proposta" | "ganho" | "perdido";
export type SlaStatus = "ok" | "atencao" | "atrasado";
export type EventKind = "ligacao" | "whatsapp" | "nota" | "status" | "followup" | "sistema";

export const STATUS_FLOW: LeadStatus[] = ["novo", "qualificado", "proposta", "ganho", "perdido"];

export const STATUS_LABEL: Record<LeadStatus, string> = {
  novo: "Novo",
  qualificado: "Qualificado",
  proposta: "Proposta",
  ganho: "Ganho",
  perdido: "Perdido",
};

export const STATUS_TONE: Record<LeadStatus, string> = {
  novo: "bg-sky-500/15 text-sky-600 dark:text-sky-400 border-sky-500/30",
  qualificado: "bg-violet-500/15 text-violet-600 dark:text-violet-400 border-violet-500/30",
  proposta: "bg-amber-500/15 text-amber-600 dark:text-amber-400 border-amber-500/30",
  ganho: "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-500/30",
  perdido: "bg-rose-500/15 text-rose-600 dark:text-rose-400 border-rose-500/30",
};

export const SLA_LABEL: Record<SlaStatus, string> = {
  ok: "No prazo",
  atencao: "Atenção",
  atrasado: "Atrasado",
};

export const SLA_TONE: Record<SlaStatus, string> = {
  ok: "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-500/30",
  atencao: "bg-amber-500/15 text-amber-600 dark:text-amber-400 border-amber-500/30",
  atrasado: "bg-rose-500/15 text-rose-600 dark:text-rose-400 border-rose-500/30",
};

export const EVENT_LABEL: Record<EventKind, string> = {
  ligacao: "Ligação",
  whatsapp: "WhatsApp",
  nota: "Nota",
  status: "Status",
  followup: "Follow-up",
  sistema: "Sistema",
};

export const LOSS_REASONS = [
  "Preço",
  "Sem resposta",
  "Fora do perfil",
  "Comprou concorrente",
  "Sem urgência",
] as const;

export const URGENCIA_LABEL: Record<string, string> = {
  alta: "Alta",
  media: "Média",
  baixa: "Baixa",
};

// Playbook by status (script / checklist shown to the consultant).
export const PLAYBOOK: Record<LeadStatus, { title: string; items: string[] }> = {
  novo: {
    title: "Script de abordagem",
    items: [
      "Apresente-se e cite o órgão/convênio do servidor.",
      "Confirme que fala com a pessoa certa e o melhor horário.",
      "Gere valor rápido: 'Fiz uma simulação prévia da sua margem'.",
      "Faça uma pergunta aberta sobre a necessidade (reforma, dívida, etc.).",
      "Agende o próximo passo antes de encerrar.",
    ],
  },
  qualificado: {
    title: "Checklist de necessidade",
    items: [
      "Confirmou margem disponível?",
      "Entendeu o objetivo do cliente?",
      "Validou prazo e valor desejado?",
      "Mapeou objeções prováveis?",
      "Definiu próxima ação com data?",
    ],
  },
  proposta: {
    title: "Objeções comuns",
    items: [
      "'Tá caro' → mostre o valor da parcela e o custo de não resolver agora.",
      "'Vou pensar' → agende retorno com data e pergunte o que falta decidir.",
      "'Já tenho proposta' → compare condições e destaque o diferencial.",
      "'Tenho medo de me endividar' → reforce o desconto em folha e o controle.",
    ],
  },
  ganho: {
    title: "Fechamento",
    items: [
      "Confirme documentação necessária.",
      "Explique os próximos passos e prazos.",
      "Peça indicação de colegas servidores.",
    ],
  },
  perdido: {
    title: "Motivo de perda obrigatório",
    items: [
      "Registre o motivo real da perda.",
      "Anote se vale reabordar no futuro (ex.: nova margem).",
    ],
  },
};

export function scoreTone(score: number): string {
  if (score >= 70) return "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-500/30";
  if (score >= 40) return "bg-amber-500/15 text-amber-600 dark:text-amber-400 border-amber-500/30";
  return "bg-muted text-muted-foreground border-border";
}

export function scoreLabel(score: number): string {
  if (score >= 70) return "Quente";
  if (score >= 40) return "Morno";
  return "Frio";
}

// Normalize a Brazilian phone number into the digits wa.me expects (with 55 country code).
export function normalizeWhatsappNumber(phone?: string | null): string | null {
  if (!phone) return null;
  let d = phone.replace(/\D/g, "");
  if (!d) return null;
  // Drop a leading trunk zero if present (e.g. 082...).
  if (d.length > 11 && d.startsWith("0")) d = d.replace(/^0+/, "");
  // Add Brazil country code when it looks like a local number (10-11 digits).
  if (d.length === 10 || d.length === 11) d = `55${d}`;
  return d.length >= 12 ? d : null;
}

export function whatsappLink(phone?: string | null, message?: string): string | null {
  const num = normalizeWhatsappNumber(phone);
  if (!num) return null;
  const base = `https://wa.me/${num}`;
  return message ? `${base}?text=${encodeURIComponent(message)}` : base;
}

