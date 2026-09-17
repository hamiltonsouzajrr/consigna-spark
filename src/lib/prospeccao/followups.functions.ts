// Server functions dos lembretes de follow-up.
// - enviarLembretesFollowup: admin dispara o pop-up/notificação para todas as
//   consultoras com retornos agendados vencendo (o sistema também dispara
//   automaticamente pelo gatilho público de rotina).

import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

export type FollowupUnificado = {
  id: string; title: string; due_at: string; origem: "crm" | "tomadores_al";
  cliente_id: string; nome: string; telefone: string | null;
};

async function admin() {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin as any;
}

async function podeGerir(context: any, consultantId: string | null) {
  if (consultantId === context.userId) return true;
  const { data } = await context.supabase.rpc("has_role", { _user_id: context.userId, _role: "admin" });
  return Boolean(data);
}

export const listarMeusFollowups = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => z.object({ ate: z.string().optional(), limit: z.number().int().min(1).max(300).default(200) }).parse(data ?? {}))
  .handler(async ({ context, data }): Promise<FollowupUnificado[]> => {
    const db = await admin();
    // Cada pessoa vê apenas os próprios retornos — inclusive administradores,
    // para o aviso não encher a tela com clientes de outras consultoras.
    let q = db
      .from("lead_tasks")
      .select("id,title,due_at,lead_id,tomador_id,consultant_id")
      .eq("status", "pending")
      .eq("consultant_id", context.userId)
      .order("due_at")
      .limit(data.limit);
    if (data.ate) q = q.lte("due_at", data.ate);
    const { data: tasks, error } = await q;
    if (error) throw new Error(error.message);
    const leadIds = (tasks ?? []).map((t: any) => t.lead_id).filter(Boolean);
    const tomadorIds = (tasks ?? []).map((t: any) => t.tomador_id).filter(Boolean);
    const [leads, tomadores] = await Promise.all([
      leadIds.length ? db.from("prospect_leads").select("id,nome,telefone,telefones,status").in("id", leadIds) : Promise.resolve({ data: [] }),
      tomadorIds.length ? db.from("tomadores_al").select("id,nome,telefones").in("id", tomadorIds) : Promise.resolve({ data: [] }),
    ]);
    const clientes = new Map<string, { nome: string; telefone: string | null }>();
    // Cliente já ganho ou perdido não volta a cobrar retorno.
    for (const l of leads.data ?? []) {
      if (l.status === "ganho" || l.status === "perdido") continue;
      clientes.set(l.id, { nome: l.nome, telefone: l.telefone ?? l.telefones?.[0] ?? null });
    }
    for (const t of tomadores.data ?? []) clientes.set(t.id, { nome: t.nome, telefone: t.telefones?.[0] ?? null });
    return (tasks ?? []).flatMap((t: any) => {
      const clienteId = t.lead_id ?? t.tomador_id;
      const cliente = clientes.get(clienteId);
      return cliente ? [{ id: t.id, title: t.title, due_at: t.due_at, origem: t.tomador_id ? "tomadores_al" : "crm", cliente_id: clienteId, ...cliente }] : [];
    });
  });

const taskSchema = z.object({ taskId: z.string().uuid() });

export const marcarFollowupVisto = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => taskSchema.parse(data))
  .handler(async ({ context, data }) => {
    const db = await admin();
    const { data: task } = await db.from("lead_tasks").select("id,lead_id,tomador_id,consultant_id,status").eq("id", data.taskId).maybeSingle();
    if (!task || !(await podeGerir(context, task.consultant_id))) throw new Error("Follow-up não encontrado.");
    if (task.status !== "pending") return { ok: true };
    const { error } = await db.from("lead_tasks").update({ status: "done" }).eq("id", task.id);
    if (error) throw new Error(error.message);
    if (task.lead_id) await db.from("prospect_leads").update({ next_follow_up_at: null }).eq("id", task.lead_id);
    await db.from("lead_events").insert({ lead_id: task.lead_id, tomador_id: task.tomador_id, origem: task.tomador_id ? "tomadores_al" : "crm", consultant_id: context.userId, kind: "followup", body: "Follow-up marcado como visto e concluído" });
    return { ok: true };
  });

export const reagendarFollowupUnificado = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => taskSchema.extend({ dueAt: z.string().min(8) }).parse(data))
  .handler(async ({ context, data }) => {
    const db = await admin();
    const { data: task } = await db.from("lead_tasks").select("id,lead_id,consultant_id,status").eq("id", data.taskId).maybeSingle();
    if (!task || !(await podeGerir(context, task.consultant_id))) throw new Error("Follow-up não encontrado.");
    if (task.status !== "pending") throw new Error("Este follow-up já foi concluído.");
    const dueAt = new Date(data.dueAt).toISOString();
    const { error } = await db.from("lead_tasks").update({ due_at: dueAt }).eq("id", task.id);
    if (error) throw new Error(error.message);
    if (task.lead_id) await db.from("prospect_leads").update({ next_follow_up_at: dueAt }).eq("id", task.lead_id);
    return { dueAt };
  });

export const enviarLembretesFollowup = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data: isAdmin, error } = await context.supabase.rpc("has_role", {
      _user_id: context.userId,
      _role: "admin",
    });
    if (error) throw new Error(error.message);
    if (!isAdmin) throw new Error("Acesso restrito a administradores.");

    const { dispararLembretesFollowup } = await import("./followups.server");
    return dispararLembretesFollowup();
  });
