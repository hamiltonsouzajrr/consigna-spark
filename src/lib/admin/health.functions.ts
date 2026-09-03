// Painel de saúde operacional do admin: uma única chamada agregadora usada no
// topo de /admin, com links diretos para a ação correspondente.
import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export type AdminHealth = {
  radarUltimaExecucao: string | null;
  radarUltimoStatus: string | null;
  promovidosSemConsultora: number;
  promovidosUltimos15Dias: number;
  tomadoresLivres: number;
  leadsSemConsultora: number;
  consultorasAtivas: number;
  consultorasInativas7d: number;
  incidentesAbertos: number;
  contasBloqueadas: number;
  admins: number;
};

async function assertAdmin(supabase: any, userId: string) {
  const { data, error } = await supabase.rpc("has_role", { _user_id: userId, _role: "admin" });
  if (error) throw new Error(error.message);
  if (!data) throw new Error("Acesso restrito a administradores.");
}

export const getAdminHealth = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<AdminHealth> => {
    const { supabase, userId } = context as any;
    await assertAdmin(supabase, userId);

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const db: any = supabaseAdmin;

    const iso15 = new Date(Date.now() - 15 * 864e5).toISOString();
    const iso7 = new Date(Date.now() - 7 * 864e5).toISOString();

    const count = async (
      table: string,
      build: (q: any) => any,
    ): Promise<number> => {
      const { count: c, error } = await build(
        db.from(table).select("id", { count: "exact", head: true }),
      );
      if (error) return 0;
      return c ?? 0;
    };

    const [
      job,
      promovidosSemConsultora,
      promovidosUltimos15Dias,
      tomadoresLivres,
      leadsSemConsultora,
      consultorasAtivas,
      incidentesAbertos,
      contasBloqueadas,
      admins,
      sessoesRecentes,
    ] = await Promise.all([
      db
        .from("diario_busca_jobs")
        .select("status, updated_at")
        .order("updated_at", { ascending: false })
        .limit(1)
        .maybeSingle(),
      count("do_registros", (q) => q.is("consultora_responsavel", null)),
      count("do_registros", (q) => q.gte("created_at", iso15)),
      count("tomadores_al", (q) => q.is("consultora_responsavel", null)),
      count("prospect_leads", (q) => q.is("consultant_id", null)),
      count("radar_consultoras", (q) => q.eq("ativo", true)),
      count("security_incidents", (q) => q.is("resolvido_em", null)),
      count("app_sessions", (q) => q.not("blocked_at", "is", null)),
      count("user_roles", (q) => q.eq("role", "admin")),
      db.from("app_sessions").select("user_id, last_seen_at").gte("last_seen_at", iso7),
    ]);

    const ativosSet = new Set<string>(
      ((sessoesRecentes?.data ?? []) as Array<{ user_id: string }>).map((s) => s.user_id),
    );

    return {
      radarUltimaExecucao: job?.data?.updated_at ?? null,
      radarUltimoStatus: job?.data?.status ?? null,
      promovidosSemConsultora,
      promovidosUltimos15Dias,
      tomadoresLivres,
      leadsSemConsultora,
      consultorasAtivas,
      consultorasInativas7d: Math.max(0, consultorasAtivas - ativosSet.size),
      incidentesAbertos,
      contasBloqueadas,
      admins,
    };
  });
