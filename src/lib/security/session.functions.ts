import { createServerFn } from "@tanstack/react-start";
import { getRequestHeader } from "@tanstack/react-start/server";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { avaliarJanela, enviarEmailIncidente } from "./access.server";

const JANELA_VIVA_MS = 90_000; // sinal de vida considerado ativo

function clientIp(): string | null {
  return (
    getRequestHeader("cf-connecting-ip") ??
    getRequestHeader("x-forwarded-for")?.split(",")[0]?.trim() ??
    null
  );
}

export type AccessState = {
  isAdmin: boolean;
  janela: ReturnType<typeof avaliarJanela>;
  sessaoBloqueada: boolean;
  incidenteEm: string | null;
};

/**
 * Batimento de sessão + verificação de horário. Chamado no mount e a cada 30s.
 * Admins são isentos das duas travas.
 */
export const pulseAccess = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { sessionKey: string }) => {
    const key = String(data?.sessionKey ?? "").slice(0, 80);
    if (key.length < 8) throw new Error("sessionKey inválida");
    return { sessionKey: key };
  })
  .handler(async ({ data, context }): Promise<AccessState> => {
    const { supabase, userId, claims } = context;
    const janela = avaliarJanela();

    const { data: isAdmin } = await supabase.rpc("has_role", {
      _user_id: userId,
      _role: "admin",
    });

    if (isAdmin) {
      return {
        isAdmin: true,
        janela: { ...janela, aberto: true, motivo: "aberto" },
        sessaoBloqueada: false,
        incidenteEm: null,
      };
    }

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const nowIso = new Date().toISOString();
    const email = (claims as { email?: string } | null)?.email ?? null;

    await supabaseAdmin
      .from("app_sessions")
      .upsert(
        {
          user_id: userId,
          session_key: data.sessionKey,
          ip: clientIp(),
          user_agent: getRequestHeader("user-agent")?.slice(0, 300) ?? null,
          last_seen_at: nowIso,
        } as never,
        { onConflict: "user_id,session_key" },
      );

    const { data: rows } = await supabaseAdmin
      .from("app_sessions")
      .select("id,session_key,ip,user_agent,blocked_at,last_seen_at")
      .eq("user_id", userId);

    const todas = rows ?? [];
    const minha = todas.find((r) => r.session_key === data.sessionKey);
    const vivas = todas.filter(
      (r) => new Date(r.last_seen_at).getTime() > Date.now() - JANELA_VIVA_MS,
    );
    const outras = vivas.filter((r) => r.session_key !== data.sessionKey);

    let sessaoBloqueada = !!minha?.blocked_at;
    let incidenteEm: string | null = null;

    if (outras.length > 0 && !sessaoBloqueada) {
      // Trava as DUAS sessões e registra o incidente.
      await supabaseAdmin
        .from("app_sessions")
        .update({ blocked_at: nowIso } as never)
        .in(
          "id",
          vivas.map((r) => r.id),
        );

      const detalhes = {
        sessoes: vivas.map((r) => ({
          ip: r.ip,
          navegador: r.user_agent,
          ultimo_sinal: r.last_seen_at,
          atual: r.session_key === data.sessionKey,
        })),
      };

      const { data: inc } = await supabaseAdmin
        .from("security_incidents")
        .insert({
          tipo: "acesso_simultaneo",
          user_id: userId,
          user_email: email,
          detalhes,
        } as never)
        .select("created_at")
        .single();

      await enviarEmailIncidente({ email, detalhes });
      sessaoBloqueada = true;
      incidenteEm = (inc as { created_at?: string } | null)?.created_at ?? nowIso;
    }

    return { isAdmin: false, janela, sessaoBloqueada, incidenteEm };
  });

/** Encerra o registro da sessão atual (usado no logout). */
export const endSession = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { sessionKey: string }) => ({
    sessionKey: String(data?.sessionKey ?? "").slice(0, 80),
  }))
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    await supabaseAdmin
      .from("app_sessions")
      .delete()
      .eq("user_id", context.userId)
      .eq("session_key", data.sessionKey)
      .is("blocked_at", null);
    return { ok: true };
  });

export type Incidente = {
  id: string;
  user_id: string;
  user_email: string | null;
  detalhes: { sessoes?: { ip: string | null; navegador: string | null; ultimo_sinal: string; atual: boolean }[] } | null;
  created_at: string;
  resolvido_em: string | null;
};

async function assertAdmin(supabase: any, userId: string) {
  const { data } = await supabase.rpc("has_role", { _user_id: userId, _role: "admin" });
  if (!data) throw new Error("Acesso restrito a administradores.");
}

export const listIncidents = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { pendentes?: boolean; dias?: number } | undefined) => ({
    pendentes: data?.pendentes ?? false,
    dias: Math.min(Math.max(data?.dias ?? 30, 1), 365),
  }))
  .handler(async ({ data, context }): Promise<Incidente[]> => {
    await assertAdmin(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const desde = new Date(Date.now() - data.dias * 86_400_000).toISOString();
    let q = supabaseAdmin
      .from("security_incidents")
      .select("id,user_id,user_email,detalhes,created_at,resolvido_em")
      .gte("created_at", desde)
      .order("created_at", { ascending: false })
      .limit(200);
    if (data.pendentes) q = q.is("resolvido_em", null);
    const { data: rows, error } = await q;
    if (error) throw new Error(error.message);
    return (rows ?? []) as Incidente[];
  });

/** Libera a conta: remove as sessões travadas e resolve os incidentes abertos. */
export const releaseAccount = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { userId: string }) => ({ userId: String(data.userId) }))
  .handler(async ({ data, context }) => {
    await assertAdmin(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    await supabaseAdmin.from("app_sessions").delete().eq("user_id", data.userId);
    const { error } = await supabaseAdmin
      .from("security_incidents")
      .update({ resolvido_em: new Date().toISOString(), resolvido_por: context.userId } as never)
      .eq("user_id", data.userId)
      .is("resolvido_em", null);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
