// Produção mensal das consultoras — alimenta o ranking e o painel individual.
// Usa o cliente Supabase do browser (RLS aplica): leitura para qualquer usuário
// autenticado; escrita apenas para admins (políticas com has_role).
import { queryOptions } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export type Producao = {
  id: string;
  consultora: string;
  departamento: string | null;
  mes: string; // formato "YYYY-MM"
  valor: number;
  contratos: number;
  created_at: string;
  updated_at: string;
};

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
  const { data, error } = await supabase
    .from("rh_producao")
    .select("mes")
    .order("mes", { ascending: false });
  if (error) throw error;
  const set = new Set<string>((data ?? []).map((r) => r.mes as string));
  const atual = mesAtual();
  set.add(atual);
  return Array.from(set).sort().reverse();
}

/** Produção de um mês específico, ordenada por valor (ranking). */
export async function fetchProducaoMes(mes: string): Promise<Producao[]> {
  const { data, error } = await supabase
    .from("rh_producao")
    .select("*")
    .eq("mes", mes)
    .order("valor", { ascending: false });
  if (error) throw error;
  return (data ?? []) as Producao[];
}

/** Produção de uma consultora específica (todos os meses). */
export async function fetchProducaoConsultora(consultora: string): Promise<Producao[]> {
  const { data, error } = await supabase
    .from("rh_producao")
    .select("*")
    .eq("consultora", consultora)
    .order("mes", { ascending: false });
  if (error) throw error;
  return (data ?? []) as Producao[];
}

/** Insere ou atualiza a produção de uma consultora no mês (admin). */
export async function upsertProducao(input: ProducaoInput, userId?: string): Promise<void> {
  const { error } = await supabase
    .from("rh_producao")
    .upsert(
      {
        consultora: input.consultora,
        departamento: input.departamento ?? null,
        mes: input.mes,
        valor: input.valor,
        contratos: input.contratos,
        created_by: userId ?? null,
      },
      { onConflict: "consultora,mes" },
    );
  if (error) throw error;
}

/** Insere/atualiza vários lançamentos de uma vez (importação de planilha). */
export async function upsertProducaoBatch(
  inputs: ProducaoInput[],
  userId?: string,
): Promise<void> {
  if (!inputs.length) return;
  const { error } = await supabase.from("rh_producao").upsert(
    inputs.map((input) => ({
      consultora: input.consultora,
      departamento: input.departamento ?? null,
      mes: input.mes,
      valor: input.valor,
      contratos: input.contratos,
      created_by: userId ?? null,
    })),
    { onConflict: "consultora,mes" },
  );
  if (error) throw error;
}

export async function deleteProducao(id: string): Promise<void> {
  const { error } = await supabase.from("rh_producao").delete().eq("id", id);
  if (error) throw error;
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
