// Auditoria de operações administrativas (distribuição, reposição, revogação).
// Reaproveita public.rh_access_audit com novos valores de `action`.
// Nunca deve quebrar a operação principal.

export async function logAdminAction(entry: {
  actorId: string;
  actorEmail?: string | null;
  action: string;
  detail?: Record<string, unknown>;
}) {
  try {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    await supabaseAdmin.from("rh_access_audit").insert({
      actor_id: entry.actorId,
      actor_email: entry.actorEmail ?? null,
      action: entry.action,
      detail: (entry.detail ?? {}) as never,
    });
  } catch {
    // auditoria é best-effort
  }
}
