// ============================================================
// POSITIVA IA — bibliotecas de conhecimento (consignado 40+)
// ============================================================

export type Periodo = "08h" | "11h" | "15h" | "17h";
export type AtividadeTipo = "ligacao" | "prospeccao" | "proposta" | "followup" | "contrato" | "reativacao" | "agendamento";
export type HumorEstado = "motivada" | "normal" | "cansada" | "desanimada";

export const ATIVIDADE_LABEL: Record<AtividadeTipo, string> = {
  ligacao: "Ligações",
  prospeccao: "Prospecções",
  proposta: "Propostas",
  followup: "Follow-ups",
  contrato: "Contratos",
  reativacao: "Reativações",
  agendamento: "Agendamentos",
};

export const HUMOR_LABEL: Record<HumorEstado, string> = {
  motivada: "Motivada",
  normal: "Normal",
  cansada: "Cansada",
  desanimada: "Desanimada",
};

export const HUMOR_EMOJI: Record<HumorEstado, string> = {
  motivada: "🚀",
  normal: "🙂",
  cansada: "😮‍💨",
  desanimada: "😔",
};

export const ENERGIA_LABEL: Record<number, string> = {
  1: "Baixa",
  2: "Normal",
  3: "Excelente",
};

// ---------------- Check-in de performance ----------------
export type CheckinPergunta = { key: string; label: string; tipo: "number" | "text" | "energia" };
export const CHECKINS: Record<Periodo, { titulo: string; subtitulo: string; perguntas: CheckinPergunta[] }> = {
  "08h": {
    titulo: "Check-in da manhã",
    subtitulo: "Bom dia! Vamos planejar um dia de alta performance.",
    perguntas: [
      { key: "meta_contratos", label: "Qual é sua meta de contratos hoje?", tipo: "number" },
      { key: "contatos_planejados", label: "Quantos contatos pretende realizar?", tipo: "number" },
      { key: "reativacoes_planejadas", label: "Quantos clientes antigos pretende reativar?", tipo: "number" },
      { key: "energia", label: "Como está sua energia hoje?", tipo: "energia" },
    ],
  },
  "11h": {
    titulo: "Pulso das 11h",
    subtitulo: "Como está o ritmo? Vamos manter o gás.",
    perguntas: [
      { key: "contatos_realizados", label: "Quantos contatos já realizou?", tipo: "number" },
      { key: "oportunidades", label: "Houve alguma oportunidade interessante?", tipo: "text" },
      { key: "interesse", label: "Algum cliente demonstrou interesse?", tipo: "text" },
      { key: "travada", label: "Alguma negociação está travada?", tipo: "text" },
    ],
  },
  "15h": {
    titulo: "Reta da tarde (15h)",
    subtitulo: "Hora de transformar conversa em proposta.",
    perguntas: [
      { key: "propostas_enviadas", label: "Quantas propostas foram enviadas?", tipo: "number" },
      { key: "retornos_agendados", label: "Quantos retornos foram agendados?", tipo: "number" },
      { key: "objecao_dificil", label: "Existe alguma objeção difícil?", tipo: "text" },
    ],
  },
  "17h": {
    titulo: "Fechamento do dia (17h)",
    subtitulo: "Vamos celebrar e aprender com o dia.",
    perguntas: [
      { key: "contratos_fechados", label: "Quantos contratos fechou?", tipo: "number" },
      { key: "fez_bem", label: "O que fez bem hoje?", tipo: "text" },
      { key: "melhorar", label: "O que pode melhorar amanhã?", tipo: "text" },
    ],
  },
};

export function periodoAtual(d = new Date()): Periodo | null {
  const h = d.getHours();
  if (h >= 8 && h < 11) return "08h";
  if (h >= 11 && h < 15) return "11h";
  if (h >= 15 && h < 17) return "15h";
  if (h >= 17 && h < 20) return "17h";
  return null;
}

// ---------------- Palavras recomendadas ----------------
export const PALAVRAS_EVITAR: { evitar: string; usar: string }[] = [
  { evitar: "Problema", usar: "Situação financeira" },
  { evitar: "Dívida", usar: "Organização financeira" },
  { evitar: "Parcela", usar: "Investimento mensal" },
  { evitar: "Empréstimo", usar: "Crédito / Liberação / Planejamento" },
];
export const PALAVRAS_RECOMENDADAS = [
  "Situação financeira",
  "Organização financeira",
  "Investimento mensal",
  "Crédito",
  "Liberação",
  "Planejamento",
];

// ---------------- Objeções ----------------
export type Objecao = {
  gatilhoNome: string; // o que o cliente diz
  explicacao: string;
  pergunta: string;
  gatilhos: string[];
  script: string;
  proximoPasso: string;
};

export const OBJECOES: Objecao[] = [
  {
    gatilhoNome: "Vou pensar",
    explicacao: "Quase nunca significa 'não'. Geralmente é falta de clareza, medo de errar ou uma dúvida não resolvida.",
    pergunta: "Claro, faz todo sentido decidir com calma. Só para eu te ajudar melhor: o que exatamente você gostaria de pensar — o valor, o prazo ou a segurança da operação?",
    gatilhos: ["Reciprocidade", "Clareza", "Autoridade consultiva"],
    script: "Perfeito, decisão importante a gente pensa mesmo. Posso te ajudar a pensar agora? Em 2 minutos eu te mostro exatamente como fica sua organização financeira, sem compromisso. Assim você pensa com todos os números na mão.",
    proximoPasso: "Agendar retorno com data/hora definida e enviar resumo com números.",
  },
  {
    gatilhoNome: "Agora não",
    explicacao: "Momento percebido como ruim. O cliente ainda não viu valor suficiente para priorizar.",
    pergunta: "Entendo perfeitamente. Quando você imagina que seria um bom momento para a gente organizar isso com tranquilidade?",
    gatilhos: ["Empatia", "Planejamento", "Compromisso futuro"],
    script: "Sem pressa nenhuma. Justamente por isso quero deixar tudo pronto agora, para quando você decidir ser só um 'sim'. Posso te enviar a simulação para você olhar no seu tempo?",
    proximoPasso: "Enviar material e marcar follow-up para a data sugerida.",
  },
  {
    gatilhoNome: "Está caro",
    explicacao: "Percepção de valor abaixo do custo. Falta ancoragem e comparação correta.",
    pergunta: "Caro comparado a quê? Me ajuda a entender o que você esperava de investimento mensal?",
    gatilhos: ["Ancoragem", "Comparação", "Valor x custo"],
    script: "Entendo. Veja: como o desconto é direto em folha, o investimento mensal cabe no seu planejamento e você tem segurança total. Olhando o custo de não resolver isso agora, costuma sair bem mais em paz. Posso te mostrar a diferença?",
    proximoPasso: "Apresentar opções de prazo e o investimento mensal correspondente.",
  },
  {
    gatilhoNome: "Quero esperar",
    explicacao: "Adiamento por insegurança ou expectativa de condições melhores.",
    pergunta: "Faz sentido. O que precisaria acontecer para você se sentir 100% seguro de seguir?",
    gatilhos: ["Segurança", "Custo de oportunidade", "Confiança"],
    script: "Esperar é válido. Só lembrando que sua margem nova está disponível agora e as condições de hoje são ótimas. Que tal deixarmos aprovado e você decide a liberação quando quiser?",
    proximoPasso: "Deixar a proposta pré-aprovada e combinar data de revisão.",
  },
  {
    gatilhoNome: "Vou falar com meu marido",
    explicacao: "Decisão compartilhada. Sinal de envolvimento, não de recusa.",
    pergunta: "Ótimo, decisão de casa a gente conversa junto mesmo. O que você acha que ele/ela vai querer saber primeiro?",
    gatilhos: ["Decisão familiar", "Antecipar objeção", "Material de apoio"],
    script: "Perfeito! Para facilitar a conversa de vocês, vou te mandar um resumo simples e claro com os números. Posso te ligar amanhã para tirar qualquer dúvida que surgir, pode ser?",
    proximoPasso: "Enviar resumo compartilhável e agendar retorno após a conversa.",
  },
  {
    gatilhoNome: "Vou falar com minha esposa",
    explicacao: "Decisão compartilhada. Sinal de envolvimento, não de recusa.",
    pergunta: "Claro, decisão de casa a gente alinha junto. O que ela costuma valorizar mais: segurança ou economia?",
    gatilhos: ["Decisão familiar", "Antecipar objeção", "Material de apoio"],
    script: "Show! Vou preparar um resumo bem claro para você apresentar. Amanhã te ligo rapidinho para responder o que vocês precisarem e deixar tudo tranquilo.",
    proximoPasso: "Enviar resumo compartilhável e agendar retorno após a conversa.",
  },
  {
    gatilhoNome: "Já tenho empréstimo",
    explicacao: "Oportunidade de portabilidade ou troco. Pode reduzir o investimento mensal e liberar valor.",
    pergunta: "Que bom que você já conhece o produto! Posso fazer uma análise rápida? Muitas vezes consigo melhorar suas condições atuais.",
    gatilhos: ["Portabilidade", "Economia", "Comparação"],
    script: "Ótimo, então fica fácil. Deixa eu analisar suas condições atuais — em vários casos consigo reduzir seu investimento mensal e ainda liberar um valor extra com mais organização. Posso simular para você ver?",
    proximoPasso: "Solicitar dados para simulação de portabilidade/refinanciamento.",
  },
  {
    gatilhoNome: "Não preciso",
    explicacao: "Não enxergou utilidade. Falta conexão com um objetivo concreto.",
    pergunta: "Entendo! Posso te perguntar uma coisa: se surgisse um valor disponível agora, teria algo que você gostaria de realizar ou organizar?",
    gatilhos: ["Descoberta de objetivo", "Reserva de oportunidade", "Sem pressão"],
    script: "Perfeito, é sinal de que está tudo organizado aí. Mesmo assim, deixo registrado que sua margem está disponível. Se um dia quiser realizar um projeto ou ter uma reserva, é só me chamar. Combinado?",
    proximoPasso: "Manter relacionamento e registrar para reabordagem futura.",
  },
  {
    gatilhoNome: "Depois eu vejo",
    explicacao: "Procrastinação. Sem gancho concreto, a conversa esfria.",
    pergunta: "Combinado! Para eu não te perder de vista, qual o melhor dia e horário para a gente retomar?",
    gatilhos: ["Compromisso", "Especificidade", "Continuidade"],
    script: "Tranquilo! Para não te incomodar à toa, já deixo agendado um retorno no dia X às Y. Assim você vê com calma e eu te ajudo no que precisar. Pode ser?",
    proximoPasso: "Agendar follow-up específico e registrar no CRM.",
  },
  {
    gatilhoNome: "Não confio",
    explicacao: "Falta de segurança sobre a empresa/operação. Prioridade é gerar prova e transparência.",
    pergunta: "Você tem toda razão em ter cuidado. Posso te mostrar exatamente como funciona, de forma transparente e oficial?",
    gatilhos: ["Prova social", "Transparência", "Autoridade"],
    script: "Desconfiar é sinal de inteligência, ainda mais hoje. Por isso trabalho com total transparência: tudo é oficial, com desconto em folha e contrato claro. Posso te mostrar nossos atendimentos e cada etapa antes de qualquer decisão.",
    proximoPasso: "Compartilhar provas (avaliações, processo oficial) e seguir no ritmo do cliente.",
  },
];

// ---------------- Missões do dia ----------------
export type Missao = { chave: string; titulo: string; horario: string; alvo: number; xp: number; tipo: AtividadeTipo };
export const MISSOES_PADRAO: Missao[] = [
  { chave: "reativar_10", titulo: "Reativar 10 clientes antigos", horario: "09h", alvo: 10, xp: 100, tipo: "reativacao" },
  { chave: "5_propostas", titulo: "Gerar 5 propostas", horario: "14h", alvo: 5, xp: 120, tipo: "proposta" },
  { chave: "3_retornos", titulo: "Agendar 3 retornos", horario: "16h", alvo: 3, xp: 80, tipo: "followup" },
];

export function nivelPorXp(xp: number): { nivel: number; titulo: string; xpFaltante: number } {
  const base = 300;
  const nivel = Math.floor(xp / base) + 1;
  const titulos = ["Iniciante", "Caçadora", "Estrategista", "Especialista", "Mestre", "Lenda"];
  const titulo = titulos[Math.min(nivel - 1, titulos.length - 1)];
  const xpFaltante = base - (xp % base);
  return { nivel, titulo, xpFaltante };
}

// ---------------- Hunter Score ----------------
export type ScoreDimensoes = {
  energia: number;
  persistencia: number;
  disciplina: number;
  prospeccao: number;
  followup: number;
  organizacao: number;
  comunicacao: number;
  fechamentos: number;
};
export const SCORE_DIM_LABEL: Record<keyof ScoreDimensoes, string> = {
  energia: "Energia",
  persistencia: "Persistência",
  disciplina: "Disciplina",
  prospeccao: "Prospecção",
  followup: "Follow-up",
  organizacao: "Organização",
  comunicacao: "Comunicação",
  fechamentos: "Fechamentos",
};

export function classificacaoScore(score: number): { label: string; tone: string } {
  if (score <= 40) return { label: "Baixo desempenho", tone: "bg-rose-500/15 text-rose-600 dark:text-rose-400 border-rose-500/30" };
  if (score <= 70) return { label: "Em desenvolvimento", tone: "bg-amber-500/15 text-amber-600 dark:text-amber-400 border-amber-500/30" };
  if (score <= 85) return { label: "Alta performance", tone: "bg-sky-500/15 text-sky-600 dark:text-sky-400 border-sky-500/30" };
  return { label: "Elite comercial", tone: "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-500/30" };
}

// ---------------- Treinamento diário ----------------
export type Treinamento = {
  aberturas: string[];
  gatilhos: string[];
  followups: string[];
  fechamentos: string[];
  errosComuns: string[];
  comunicacao40: string[];
};
export const TREINAMENTO: Treinamento = {
  aberturas: [
    "Olá, falo com [nome]? Aqui é a [você], do Grupo Positive. Vi que você tem uma condição especial liberada e quero te mostrar em 2 minutos, pode ser?",
    "Bom dia, [nome]! Tenho uma boa notícia sobre sua margem nova. Você tem 2 minutinhos para eu te explicar?",
    "Oi [nome], tudo bem? Sou a [você], cuido do planejamento financeiro de servidores aqui na região. Fiz uma análise prévia da sua situação e queria te apresentar.",
    "Olá [nome]! Estou ligando para servidores que tiveram aumento e ganharam margem nova. Posso te mostrar como aproveitar com segurança?",
    "Bom dia! Falo com o(a) servidor(a) [nome]? Tenho uma liberação pré-aprovada no seu nome para te apresentar.",
  ],
  gatilhos: [
    "Reciprocidade: entregue valor antes de pedir (uma simulação pronta, uma dica).",
    "Prova social: 'Vários colegas servidores já organizaram suas finanças conosco'.",
    "Autoridade consultiva: fale como especialista que protege o cliente, não como vendedor.",
    "Coerência: faça o cliente concordar com pequenos 'sins' ao longo da conversa.",
    "Segurança: reforce desconto em folha, contrato oficial e transparência.",
  ],
  followups: [
    "Sempre saia da ligação com a PRÓXIMA data marcada — nunca 'depois eu ligo'.",
    "Follow-up por áudio curto e pessoal converte mais que texto frio.",
    "Toque de valor: no retorno, traga uma informação nova (taxa, prazo, condição).",
    "Use a régua 1-3-7: retorne em 1 dia, 3 dias e 7 dias se não houver resposta.",
    "Resgate de silêncio: 'Passando para garantir que sua condição ainda está disponível'.",
  ],
  fechamentos: [
    "Fechamento por escolha: 'Prefere a liberação em 60 ou em 84 vezes?'.",
    "Fechamento por resumo: recapitule os ganhos e pergunte 'fazemos hoje?'.",
    "Fechamento por segurança: 'É 100% oficial e com desconto em folha, posso dar entrada?'.",
    "Fechamento suave: 'Deixo aprovado e você decide a liberação, combinado?'.",
    "Fechamento por urgência ética: 'Sua margem está disponível agora, vamos garantir?'.",
  ],
  errosComuns: [
    "Falar demais e ouvir de menos — quem pergunta conduz a venda.",
    "Usar palavras que assustam (dívida, parcela) em vez de organização e investimento.",
    "Encerrar sem próximo passo agendado.",
    "Pressionar o cliente 40+ — eles valorizam confiança, não pressão.",
    "Não registrar a negociação e perder o follow-up.",
  ],
  comunicacao40: [
    "Fale com calma e clareza — servidores 40+ valorizam tranquilidade.",
    "Use tom respeitoso e próximo, trate pelo nome.",
    "Evite gírias e termos técnicos; explique tudo de forma simples.",
    "Reforce segurança e seriedade da empresa.",
    "Dê tempo para a pessoa pensar e responder, sem atropelar.",
  ],
};

// Treinamento do dia (rotaciona pelo dia do ano).
export function treinamentoDoDia(d = new Date()) {
  const dia = Math.floor((d.getTime() - new Date(d.getFullYear(), 0, 0).getTime()) / 86400000);
  const pick = <T,>(arr: T[]) => arr[dia % arr.length];
  return {
    abertura: pick(TREINAMENTO.aberturas),
    gatilho: pick(TREINAMENTO.gatilhos),
    followup: pick(TREINAMENTO.followups),
    fechamento: pick(TREINAMENTO.fechamentos),
    erro: pick(TREINAMENTO.errosComuns),
    comunicacao: pick(TREINAMENTO.comunicacao40),
  };
}
