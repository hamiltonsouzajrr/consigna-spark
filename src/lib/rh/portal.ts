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
