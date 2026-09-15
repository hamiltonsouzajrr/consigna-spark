// Server-only helper: dispara lembretes de follow-up (pop-up/notificação) para
// as consultoras que têm retornos agendados vencendo. Usado tanto pelo botão do
// admin quanto pelo gatilho automático (cron público).

const JANELA_MIN = 30; // avisa retornos vencidos ou que vencem nos próximos 30 min
const DEDUP_HORAS = 1; // não repete o mesmo lembrete dentro desse intervalo (era 3h, agora 1h)

export async function dispararLembretesFollowup(): Promise<{
  consultoras: number;
  enviados: number;
  pendentes: number;
}> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

  const limite = new Date(Date.now() + JANELA_MIN * 60_000).toISOString();
  const { data, error } = await supabaseAdmin
    .from("lead_tasks")
    .select("id,consultant_id,due_at,lead_id,tomador_id")
    .eq("status", "pending")
    .lte("due_at", limite)
    .limit(5000);
  if (error) throw new Error(error.message);

  const leadIds = (data ?? []).map((r: any) => r.lead_id).filter(Boolean);
  const tomadorIds = (data ?? []).map((r: any) => r.tomador_id).filter(Boolean);
  const [leads, tomadores] = await Promise.all([
    leadIds.length ? supabaseAdmin.from("prospect_leads").select("id,nome").in("id", leadIds) : Promise.resolve({ data: [] }),
    tomadorIds.length ? supabaseAdmin.from("tomadores_al").select("id,nome").in("id", tomadorIds) : Promise.resolve({ data: [] }),
  ]);
  const nomes = new Map<string, string>([...(leads.data ?? []), ...(tomadores.data ?? [])].map((r: any) => [r.id, r.nome]));
  const porConsultora = new Map<string, { total: number; proximo: string; nome: string; atrasados: number }>();
  const agora = new Date().toISOString();
  for (const l of data ?? []) {
    const uid = (l as any).consultant_id as string | null;
    if (!uid) continue;
    const quando = (l as any).due_at as string;
    const nome = nomes.get((l as any).lead_id ?? (l as any).tomador_id) ?? "cliente";
    const isAtrasado = quando <= agora;
    const atual = porConsultora.get(uid);
    if (!atual) {
      porConsultora.set(uid, { total: 1, proximo: quando, nome, atrasados: isAtrasado ? 1 : 0 });
    } else {
      atual.total += 1;
      if (isAtrasado) atual.atrasados += 1;
      if (quando < atual.proximo) { atual.proximo = quando; atual.nome = nome; }
    }
  }

  const pendentes = (data ?? []).length;
  if (porConsultora.size === 0) return { consultoras: 0, enviados: 0, pendentes };

  const desde = new Date(Date.now() - DEDUP_HORAS * 3_600_000).toISOString();
  const { data: recentes } = await supabaseAdmin
    .from("rh_notifications")
    .select("user_id")
    .eq("title", "\u26A0\uFE0F Follow-ups para agora")
    .gte("created_at", desde);
  // Also check old title for backward compat
  const { data: recentesOld } = await supabaseAdmin
    .from("rh_notifications")
    .select("user_id")
    .eq("title", "Follow-ups para agora")
    .gte("created_at", desde);
  const jaAvisados = new Set([
    ...((recentes ?? []).map((r: any) => r.user_id as string)),
    ...((recentesOld ?? []).map((r: any) => r.user_id as string)),
  ]);

  const rows = [...porConsultora.entries()]
    .filter(([uid]) => !jaAvisados.has(uid))
    .map(([uid, info]) => ({
      user_id: uid,
      title: "\u26A0\uFE0F Follow-ups para agora",
      body:
        info.total === 1
          ? `Retorno agendado com ${info.nome}. Abra a aba Follow-ups e faça o contato AGORA.`
          : info.atrasados > 0
            ? `Você tem ${info.total} follow-ups (${info.atrasados} ATRASADO${info.atrasados > 1 ? "S" : ""}). O mais urgente: ${info.nome}. Não perca a venda!`
            : `Você tem ${info.total} follow-ups para agora (o mais urgente: ${info.nome}). Faça o contato!`,
    }));

  if (rows.length === 0) return { consultoras: porConsultora.size, enviados: 0, pendentes };

  const { error: insErr } = await supabaseAdmin.from("rh_notifications").insert(rows as any);
  if (insErr) throw new Error(insErr.message);

  return { consultoras: porConsultora.size, enviados: rows.length, pendentes };
}
