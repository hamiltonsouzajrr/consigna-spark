// Séries agregadas para os gráficos da tela de prospecção (visão consultora).
import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export type SerieItem = { label: string; valor: number };
export type PontoCarteira = { dia: string; atribuidos: number };

export type ProspeccaoCharts = {
  minhaConsultora: string | null;
  leadsPorConsultora: SerieItem[];
  followupsPorOrigem: SerieItem[];
  evolucaoCarteira: PontoCarteira[];
  atualizadoEm: string;
};

const topN = (map: Map<string, number>, n: number): SerieItem[] =>
  [...map.entries()]
    .map(([label, valor]) => ({ label, valor }))
    .sort((a, b) => b.valor - a.valor)
    .slice(0, n);

export const getProspeccaoCharts = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<ProspeccaoCharts> => {
    const { supabase } = context as any;

    const { data: nomeRpc } = await supabase.rpc("minha_consultora_nome");
    const minhaConsultora = (nomeRpc as string | null) ?? null;

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const db: any = supabaseAdmin;

    const dias = 14;
    const desdeIso = new Date(Date.now() - dias * 864e5).toISOString();

    const [promovidos, tarefas, carteira] = await Promise.all([
      // Ranking de leads distribuídos (Diário Oficial) por consultora.
      db
        .from("do_registros")
        .select("consultora_responsavel")
        .not("consultora_responsavel", "is", null)
        .limit(50000),
      // Follow-ups agrupados pela origem do lead.
      db
        .from("lead_tasks")
        .select("id, prospect_leads(origem)")
        .limit(50000),
      // Evolução da minha carteira de tomadores nos últimos 14 dias.
      minhaConsultora
        ? db
            .from("tomadores_al")
            .select("atribuido_em")
            .eq("consultora_responsavel", minhaConsultora)
            .not("atribuido_em", "is", null)
            .gte("atribuido_em", desdeIso)
            .limit(50000)
        : Promise.resolve({ data: [] }),
    ]);

    const leadsMap = new Map<string, number>();
    for (const r of (promovidos?.data ?? []) as { consultora_responsavel: string }[]) {
      const k = r.consultora_responsavel.trim() || "Sem nome";
      leadsMap.set(k, (leadsMap.get(k) ?? 0) + 1);
    }

    const origemMap = new Map<string, number>();
    for (const t of (tarefas?.data ?? []) as { prospect_leads: { origem: string | null } | null }[]) {
      const k = (t.prospect_leads?.origem ?? "").trim() || "Sem origem";
      origemMap.set(k, (origemMap.get(k) ?? 0) + 1);
    }

    const porDia = new Map<string, number>();
    for (let i = dias - 1; i >= 0; i--) {
      porDia.set(new Date(Date.now() - i * 864e5).toISOString().slice(0, 10), 0);
    }
    for (const t of (carteira?.data ?? []) as { atribuido_em: string }[]) {
      const dia = t.atribuido_em.slice(0, 10);
      if (porDia.has(dia)) porDia.set(dia, (porDia.get(dia) ?? 0) + 1);
    }

    return {
      minhaConsultora,
      leadsPorConsultora: topN(leadsMap, 10),
      followupsPorOrigem: topN(origemMap, 8),
      evolucaoCarteira: [...porDia.entries()].map(([dia, atribuidos]) => ({ dia, atribuidos })),
      atualizadoEm: new Date().toISOString(),
    };
  });
