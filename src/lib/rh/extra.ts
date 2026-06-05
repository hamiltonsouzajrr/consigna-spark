// Extended mock data for advanced RH modules.
// Structured to map cleanly onto future Supabase tables.
import { colaboradores, brl } from "./mock";

const names = colaboradores.map((c) => c.nome);
const nm = (i: number) => names[i % names.length];

// ---------------------------------------------------------------- Organograma
export type OrgNode = {
  id: string;
  nome: string;
  cargo: string;
  departamento: string;
  foto: string;
  filhos?: OrgNode[];
};

export const organograma: OrgNode = {
  id: "ceo",
  nome: "Roberto Positive",
  cargo: "CEO",
  departamento: "Diretoria",
  foto: "https://i.pravatar.cc/150?img=12",
  filhos: [
    {
      id: "dir-com",
      nome: colaboradores[0].nome,
      cargo: "Diretor Comercial",
      departamento: "Comercial",
      foto: colaboradores[0].foto,
      filhos: [
        { id: "v1", nome: colaboradores[6].nome, cargo: "Vendedor", departamento: "Comercial", foto: colaboradores[6].foto },
        { id: "v2", nome: colaboradores[7].nome, cargo: "Vendedor", departamento: "Comercial", foto: colaboradores[7].foto },
        { id: "v3", nome: colaboradores[8].nome, cargo: "Vendedor", departamento: "Comercial", foto: colaboradores[8].foto },
      ],
    },
    {
      id: "dir-rh",
      nome: colaboradores[3].nome,
      cargo: "Diretora de RH",
      departamento: "Recursos Humanos",
      foto: colaboradores[3].foto,
      filhos: [
        { id: "a1", nome: colaboradores[9].nome, cargo: "Analista RH", departamento: "Recursos Humanos", foto: colaboradores[9].foto },
        { id: "a2", nome: colaboradores[10].nome, cargo: "Assistente RH", departamento: "Recursos Humanos", foto: colaboradores[10].foto },
      ],
    },
    {
      id: "dir-tec",
      nome: colaboradores[2].nome,
      cargo: "Diretor de Tecnologia",
      departamento: "Tecnologia",
      foto: colaboradores[2].foto,
      filhos: [
        { id: "d1", nome: colaboradores[11].nome, cargo: "Desenvolvedor", departamento: "Tecnologia", foto: colaboradores[11].foto },
        { id: "d2", nome: colaboradores[12].nome, cargo: "Desenvolvedor", departamento: "Tecnologia", foto: colaboradores[12].foto },
      ],
    },
  ],
};

// ---------------------------------------------------------------- Holerites
export type Holerite = {
  id: string;
  colaborador: string;
  referencia: string;
  salario: number;
  descontos: number;
  liquido: number;
  assinado: boolean;
};

export const holerites: Holerite[] = Array.from({ length: 10 }).map((_, i) => {
  const sal = colaboradores[i].salario;
  const desc = Math.round(sal * 0.22);
  const meses = ["05/2026", "04/2026", "03/2026"];
  return {
    id: `pay-${i + 1}`,
    colaborador: colaboradores[i].nome,
    referencia: meses[i % 3],
    salario: sal,
    descontos: desc,
    liquido: sal - desc,
    assinado: i % 3 !== 0,
  };
});

// ---------------------------------------------------------------- Benefícios
export type Beneficio = { id: string; nome: string; descricao: string; aderentes: number };
export const beneficios: Beneficio[] = [
  { id: "b1", nome: "Vale Transporte", descricao: "Auxílio deslocamento", aderentes: 18 },
  { id: "b2", nome: "Vale Refeição", descricao: "R$ 35/dia", aderentes: 24 },
  { id: "b3", nome: "Plano de Saúde", descricao: "Unimed Nacional", aderentes: 22 },
  { id: "b4", nome: "Plano Odontológico", descricao: "OdontoPrev", aderentes: 16 },
  { id: "b5", nome: "Gympass", descricao: "Academias e bem-estar", aderentes: 9 },
  { id: "b6", nome: "Auxílio Home Office", descricao: "R$ 150/mês", aderentes: 12 },
];

export const beneficiosPorColaborador = colaboradores.slice(0, 8).map((c, i) => ({
  colaborador: c.nome,
  ativos: beneficios.filter((_, b) => (i + b) % 2 === 0).map((b) => b.nome),
}));

// ---------------------------------------------------------------- PDI
export type PDI = {
  id: string;
  colaborador: string;
  competencia: string;
  meta: string;
  prazo: string;
  progresso: number;
  status: "Pendente" | "Em andamento" | "Concluído";
};
export const pdis: PDI[] = [
  { id: "pdi1", colaborador: nm(0), competencia: "Negociação", meta: "Concluir curso avançado de vendas", prazo: "2026-09-30", progresso: 75, status: "Em andamento" },
  { id: "pdi2", colaborador: nm(2), competencia: "Arquitetura de Software", meta: "Certificação Cloud", prazo: "2026-12-15", progresso: 50, status: "Em andamento" },
  { id: "pdi3", colaborador: nm(9), competencia: "Recrutamento", meta: "Formação em People Analytics", prazo: "2026-08-01", progresso: 100, status: "Concluído" },
  { id: "pdi4", colaborador: nm(11), competencia: "Liderança Técnica", meta: "Mentoria de juniores", prazo: "2026-10-10", progresso: 25, status: "Em andamento" },
  { id: "pdi5", colaborador: nm(6), competencia: "Comunicação", meta: "Workshop de oratória", prazo: "2026-07-20", progresso: 0, status: "Pendente" },
];

// ---------------------------------------------------------------- Clima
export const climaRadar = [
  { dim: "Satisfação", valor: 78 },
  { dim: "Liderança", valor: 72 },
  { dim: "Ambiente", valor: 85 },
  { dim: "Cultura", valor: 80 },
  { dim: "Reconhecimento", valor: 64 },
  { dim: "Comunicação", valor: 70 },
];
export const enpsHistorico = [
  { mes: "Jan", enps: 32 },
  { mes: "Fev", enps: 38 },
  { mes: "Mar", enps: 41 },
  { mes: "Abr", enps: 36 },
  { mes: "Mai", enps: 45 },
  { mes: "Jun", enps: 52 },
];
export const climaPorDepartamento = [
  { departamento: "Comercial", satisfacao: 72, lideranca: 68, ambiente: 80 },
  { departamento: "Tecnologia", satisfacao: 84, lideranca: 79, ambiente: 88 },
  { departamento: "Financeiro", satisfacao: 70, lideranca: 74, ambiente: 76 },
  { departamento: "RH", satisfacao: 88, lideranca: 82, ambiente: 90 },
  { departamento: "Operações", satisfacao: 66, lideranca: 60, ambiente: 72 },
];

// ---------------------------------------------------------------- People Analytics
export const analyticsKpis = [
  { label: "Absenteísmo", value: "3,2%", trend: "+0,4pp", up: true },
  { label: "Turnover", value: "8,1%", trend: "-1,2pp", up: false },
  { label: "Tempo médio na empresa", value: "3,4 anos", trend: "+0,2", up: false },
  { label: "Produtividade", value: "92%", trend: "+3pp", up: false },
  { label: "Horas extras", value: "115h", trend: "+12h", up: true },
  { label: "Treinamentos", value: "87%", trend: "+5pp", up: false },
];

export const aiInsights = {
  resumo:
    "O quadro geral de pessoas está estável, com turnover em queda (8,1%) e produtividade em alta (92%). O setor Comercial apresenta risco elevado devido ao aumento do absenteísmo e queda nas avaliações nos últimos 60 dias.",
  insights: [
    "Tecnologia tem o melhor clima organizacional (88%) e menor turnover.",
    "Horas extras cresceram 12h no Comercial, indicando possível sobrecarga.",
    "87% dos treinamentos obrigatórios foram concluídos no período.",
  ],
  alertas: [
    "Comercial: aumento de 0,4pp no absenteísmo e queda nas avaliações.",
    "5 documentos obrigatórios próximos do vencimento.",
    "3 colaboradores em alto risco de turnover.",
  ],
  recomendacoes: [
    "Realizar conversas de carreira no time Comercial.",
    "Revisar distribuição de demandas para reduzir horas extras.",
    "Programar feedbacks estruturados para o 2º semestre.",
  ],
};

// ---------------------------------------------------------------- Turnover
export type TurnoverPred = {
  colaborador: string;
  departamento: string;
  score: number;
  probabilidade: number;
};
export const turnoverPred: TurnoverPred[] = colaboradores.slice(0, 12).map((c, i) => {
  const score = [12, 22, 45, 58, 33, 81, 76, 19, 64, 28, 88, 41][i];
  return { colaborador: c.nome, departamento: c.departamento, score, probabilidade: Math.min(99, score + (i % 5)) };
});
export const turnoverNivel = (s: number) => (s <= 30 ? "Baixo" : s <= 70 ? "Médio" : "Alto");

// ---------------------------------------------------------------- Ranking
export type RankItem = {
  colaborador: string;
  departamento: string;
  foto: string;
  pontos: number;
  badges: string[];
};
export const ranking: RankItem[] = colaboradores
  .slice(0, 10)
  .map((c, i) => ({
    colaborador: c.nome,
    departamento: c.departamento,
    foto: c.foto,
    pontos: 980 - i * 47 + (i % 3) * 11,
    badges: [["Top Vendas", "Pontualidade"], ["Inovação"], ["Trabalho em equipe", "Liderança"]][i % 3],
  }))
  .sort((a, b) => b.pontos - a.pontos);

export const rankingDepartamentos = [
  { departamento: "Tecnologia", pontos: 8420 },
  { departamento: "Comercial", pontos: 7980 },
  { departamento: "RH", pontos: 6650 },
  { departamento: "Financeiro", pontos: 5210 },
  { departamento: "Operações", pontos: 4890 },
];
export const rankingEvolucao = [
  { mes: "Jan", pontos: 720 }, { mes: "Fev", pontos: 760 }, { mes: "Mar", pontos: 810 },
  { mes: "Abr", pontos: 790 }, { mes: "Mai", pontos: 880 }, { mes: "Jun", pontos: 940 },
];

// ---------------------------------------------------------------- Reconhecimentos
export type Reconhecimento = {
  id: string;
  de: string;
  para: string;
  tipo: "Trabalho em equipe" | "Liderança" | "Inovação" | "Destaque do mês";
  mensagem: string;
  data: string;
};
export const reconhecimentos: Reconhecimento[] = [
  { id: "r1", de: nm(0), para: nm(6), tipo: "Trabalho em equipe", mensagem: "Ajudou toda a equipe a bater a meta do mês!", data: "2026-06-02" },
  { id: "r2", de: nm(3), para: nm(2), tipo: "Inovação", mensagem: "Automatizou um processo que economiza horas semanais.", data: "2026-05-28" },
  { id: "r3", de: nm(9), para: nm(11), tipo: "Liderança", mensagem: "Excelente mentoria com os novos desenvolvedores.", data: "2026-05-20" },
  { id: "r4", de: nm(2), para: nm(0), tipo: "Destaque do mês", mensagem: "Resultados comerciais excepcionais.", data: "2026-05-15" },
];

// ---------------------------------------------------------------- OKRs
export type OKR = {
  id: string;
  nivel: "Empresa" | "Departamento" | "Colaborador";
  objetivo: string;
  dono: string;
  progresso: number;
  krs: { titulo: string; progresso: number }[];
};
export const okrs: OKR[] = [
  {
    id: "ok1", nivel: "Empresa", objetivo: "Crescer 30% em receita em 2026", dono: "Diretoria", progresso: 62,
    krs: [{ titulo: "Aumentar base de clientes em 25%", progresso: 70 }, { titulo: "Reduzir churn para 4%", progresso: 54 }],
  },
  {
    id: "ok2", nivel: "Departamento", objetivo: "Elevar conversão comercial", dono: "Comercial", progresso: 48,
    krs: [{ titulo: "Conversão de leads para 18%", progresso: 45 }, { titulo: "Ticket médio +12%", progresso: 51 }],
  },
  {
    id: "ok3", nivel: "Colaborador", objetivo: "Tornar-se referência técnica", dono: nm(2), progresso: 55,
    krs: [{ titulo: "Concluir certificação Cloud", progresso: 50 }, { titulo: "Mentorar 2 juniores", progresso: 60 }],
  },
];

// ---------------------------------------------------------------- Auditoria
export type AuditLog = {
  id: string;
  usuario: string;
  acao: string;
  tabela: string;
  registro: string;
  data: string;
};
export const auditLogs: AuditLog[] = [
  { id: "au1", usuario: nm(3), acao: "Alterou salário", tabela: "employees", registro: nm(0), data: "2026-06-04 14:22" },
  { id: "au2", usuario: nm(9), acao: "Aprovou férias", tabela: "ferias", registro: nm(6), data: "2026-06-04 11:08" },
  { id: "au3", usuario: nm(10), acao: "Excluiu documento", tabela: "documentos", registro: nm(2), data: "2026-06-03 17:45" },
  { id: "au4", usuario: nm(3), acao: "Criou colaborador", tabela: "employees", registro: nm(13), data: "2026-06-03 09:30" },
  { id: "au5", usuario: nm(0), acao: "Enviou holerite", tabela: "payrolls", registro: nm(7), data: "2026-06-02 16:12" },
];

// ---------------------------------------------------------------- Chat interno
export type ChatRoom = { id: string; nome: string; tipo: "canal" | "privado"; ultima: string };
export type ChatMsg = { id: string; room: string; autor: string; texto: string; hora: string; me?: boolean };
export const chatRooms: ChatRoom[] = [
  { id: "geral", nome: "geral", tipo: "canal", ultima: "Bom dia, time!" },
  { id: "comercial", nome: "comercial", tipo: "canal", ultima: "Fechamos mais um contrato 🎉" },
  { id: "tecnologia", nome: "tecnologia", tipo: "canal", ultima: "Deploy concluído" },
  { id: "rh", nome: "rh", tipo: "canal", ultima: "Lembrete: pesquisa de clima" },
  { id: "p-ana", nome: colaboradores[0].nome, tipo: "privado", ultima: "Pode falar agora?" },
];
export const chatMessages: Record<string, ChatMsg[]> = {
  geral: [
    { id: "m1", room: "geral", autor: colaboradores[3].nome, texto: "Bom dia, time! 👋", hora: "08:30" },
    { id: "m2", room: "geral", autor: colaboradores[2].nome, texto: "Bom dia! Reunião às 10h, certo?", hora: "08:32" },
    { id: "m3", room: "geral", autor: "Você", texto: "Isso! Já enviei o link 📎", hora: "08:33", me: true },
  ],
  comercial: [
    { id: "m4", room: "comercial", autor: colaboradores[0].nome, texto: "Fechamos mais um contrato 🎉", hora: "09:10" },
    { id: "m5", room: "comercial", autor: colaboradores[6].nome, texto: "Show! 🚀", hora: "09:11" },
  ],
  tecnologia: [
    { id: "m6", room: "tecnologia", autor: colaboradores[11].nome, texto: "Deploy concluído ✅", hora: "10:02" },
  ],
  rh: [
    { id: "m7", room: "rh", autor: colaboradores[9].nome, texto: "Lembrete: pesquisa de clima fecha sexta.", hora: "11:00" },
  ],
  "p-ana": [
    { id: "m8", room: "p-ana", autor: colaboradores[0].nome, texto: "Pode falar agora?", hora: "13:20" },
  ],
};

export const fmtBRL = brl;
