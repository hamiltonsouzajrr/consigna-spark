// Distribuição automática dos leads do Radar Diário Oficial.
// A regra de rodízio vive no banco (distribuir_do_registros_pendentes), que
// também sincroniza o cadastro de consultoras a partir das contas do sistema
// e notifica cada consultora sobre os leads novos que caíram na carteira dela.

export type ResultadoDistribuicao = { atribuidos: number; consultoras: number };

export async function distribuirPendentes(limite = 2000): Promise<ResultadoDistribuicao> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data, error } = await supabaseAdmin.rpc("distribuir_do_registros_pendentes" as any, {
    _limit: limite,
  } as any);
  if (error) throw new Error(error.message);
  const row = (Array.isArray(data) ? data[0] : data) as any;
  return {
    atribuidos: Number(row?.atribuidos ?? 0),
    consultoras: Number(row?.consultoras ?? 0),
  };
}

export async function sincronizarConsultoras(): Promise<number> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data, error } = await supabaseAdmin.rpc("sync_radar_consultoras" as any);
  if (error) throw new Error(error.message);
  return Number(data ?? 0);
}
