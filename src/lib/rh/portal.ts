// Data layer for the Portal do Colaborador (employee self-service).
// Currently derives KPIs from the mock layer. When Supabase is ready,
// replace the body of `fetchPortalData` with real queries (e.g. via a
// createServerFn that reads from public tables) — the return shape and the
// consuming UI stay identical.

import { queryOptions } from "@tanstack/react-query";
import {
  colaboradores,
  ferias,
  treinamentos,
  documentos,
  type Colaborador,
  type Ferias,
} from "./mock";

export type PortalSolicitacao = {
  id: string;
  tipo: Ferias["tipo"];
  status: Ferias["status"];
  inicio: string;
  fim: string;
  dias: number;
};

export type PortalData = {
  colaborador: Colaborador;
  saldoFerias: number;
  bancoHoras: number;
  salario: number;
  beneficiosAtivos: number;
  proximasFerias: PortalSolicitacao | null;
  treinamentos: { total: number; concluidos: number; progresso: number };
  solicitacoes: PortalSolicitacao[];
  documentos: number;
};

const toSolicitacao = (f: Ferias): PortalSolicitacao => ({
  id: f.id,
  tipo: f.tipo,
  status: f.status,
  inicio: f.inicio,
  fim: f.fim,
  dias: f.dias,
});

// Pure computation from the data layer. Swap for Supabase later.
export function computePortalData(colaboradorId?: string): PortalData {
  const me =
    colaboradores.find((c) => c.id === colaboradorId) ?? colaboradores[0];

  const minhasFerias = ferias.filter((f) => f.colaborador === me.nome);
  const proximasFerias =
    minhasFerias.find((f) => f.status === "Aprovado" && f.tipo === "Férias") ??
    null;

  const meusTreinamentos = treinamentos.filter((t) => t.colaborador === me.nome);
  const concluidos = meusTreinamentos.filter((t) => t.status === "Concluído").length;
  const progresso = meusTreinamentos.length
    ? Math.round((concluidos / meusTreinamentos.length) * 100)
    : 0;

  // Mock derivations — deterministic from the employee record.
  const saldoFerias = 30 - minhasFerias
    .filter((f) => f.tipo === "Férias" && f.status === "Aprovado")
    .reduce((acc, f) => acc + f.dias, 0);
  const bancoHoras = 8;
  const beneficiosAtivos = 3;

  return {
    colaborador: me,
    saldoFerias: Math.max(saldoFerias, 0),
    bancoHoras,
    salario: me.salario,
    beneficiosAtivos,
    proximasFerias: proximasFerias ? toSolicitacao(proximasFerias) : null,
    treinamentos: { total: meusTreinamentos.length, concluidos, progresso },
    solicitacoes: minhasFerias.map(toSolicitacao),
    documentos: documentos.filter((d) => d.colaborador === me.nome).length,
  };
}

// Async fetcher — mirrors a future Supabase/server call signature.
export async function fetchPortalData(colaboradorId?: string): Promise<PortalData> {
  // TODO(supabase): replace with a createServerFn that reads the employee,
  // their vacation requests, trainings and documents scoped to auth.uid().
  return computePortalData(colaboradorId);
}

export const portalQueryOptions = (colaboradorId?: string) =>
  queryOptions({
    queryKey: ["rh", "portal", colaboradorId ?? "me"],
    queryFn: () => fetchPortalData(colaboradorId),
    staleTime: 30_000,
  });

// ---------------------------------------------------------------- KPI details

export type KpiKey = "ferias" | "banco-horas" | "salario" | "beneficios";
export type PeriodKey = "3m" | "6m" | "12m";

export const KPI_KEYS: KpiKey[] = ["ferias", "banco-horas", "salario", "beneficios"];
export const PERIODS: { value: PeriodKey; label: string; months: number }[] = [
  { value: "3m", label: "Últimos 3 meses", months: 3 },
  { value: "6m", label: "Últimos 6 meses", months: 6 },
  { value: "12m", label: "Últimos 12 meses", months: 12 },
];

export type KpiDetail = {
  key: KpiKey;
  title: string;
  description: string;
  unidade: string;
  resumo: { label: string; value: string }[];
  serie: { mes: string; valor: number }[];
  historico: { data: string; descricao: string; valor: string }[];
};

const MESES = [
  "Jan", "Fev", "Mar", "Abr", "Mai", "Jun",
  "Jul", "Ago", "Set", "Out", "Nov", "Dez",
];

// Deterministic pseudo-random so mock series stay stable per render.
const seeded = (seed: number) => {
  let s = seed % 2147483647;
  if (s <= 0) s += 2147483646;
  return () => (s = (s * 16807) % 2147483647) / 2147483647;
};

function buildSerie(months: number, base: number, spread: number, seed: number) {
  const rnd = seeded(seed);
  const now = new Date();
  return Array.from({ length: months }).map((_, i) => {
    const d = new Date(now.getFullYear(), now.getMonth() - (months - 1 - i), 1);
    return {
      mes: `${MESES[d.getMonth()]}/${String(d.getFullYear()).slice(2)}`,
      valor: Math.round((base + (rnd() - 0.5) * spread) * 10) / 10,
    };
  });
}

export function computeKpiDetail(key: KpiKey, period: PeriodKey, colaboradorId?: string): KpiDetail {
  const data = computePortalData(colaboradorId);
  const months = PERIODS.find((p) => p.value === period)?.months ?? 6;

  switch (key) {
    case "ferias": {
      const serie = buildSerie(months, 18, 12, 11);
      return {
        key,
        title: "Saldo de Férias",
        description: "Evolução do saldo e histórico de períodos.",
        unidade: "dias",
        resumo: [
          { label: "Saldo atual", value: `${data.saldoFerias} dias` },
          { label: "Dias usufruídos", value: `${data.solicitacoes.filter((s) => s.tipo === "Férias" && s.status === "Aprovado").reduce((a, s) => a + s.dias, 0)} dias` },
          { label: "Solicitações", value: `${data.solicitacoes.length}` },
        ],
        serie: serie.map((p) => ({ ...p, valor: Math.max(0, Math.round(p.valor)) })),
        historico: data.solicitacoes.map((s) => ({
          data: s.inicio,
          descricao: `${s.tipo} (${s.status})`,
          valor: `${s.dias} dias`,
        })),
      };
    }
    case "banco-horas": {
      const serie = buildSerie(months, 6, 16, 23);
      return {
        key,
        title: "Banco de Horas",
        description: "Saldo mensal de horas extras e compensações.",
        unidade: "h",
        resumo: [
          { label: "Saldo atual", value: `${data.bancoHoras >= 0 ? "+" : ""}${data.bancoHoras}h` },
          { label: "Maior pico", value: `${Math.max(...serie.map((s) => s.valor))}h` },
          { label: "Média mensal", value: `${Math.round(serie.reduce((a, s) => a + s.valor, 0) / serie.length)}h` },
        ],
        serie,
        historico: serie.slice().reverse().map((p) => ({
          data: p.mes,
          descricao: p.valor >= 0 ? "Horas a compensar" : "Horas devidas",
          valor: `${p.valor >= 0 ? "+" : ""}${p.valor}h`,
        })),
      };
    }
    case "salario": {
      const serie = buildSerie(months, data.salario, data.salario * 0.06, 41).map((p) => ({
        ...p,
        valor: Math.round(p.valor),
      }));
      return {
        key,
        title: "Remuneração",
        description: "Histórico de proventos e composição salarial.",
        unidade: "R$",
        resumo: [
          { label: "Salário bruto", value: brl(data.salario) },
          { label: "Estimado líquido", value: brl(Math.round(data.salario * 0.78)) },
          { label: "Média do período", value: brl(Math.round(serie.reduce((a, s) => a + s.valor, 0) / serie.length)) },
        ],
        serie,
        historico: serie.slice().reverse().map((p) => ({
          data: p.mes,
          descricao: "Pagamento processado",
          valor: brl(p.valor),
        })),
      };
    }
    case "beneficios":
    default: {
      const serie = buildSerie(months, data.beneficiosAtivos, 1.5, 67).map((p) => ({
        ...p,
        valor: Math.max(0, Math.round(p.valor)),
      }));
      const lista = ["Vale Refeição", "Plano de Saúde", "Vale Transporte"];
      return {
        key: "beneficios",
        title: "Benefícios",
        description: "Benefícios ativos e adesões ao longo do tempo.",
        unidade: "ativos",
        resumo: [
          { label: "Ativos", value: `${data.beneficiosAtivos}` },
          { label: "Disponíveis", value: "6" },
          { label: "Adesão", value: `${Math.round((data.beneficiosAtivos / 6) * 100)}%` },
        ],
        serie,
        historico: lista.map((b, i) => ({
          data: `2024-0${i + 1}-01`,
          descricao: `${b} ativado`,
          valor: "Ativo",
        })),
      };
    }
  }
}

export async function fetchKpiDetail(key: KpiKey, period: PeriodKey, colaboradorId?: string): Promise<KpiDetail> {
  // TODO(supabase): replace with a createServerFn reading the employee's
  // vacation/timebank/payroll/benefit records scoped to auth.uid().
  return computeKpiDetail(key, period, colaboradorId);
}

export const kpiDetailQueryOptions = (key: KpiKey, period: PeriodKey, colaboradorId?: string) =>
  queryOptions({
    queryKey: ["rh", "portal", "kpi", colaboradorId ?? "me", key, period],
    queryFn: () => fetchKpiDetail(key, period, colaboradorId),
    staleTime: 30_000,
  });

