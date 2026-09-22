import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export type ChegaramResumo = {
  crm: number;
  tomadores: number;
  promovidos: number;
  leads: { id: string; nome: string; cidade: string | null; status: string }[];
};

// O que entrou na carteira da pessoa logada nas últimas horas — inclusive
// clientes que já tinham sido trabalhados antes e por isso não aparecem na
// fila de "ainda não falei".
export const chegaramParaMim = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => z.object({ horas: z.number().int().min(1).max(168).optional() }).parse(data ?? {}))
  .handler(async ({ context, data }): Promise<ChegaramResumo> => {
    const desde = new Date(Date.now() - (data.horas ?? 24) * 3600_000).toISOString();
    const { supabase, userId } = context;

    const [crmCount, leads, tomadores, promovidos] = await Promise.all([
      // Conta apenas o que foi realmente entregue (atribuido_em), e não
      // qualquer ficha que a consultora editou hoje.
      supabase
        .from("prospect_leads")
        .select("id", { count: "exact", head: true })
        .eq("consultant_id", userId)
        .gte("atribuido_em", desde),
      supabase
        .from("prospect_leads")
        .select("id,nome,cidade,status")
        .eq("consultant_id", userId)
        .gte("atribuido_em", desde)
        .order("atribuido_em", { ascending: false })
        .limit(10),
      supabase
        .from("tomadores_al")
        .select("id", { count: "exact", head: true })
        .gte("atribuido_em", desde),
      supabase
        .from("do_registros")
        .select("id", { count: "exact", head: true })
        .gte("atribuido_em", desde),
    ]);

    return {
      crm: crmCount.count ?? 0,
      tomadores: tomadores.count ?? 0,
      promovidos: promovidos.count ?? 0,
      leads: ((leads.data ?? []) as any[]).map((r) => ({
        id: String(r.id),
        nome: String(r.nome ?? "—"),
        cidade: r.cidade ?? null,
        status: String(r.status ?? "novo"),
      })),
    };
  });
