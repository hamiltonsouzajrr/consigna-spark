// Mock data layer for the RH (HR) module.
// Structured to be easily replaced by Supabase queries in the future.

export type ColaboradorStatus = "Ativo" | "Afastado" | "Férias" | "Desligado";

export type Colaborador = {
  id: string;
  foto: string;
  nome: string;
  cpf: string;
  rg: string;
  email: string;
  telefone: string;
  nascimento: string;
  sexo: "Masculino" | "Feminino" | "Outro";
  estadoCivil: string;
  endereco: string;
  contatoEmergencia: string;
  matricula: string;
  cargo: string;
  departamento: string;
  gestor: string;
  tipoContrato: string;
  salario: number;
  admissao: string;
  status: ColaboradorStatus;
};

export type Departamento = {
  id: string;
  nome: string;
  responsavel: string;
  colaboradores: number;
};

export type Cargo = {
  id: string;
  nome: string;
  nivel: string;
  salarioBase: number;
  colaboradores: number;
};

export type Ferias = {
  id: string;
  colaborador: string;
  tipo: "Férias" | "Licença Maternidade" | "Licença Paternidade" | "Afastamento" | "Atestado";
  inicio: string;
  fim: string;
  dias: number;
  status: "Pendente" | "Aprovado" | "Recusado";
};

export type RegistroPonto = {
  id: string;
  colaborador: string;
  data: string;
  entrada: string;
  saida: string;
  extras: number;
  atraso: number;
  falta: boolean;
  saldo: number;
};

export type Documento = {
  id: string;
  colaborador: string;
  tipo: string;
  arquivo: string;
  emissao: string;
  vencimento: string | null;
};

export type Treinamento = {
  id: string;
  colaborador: string;
  curso: string;
  validade: string | null;
  status: "Concluído" | "Pendente" | "Vencido";
};

export type Equipamento = {
  id: string;
  tipo: string;
  colaborador: string;
  patrimonio: string;
  serie: string;
  entrega: string;
  devolucao: string | null;
  status: "Em uso" | "Devolvido" | "Manutenção";
};

export type Avaliacao = {
  id: string;
  colaborador: string;
  periodo: string;
  meta: number;
  resultado: number;
  notaFinal: number;
  feedback: string;
};

export type Ocorrencia = {
  id: string;
  colaborador: string;
  tipo: "Advertência" | "Elogio" | "Suspensão" | "Observação";
  data: string;
  descricao: string;
};

export type Vaga = {
  id: string;
  titulo: string;
  departamento: string;
  etapa: "Triagem" | "Entrevista" | "Teste" | "Proposta" | "Contratado";
  candidatos: number;
};

export type Candidato = {
  id: string;
  nome: string;
  vaga: string;
  etapa: Vaga["etapa"];
};

export type OnboardingItem = {
  id: string;
  colaborador: string;
  tarefas: { label: string; done: boolean }[];
};

export type Desligamento = {
  id: string;
  colaborador: string;
  motivo: string;
  data: string;
  entrevistaSaida: boolean;
  equipamentosDevolvidos: boolean;
  acessosEncerrados: boolean;
};

const fotos = (i: number) => `https://i.pravatar.cc/150?img=${(i % 70) + 1}`;

export const departamentos: Departamento[] = [
  { id: "d1", nome: "Comercial", responsavel: "Ana Lima", colaboradores: 12 },
  { id: "d2", nome: "Financeiro", responsavel: "Carlos Souza", colaboradores: 6 },
  { id: "d3", nome: "Tecnologia", responsavel: "Marcos Dias", colaboradores: 8 },
  { id: "d4", nome: "Recursos Humanos", responsavel: "Paula Reis", colaboradores: 4 },
  { id: "d5", nome: "Operações", responsavel: "João Pedro", colaboradores: 10 },
  { id: "d6", nome: "Marketing", responsavel: "Beatriz Nunes", colaboradores: 5 },
];

export const cargos: Cargo[] = [
  { id: "c1", nome: "Consultor Comercial", nivel: "Pleno", salarioBase: 3200, colaboradores: 9 },
  { id: "c2", nome: "Analista Financeiro", nivel: "Sênior", salarioBase: 5200, colaboradores: 4 },
  { id: "c3", nome: "Desenvolvedor", nivel: "Pleno", salarioBase: 7800, colaboradores: 6 },
  { id: "c4", nome: "Analista de RH", nivel: "Júnior", salarioBase: 2800, colaboradores: 3 },
  { id: "c5", nome: "Gerente", nivel: "Gestão", salarioBase: 11000, colaboradores: 5 },
  { id: "c6", nome: "Assistente Administrativo", nivel: "Júnior", salarioBase: 2200, colaboradores: 8 },
];

const nomes = [
  "Ana Lima", "Carlos Souza", "Marcos Dias", "Paula Reis", "João Pedro", "Beatriz Nunes",
  "Fernanda Alves", "Rafael Costa", "Juliana Melo", "Pedro Henrique", "Camila Rocha", "Lucas Martins",
  "Mariana Pinto", "Gustavo Ramos", "Larissa Cardoso", "Bruno Teixeira", "Patrícia Gomes", "Diego Fernandes",
  "Sofia Barbosa", "Thiago Moreira", "Aline Castro", "Vinícius Lopes", "Renata Cunha", "Eduardo Freitas",
];

const statusList: ColaboradorStatus[] = ["Ativo", "Ativo", "Ativo", "Ativo", "Férias", "Afastado", "Desligado"];

export const colaboradores: Colaborador[] = nomes.map((nome, i) => {
  const dep = departamentos[i % departamentos.length];
  const cargo = cargos[i % cargos.length];
  const mes = (i % 12) + 1;
  return {
    id: `col-${i + 1}`,
    foto: fotos(i),
    nome,
    cpf: `${100 + i}.${200 + i}.${300 + i}-0${i % 10}`,
    rg: `${10 + i}.${200 + i}.${300 + i}-${i % 10}`,
    email: `${nome.toLowerCase().replace(/ /g, ".")}@grupopositive.com.br`,
    telefone: `(82) 9${8000 + i}-${1000 + i}`,
    nascimento: `19${85 + (i % 12)}-0${(i % 9) + 1}-1${i % 9}`,
    sexo: i % 2 === 0 ? "Feminino" : "Masculino",
    estadoCivil: ["Solteiro(a)", "Casado(a)", "Divorciado(a)"][i % 3],
    endereco: `Rua das Flores, ${100 + i} - Maceió/AL`,
    contatoEmergencia: `(82) 9${7000 + i}-${2000 + i}`,
    matricula: `MAT${1000 + i}`,
    cargo: cargo.nome,
    departamento: dep.nome,
    gestor: nomes[i % 6],
    tipoContrato: ["CLT", "PJ", "Estágio", "Temporário"][i % 4],
    salario: cargo.salarioBase + (i % 5) * 250,
    admissao: `202${2 + (i % 3)}-${String(mes).padStart(2, "0")}-1${i % 9}`,
    status: statusList[i % statusList.length],
  };
});

export const ferias: Ferias[] = [
  { id: "f1", colaborador: "Ana Lima", tipo: "Férias", inicio: "2026-06-10", fim: "2026-06-30", dias: 20, status: "Aprovado" },
  { id: "f2", colaborador: "Carlos Souza", tipo: "Férias", inicio: "2026-07-01", fim: "2026-07-15", dias: 15, status: "Pendente" },
  { id: "f3", colaborador: "Juliana Melo", tipo: "Licença Maternidade", inicio: "2026-05-01", fim: "2026-09-01", dias: 120, status: "Aprovado" },
  { id: "f4", colaborador: "Rafael Costa", tipo: "Atestado", inicio: "2026-06-03", fim: "2026-06-05", dias: 2, status: "Aprovado" },
  { id: "f5", colaborador: "Lucas Martins", tipo: "Férias", inicio: "2026-08-12", fim: "2026-08-31", dias: 19, status: "Pendente" },
  { id: "f6", colaborador: "Pedro Henrique", tipo: "Licença Paternidade", inicio: "2026-06-15", fim: "2026-06-20", dias: 5, status: "Recusado" },
  { id: "f7", colaborador: "Camila Rocha", tipo: "Afastamento", inicio: "2026-04-10", fim: "2026-07-10", dias: 90, status: "Aprovado" },
];

export const pontos: RegistroPonto[] = Array.from({ length: 14 }).map((_, i) => ({
  id: `p${i + 1}`,
  colaborador: nomes[i % nomes.length],
  data: `2026-06-0${(i % 9) + 1}`,
  entrada: "08:0" + (i % 9),
  saida: "18:0" + (i % 6),
  extras: (i % 3) * 0.5,
  atraso: i % 4 === 0 ? 0.25 : 0,
  falta: i % 9 === 0,
  saldo: ((i % 5) - 2) * 1.5,
}));

export const documentos: Documento[] = [
  { id: "doc1", colaborador: "Ana Lima", tipo: "ASO", arquivo: "aso_ana.pdf", emissao: "2025-06-01", vencimento: "2026-06-20" },
  { id: "doc2", colaborador: "Carlos Souza", tipo: "Contrato", arquivo: "contrato_carlos.pdf", emissao: "2023-02-15", vencimento: null },
  { id: "doc3", colaborador: "Marcos Dias", tipo: "CNH", arquivo: "cnh_marcos.jpg", emissao: "2021-09-10", vencimento: "2026-06-12" },
  { id: "doc4", colaborador: "Paula Reis", tipo: "Certificado NR-35", arquivo: "nr35_paula.pdf", emissao: "2024-03-01", vencimento: "2026-07-05" },
  { id: "doc5", colaborador: "João Pedro", tipo: "RG", arquivo: "rg_joao.png", emissao: "2010-01-01", vencimento: null },
  { id: "doc6", colaborador: "Beatriz Nunes", tipo: "ASO", arquivo: "aso_beatriz.pdf", emissao: "2025-01-10", vencimento: "2026-09-30" },
];

export const treinamentos: Treinamento[] = [
  { id: "t1", colaborador: "Ana Lima", curso: "Vendas Consultivas", validade: "2027-01-01", status: "Concluído" },
  { id: "t2", colaborador: "Carlos Souza", curso: "Compliance Financeiro", validade: "2026-12-01", status: "Pendente" },
  { id: "t3", colaborador: "Marcos Dias", curso: "Segurança da Informação", validade: "2025-12-01", status: "Vencido" },
  { id: "t4", colaborador: "Paula Reis", curso: "Liderança", validade: null, status: "Concluído" },
  { id: "t5", colaborador: "Lucas Martins", curso: "NR-35 Trabalho em Altura", validade: "2026-08-01", status: "Pendente" },
];

export const equipamentos: Equipamento[] = [
  { id: "e1", tipo: "Notebook", colaborador: "Ana Lima", patrimonio: "PAT-001", serie: "SN-AX221", entrega: "2024-01-10", devolucao: null, status: "Em uso" },
  { id: "e2", tipo: "Celular", colaborador: "Carlos Souza", patrimonio: "PAT-002", serie: "SN-BG443", entrega: "2024-03-01", devolucao: null, status: "Em uso" },
  { id: "e3", tipo: "Chip", colaborador: "Marcos Dias", patrimonio: "PAT-003", serie: "ICCID-9921", entrega: "2024-03-01", devolucao: null, status: "Em uso" },
  { id: "e4", tipo: "Notebook", colaborador: "Pedro Henrique", patrimonio: "PAT-004", serie: "SN-CC882", entrega: "2023-06-15", devolucao: "2026-05-20", status: "Devolvido" },
  { id: "e5", tipo: "Uniforme", colaborador: "Camila Rocha", patrimonio: "PAT-005", serie: "-", entrega: "2025-02-01", devolucao: null, status: "Em uso" },
];

export const avaliacoes: Avaliacao[] = [
  { id: "a1", colaborador: "Ana Lima", periodo: "1º Sem 2026", meta: 100, resultado: 118, notaFinal: 9.2, feedback: "Superou metas de vendas." },
  { id: "a2", colaborador: "Carlos Souza", periodo: "1º Sem 2026", meta: 100, resultado: 92, notaFinal: 7.8, feedback: "Boa entrega, atenção a prazos." },
  { id: "a3", colaborador: "Marcos Dias", periodo: "1º Sem 2026", meta: 100, resultado: 105, notaFinal: 8.6, feedback: "Excelente trabalho técnico." },
  { id: "a4", colaborador: "Paula Reis", periodo: "1º Sem 2026", meta: 100, resultado: 110, notaFinal: 9.0, feedback: "Liderança consistente." },
];

export const ocorrencias: Ocorrencia[] = [
  { id: "o1", colaborador: "Lucas Martins", tipo: "Advertência", data: "2026-05-12", descricao: "Atrasos recorrentes." },
  { id: "o2", colaborador: "Ana Lima", tipo: "Elogio", data: "2026-04-20", descricao: "Cliente elogiou atendimento." },
  { id: "o3", colaborador: "Pedro Henrique", tipo: "Observação", data: "2026-06-01", descricao: "Solicitou mudança de turno." },
  { id: "o4", colaborador: "Marcos Dias", tipo: "Elogio", data: "2026-03-15", descricao: "Resolveu incidente crítico." },
];

export const vagas: Vaga[] = [
  { id: "v1", titulo: "Consultor Comercial", departamento: "Comercial", etapa: "Triagem", candidatos: 14 },
  { id: "v2", titulo: "Desenvolvedor Pleno", departamento: "Tecnologia", etapa: "Entrevista", candidatos: 8 },
  { id: "v3", titulo: "Analista de RH", departamento: "Recursos Humanos", etapa: "Teste", candidatos: 5 },
];

export const candidatos: Candidato[] = [
  { id: "ca1", nome: "Marcela Vieira", vaga: "Consultor Comercial", etapa: "Triagem" },
  { id: "ca2", nome: "Roberto Anjos", vaga: "Consultor Comercial", etapa: "Triagem" },
  { id: "ca3", nome: "Tatiane Lopes", vaga: "Desenvolvedor Pleno", etapa: "Entrevista" },
  { id: "ca4", nome: "Felipe Aragão", vaga: "Desenvolvedor Pleno", etapa: "Teste" },
  { id: "ca5", nome: "Sandra Melo", vaga: "Analista de RH", etapa: "Proposta" },
  { id: "ca6", nome: "Igor Santana", vaga: "Consultor Comercial", etapa: "Contratado" },
];

export const onboarding: OnboardingItem[] = [
  {
    id: "on1",
    colaborador: "Igor Santana",
    tarefas: [
      { label: "Contrato assinado", done: true },
      { label: "Documentação enviada", done: true },
      { label: "Equipamentos entregues", done: false },
      { label: "E-mail corporativo criado", done: true },
      { label: "Treinamentos iniciais concluídos", done: false },
    ],
  },
  {
    id: "on2",
    colaborador: "Sandra Melo",
    tarefas: [
      { label: "Contrato assinado", done: true },
      { label: "Documentação enviada", done: false },
      { label: "Equipamentos entregues", done: false },
      { label: "E-mail corporativo criado", done: false },
      { label: "Treinamentos iniciais concluídos", done: false },
    ],
  },
];

export const desligamentos: Desligamento[] = [
  { id: "des1", colaborador: "Eduardo Freitas", motivo: "Pedido de demissão", data: "2026-05-10", entrevistaSaida: true, equipamentosDevolvidos: true, acessosEncerrados: true },
  { id: "des2", colaborador: "Renata Cunha", motivo: "Fim de contrato", data: "2026-06-01", entrevistaSaida: true, equipamentosDevolvidos: false, acessosEncerrados: false },
];

export const tiposContrato = ["CLT", "PJ", "Estágio", "Temporário", "Aprendiz"];
export const perfisAcesso = ["Administrador", "RH", "Gestor", "Colaborador"];

// Dashboard aggregates -------------------------------------------------------

export function dashboardStats() {
  const total = colaboradores.length;
  const ativos = colaboradores.filter((c) => c.status === "Ativo").length;
  const feriasPendentes = ferias.filter((f) => f.tipo === "Férias" && f.status === "Pendente").length;
  const docsVencendo = documentos.filter((d) => d.vencimento && new Date(d.vencimento) <= new Date("2026-07-01")).length;
  const mesAtual = 6;
  const aniversariantes = colaboradores.filter((c) => Number(c.nascimento.split("-")[1]) === mesAtual).length;
  const treinamentosPendentes = treinamentos.filter((t) => t.status !== "Concluído").length;
  const admissoesMes = colaboradores.filter((c) => c.admissao.startsWith("2026-06")).length || 2;
  const desligamentosMes = desligamentos.filter((d) => d.data.startsWith("2026-06")).length;
  return { total, ativos, feriasPendentes, docsVencendo, aniversariantes, treinamentosPendentes, admissoesMes, desligamentosMes };
}

export const colaboradoresPorDepartamento = departamentos.map((d) => ({
  nome: d.nome,
  total: colaboradores.filter((c) => c.departamento === d.nome).length || d.colaboradores,
}));

export const colaboradoresPorCargo = cargos.map((c) => ({
  nome: c.nome,
  total: colaboradores.filter((x) => x.cargo === c.nome).length || c.colaboradores,
}));

export const turnoverMensal = [
  { mes: "Jan", admissoes: 4, desligamentos: 2 },
  { mes: "Fev", admissoes: 3, desligamentos: 3 },
  { mes: "Mar", admissoes: 5, desligamentos: 1 },
  { mes: "Abr", admissoes: 2, desligamentos: 4 },
  { mes: "Mai", admissoes: 6, desligamentos: 2 },
  { mes: "Jun", admissoes: 2, desligamentos: 1 },
];

export const headcountEvolucao = [
  { mes: "Jan", total: 38 },
  { mes: "Fev", total: 38 },
  { mes: "Mar", total: 42 },
  { mes: "Abr", total: 40 },
  { mes: "Mai", total: 44 },
  { mes: "Jun", total: 45 },
];

export function getColaborador(id: string) {
  return colaboradores.find((c) => c.id === id);
}

export const brl = (v: number) =>
  v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

export const formatDate = (d: string | null) =>
  d ? new Date(d + (d.length === 10 ? "T00:00:00" : "")).toLocaleDateString("pt-BR") : "—";
