// Séries agregadas para os gráficos do hub administrativo.
// Uma única chamada, atualizada automaticamente pelo React Query.
import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export type SerieItem = { label: string; valor: number };
export type PontoCarteira = { dia: string; atribuidos: number };

export type AdminCharts = {
  leadsPorConsultora: SerieItem[];
  followupsPorConsultora: SerieItem[];
  tomadoresPorOrigem: SerieItem[];
  evolucaoCarteira: PontoCarteira[];
  atualizadoEm: string;
};

async function assertAdmin(supabase: any, userId: string) {
  const { data, error } = await supabase.rpc("has_role", { _user_id: userId, _role: "admin" });
  if (error) throw new Error(error.message);
  if (!data) throw new Error("Acesso restrito a administradores.");
}

const topN = (map: Map<string, number>, n: number): SerieItem[] =>
  [...map.entries()]
    .map(([label, valor]) => ({ label, valor }))
    .sort((a, b) => b.valor - a.valor)
    .slice(0, n);

export const getAdminCharts = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<AdminCharts> => {
    const { supabase, userId } = context as any;
    await assertAdmin(supabase, userId);

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const db: any = supabaseAdmin;

    const dias = 14;
    const desde = new Date(Date.now() - dias * 864e5);
    const desdeIso = desde.toISOString();

    const [promovidos, tarefas, tomadores, carteira, colaboradores] = await Promise.all([
      // Leads (promovidos do Diário Oficial) já distribuídos por consultora.
      db
        .from("do_registros")
        .select("consultora_responsavel")
        .not("consultora_responsavel", "is", null)
        .limit(50000),
      // Follow-ups agendados/realizados por consultora.
      db
        .from("lead_tasks")
        .select("consultant_id")
        .not("consultant_id", "is", null)
        .limit(50000),
      // Tomadores com margem por origem (órgão de lotação).
      db.from("tomadores_al").select("orgao").limit(50000),
      // Evolução da carteira: atribuições por dia nos últimos 14 dias.
      db
        .from("tomadores_al")
        .select("atribuido_em")
        .not("atribuido_em", "is", null)
        .gte("atribuido_em", desdeIso)
        .limit(50000),
      db.from("rh_employees").select("user_id, full_name").not("user_id", "is", null),
    ]);

    const nomePorUser = new Map<string, string>();
    for (const e of (colaboradores?.data ?? []) as { user_id: string; full_name: string }[]) {
      nomePorUser.set(e.user_id, e.full_name);
    }

    const leadsMap = new Map<string, number>();
    for (const r of (promovidos?.data ?? []) as { consultora_responsavel: string }[]) {
      const k = r.consultora_responsavel.trim() || "Sem nome";
      leadsMap.set(k, (leadsMap.get(k) ?? 0) + 1);
    }

    const followMap = new Map<string, number>();
    for (const t of (tarefas?.data ?? []) as { consultant_id: string }[]) {
      const k = nomePorUser.get(t.consultant_id) ?? "Consultora sem cadastro";
      followMap.set(k, (followMap.get(k) ?? 0) + 1);
    }

    const origemMap = new Map<string, number>();
    for (const t of (tomadores?.data ?? []) as { orgao: string | null }[]) {
      const k = (t.orgao ?? "").trim() || "Sem origem";
      origemMap.set(k, (origemMap.get(k) ?? 0) + 1);
    }

    const porDia = new Map<string, number>();
    for (let i = dias - 1; i >= 0; i--) {
      const d = new Date(Date.now() - i * 864e5);
      porDia.set(d.toISOString().slice(0, 10), 0);
    }
    for (const t of (carteira?.data ?? []) as { atribuido_em: string }[]) {
      const dia = t.atribuido_em.slice(0, 10);
      if (porDia.has(dia)) porDia.set(dia, (porDia.get(dia) ?? 0) + 1);
    }

    return {
      leadsPorConsultora: topN(leadsMap, 10),
      followupsPorConsultora: topN(followMap, 10),
      tomadoresPorOrigem: topN(origemMap, 8),
      evolucaoCarteira: [...porDia.entries()].map(([dia, atribuidos]) => ({ dia, atribuidos })),
      atualizadoEm: new Date().toISOString(),
    };
  });
