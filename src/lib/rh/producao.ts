// Produção mensal das consultoras — alimenta o ranking e o painel individual.
// Leitura disponível a qualquer usuário autenticado (recurso interno da
// empresa) e escrita apenas para admins. Todo o acesso ao banco passa por
// server functions (`producao.functions.ts`) que usam o cliente de serviço
// dentro de handlers autenticados, mantendo o acesso direto à tabela restrito.
import { queryOptions } from "@tanstack/react-query";
import {
  fetchMesesFn,
  fetchProducaoMesFn,
  fetchProducaoConsultoraFn,
  upsertProducaoFn,
  upsertProducaoBatchFn,
  deleteProducaoFn,
  type ProducaoRow,
} from "./producao.functions";

export type Producao = ProducaoRow;

export type ProducaoInput = {
  consultora: string;
  departamento?: string | null;
  mes: string;
  valor: number;
  contratos: number;
};

/** Mês corrente no formato "YYYY-MM". */
export function mesAtual(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

/** Rótulo amigável "Jun/25" a partir de "YYYY-MM". */
export function formatMes(mes: string): string {
  const [y, m] = mes.split("-").map(Number);
  const MES = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];
  if (!y || !m) return mes;
  return `${MES[m - 1]}/${String(y).slice(2)}`;
}

/** Lista os meses disponíveis (distintos) com produção registrada. */
export async function fetchMeses(): Promise<string[]> {
  return fetchMesesFn();
}

/** Produção de um mês específico, ordenada por valor (ranking). */
export async function fetchProducaoMes(mes: string): Promise<Producao[]> {
  return fetchProducaoMesFn({ data: { mes } });
}

/** Produção de uma consultora específica (todos os meses). */
export async function fetchProducaoConsultora(consultora: string): Promise<Producao[]> {
  return fetchProducaoConsultoraFn({ data: { consultora } });
}

/** Insere ou atualiza a produção de uma consultora no mês (admin). */
export async function upsertProducao(input: ProducaoInput, _userId?: string): Promise<void> {
  await upsertProducaoFn({
    data: {
      consultora: input.consultora,
      departamento: input.departamento ?? null,
      mes: input.mes,
      valor: input.valor,
      contratos: input.contratos,
    },
  });
}

/** Insere/atualiza vários lançamentos de uma vez (importação de planilha). */
export async function upsertProducaoBatch(inputs: ProducaoInput[], _userId?: string): Promise<void> {
  if (!inputs.length) return;
  await upsertProducaoBatchFn({
    data: {
      items: inputs.map((input) => ({
        consultora: input.consultora,
        departamento: input.departamento ?? null,
        mes: input.mes,
        valor: input.valor,
        contratos: input.contratos,
      })),
    },
  });
}

export async function deleteProducao(id: string): Promise<void> {
  await deleteProducaoFn({ data: { id } });
}

export const producaoMesQueryOptions = (mes: string) =>
  queryOptions({
    queryKey: ["rh", "producao", "mes", mes],
    queryFn: () => fetchProducaoMes(mes),
    staleTime: 30_000,
  });

export const producaoConsultoraQueryOptions = (consultora: string) =>
  queryOptions({
    queryKey: ["rh", "producao", "consultora", consultora],
    queryFn: () => fetchProducaoConsultora(consultora),
    staleTime: 30_000,
    enabled: !!consultora,
  });

export const mesesQueryOptions = () =>
  queryOptions({
    queryKey: ["rh", "producao", "meses"],
    queryFn: fetchMeses,
    staleTime: 30_000,
  });
