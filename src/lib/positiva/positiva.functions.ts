import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

// ----- Coach chat history (single continuous conversation per user) -----
export const loadCoachHistory = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("positiva_coach_messages")
      .select("id,role,content,created_at")
      .order("created_at", { ascending: true })
      .limit(200);
    if (error) throw new Error(error.message);
    return { messages: data ?? [] };
  });

export const saveCoachMessage = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { role: "user" | "assistant"; content: string }) =>
    z.object({ role: z.enum(["user", "assistant"]), content: z.string().min(1).max(8000) }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("positiva_coach_messages")
      .insert({ user_id: context.userId, role: data.role, content: data.content });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// ----- Activities -----
const TIPOS = ["ligacao", "prospeccao", "proposta", "followup", "contrato", "reativacao"] as const;
export const registrarAtividade = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { tipo: (typeof TIPOS)[number]; quantidade?: number }) =>
    z.object({ tipo: z.enum(TIPOS), quantidade: z.number().int().min(1).max(500).optional() }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("positiva_atividades")
      .insert({ user_id: context.userId, tipo: data.tipo, quantidade: data.quantidade ?? 1 });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// ----- Check-in -----
export const saveCheckin = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { periodo: string; energia?: number; respostas: Record<string, unknown> }) =>
    z.object({
      periodo: z.enum(["08h", "11h", "15h", "17h"]),
      energia: z.number().int().min(1).max(3).optional(),
      respostas: z.record(z.string(), z.any()),
    }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const today = new Date().toISOString().slice(0, 10);
    const { error } = await context.supabase
      .from("positiva_checkins")
      .upsert(
        { user_id: context.userId, ref_date: today, periodo: data.periodo, energia: data.energia ?? null, respostas: data.respostas },
        { onConflict: "user_id,ref_date,periodo" },
      );
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// ----- Humor -----
export const saveHumor = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { estado: string }) =>
    z.object({ estado: z.enum(["motivada", "normal", "cansada", "desanimada"]) }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const today = new Date().toISOString().slice(0, 10);
    const { error } = await context.supabase
      .from("positiva_humor")
      .upsert({ user_id: context.userId, ref_date: today, estado: data.estado }, { onConflict: "user_id,ref_date" });
    if (error) throw new Error(error.message);
    // Alerta de desânimo recorrente (últimos 7 dias).
    if (data.estado === "desanimada") {
      const since = new Date(Date.now() - 7 * 86400000).toISOString().slice(0, 10);
      const { data: recentes } = await context.supabase
        .from("positiva_humor")
        .select("estado")
        .gte("ref_date", since)
        .eq("estado", "desanimada");
      if ((recentes?.length ?? 0) >= 3) {
        await context.supabase.from("positiva_alertas").insert({
          user_id: context.userId,
          tipo: "humor",
          mensagem: "Desânimo recorrente detectado nos últimos dias.",
        });
      }
    }
    return { ok: true };
  });

// ----- Daily summary (own) -----
export const getMyResumo = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const today = new Date().toISOString().slice(0, 10);
    const since = new Date(Date.now() - 30 * 86400000).toISOString().slice(0, 10);
    const [atvToday, atv30, humor] = await Promise.all([
      context.supabase.from("positiva_atividades").select("tipo,quantidade").eq("ref_date", today),
      context.supabase.from("positiva_atividades").select("tipo,quantidade").gte("ref_date", since),
      context.supabase.from("positiva_humor").select("estado").eq("ref_date", today).maybeSingle(),
    ]);
    const somar = (rows: { tipo: string; quantidade: number }[] | null) => {
      const m: Record<string, number> = {};
      (rows ?? []).forEach((r) => { m[r.tipo] = (m[r.tipo] ?? 0) + r.quantidade; });
      return m;
    };
    return { hoje: somar(atvToday.data as never), mes: somar(atv30.data as never), humor: humor.data?.estado ?? null };
  });

// ----- Admin dashboard (admin only) -----
export const getAdminDashboard = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data: isAdmin } = await context.supabase.rpc("has_role", { _user_id: context.userId, _role: "admin" });
    if (!isAdmin) throw new Error("Forbidden");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const today = new Date().toISOString().slice(0, 10);
    const [atv, checkins, alertas, score] = await Promise.all([
      supabaseAdmin.from("positiva_atividades").select("user_id,tipo,quantidade").eq("ref_date", today),
      supabaseAdmin.from("positiva_checkins").select("user_id,energia").eq("ref_date", today),
      supabaseAdmin.from("positiva_alertas").select("id,user_id,tipo,mensagem,created_at,resolvido").eq("resolvido", false).order("created_at", { ascending: false }).limit(50),
      supabaseAdmin.from("positiva_score").select("user_id,hunter_score").eq("ref_date", today),
    ]);
    const totals: Record<string, number> = {};
    (atv.data ?? []).forEach((r) => { totals[r.tipo] = (totals[r.tipo] ?? 0) + r.quantidade; });
    const porConsultor: Record<string, number> = {};
    (atv.data ?? []).forEach((r) => { porConsultor[r.user_id] = (porConsultor[r.user_id] ?? 0) + r.quantidade; });
    const ranking = Object.entries(porConsultor).map(([user_id, total]) => ({ user_id, total })).sort((a, b) => b.total - a.total);
    const energias = (checkins.data ?? []).map((c) => c.energia).filter((e): e is number => !!e);
    const energiaMedia = energias.length ? energias.reduce((a, b) => a + b, 0) / energias.length : 0;
    const contratos = totals["contrato"] ?? 0;
    const propostas = totals["proposta"] ?? 0;
    const conversao = propostas > 0 ? Math.round((contratos / propostas) * 100) : 0;
    return {
      totals,
      ranking,
      alertas: alertas.data ?? [],
      energiaMedia,
      conversao,
      scores: score.data ?? [],
    };
  });
