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

// Redistribui igualmente os leads do Diário Oficial entre todas as consultoras
// ativas com conta no sistema (round-robin determinístico, mais recentes primeiro).
export async function redistribuirIgualmente(
  janelaDias: number | null = null,
  incluirAbordados = false,
): Promise<ResultadoDistribuicao> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data, error } = await supabaseAdmin.rpc("redistribuir_do_registros_igualmente" as any, {
    _janela_dias: janelaDias,
    _incluir_abordados: incluirAbordados,
  } as any);
  if (error) throw new Error(error.message);
  const row = (Array.isArray(data) ? data[0] : data) as any;
  return {
    atribuidos: Number(row?.atribuidos ?? 0),
    consultoras: Number(row?.consultoras ?? 0),
  };
}

export type CarteiraResumo = {
  nome: string;
  email: string | null;
  ativo: boolean;
  total: number;
  janela: number;
  ultimaEntrega: string | null;
};

export async function resumoCarteiras(janelaDias = 15): Promise<CarteiraResumo[]> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const desde = new Date(Date.now() - janelaDias * 86_400_000).toISOString().slice(0, 10);

  const [{ data: consultoras, error: cErr }, { data: regs, error: rErr }] = await Promise.all([
    supabaseAdmin.from("radar_consultoras").select("nome,email,ativo").order("nome"),
    supabaseAdmin
      .from("do_registros")
      .select("consultora_responsavel,data_publicacao,atribuido_em")
      .not("consultora_responsavel", "is", null)
      .gte("data_publicacao", desde)
      .limit(100000),
  ]);
  if (cErr) throw new Error(cErr.message);
  if (rErr) throw new Error(rErr.message);

  const map = new Map<string, { total: number; janela: number; ultima: string | null }>();
  for (const r of (regs ?? []) as any[]) {
    const nome = String(r.consultora_responsavel);
    const cur = map.get(nome) ?? { total: 0, janela: 0, ultima: null };
    cur.total += 1;
    if (r.data_publicacao && String(r.data_publicacao) >= desde) cur.janela += 1;
    const ent = r.atribuido_em ? String(r.atribuido_em) : null;
    if (ent && (!cur.ultima || ent > cur.ultima)) cur.ultima = ent;
    map.set(nome, cur);
  }

  return ((consultoras ?? []) as any[]).map((c) => {
    const agg = map.get(String(c.nome));
    return {
      nome: String(c.nome),
      email: (c.email as string | null) ?? null,
      ativo: !!c.ativo,
      total: agg?.total ?? 0,
      janela: agg?.janela ?? 0,
      ultimaEntrega: agg?.ultima ?? null,
    };
  });
}

export type ResultadoDesempenho = ResultadoDistribuicao & {
  topConsultora: string | null;
  topPeso: number;
};

// Redistribui os leads ainda não abordados dando mais volume para quem produz
// mais (contatos do Radar + pontos da competição na janela) e menos para quem
// produz menos. Leads já trabalhados nunca saem de quem os abordou.
export async function redistribuirPorDesempenho(
  diasDesempenho = 14,
  janelaDias: number | null = null,
  pesoMax = 4,
  status: string[] = ["novo"],
  somenteNaoContatados = true,
): Promise<ResultadoDesempenho> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data, error } = await supabaseAdmin.rpc("redistribuir_do_registros_por_desempenho" as any, {
    _dias_desempenho: diasDesempenho,
    _janela_dias: janelaDias,
    _peso_max: pesoMax,
    _status: status.length ? status : ["novo"],
    _somente_nao_contatados: somenteNaoContatados,
  } as any);
  if (error) throw new Error(error.message);
  const row = (Array.isArray(data) ? data[0] : data) as any;
  return {
    atribuidos: Number(row?.atribuidos ?? 0),
    consultoras: Number(row?.consultoras ?? 0),
    topConsultora: (row?.top_consultora as string | null) ?? null,
    topPeso: Number(row?.top_peso ?? 0),
  };
}
