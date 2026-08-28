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
    .from("prospect_leads")
    .select("id,nome,consultant_id,next_follow_up_at")
    .not("next_follow_up_at", "is", null)
    .lte("next_follow_up_at", limite)
    .not("status", "in", "(ganho,perdido)")
    .limit(5000);
  if (error) throw new Error(error.message);

  const porConsultora = new Map<string, { total: number; proximo: string; nome: string; atrasados: number }>();
  const agora = new Date().toISOString();
  for (const l of data ?? []) {
    const uid = (l as any).consultant_id as string | null;
    if (!uid) continue;
    const quando = (l as any).next_follow_up_at as string;
    const isAtrasado = quando <= agora;
    const atual = porConsultora.get(uid);
    if (!atual) {
      porConsultora.set(uid, { total: 1, proximo: quando, nome: (l as any).nome, atrasados: isAtrasado ? 1 : 0 });
    } else {
      atual.total += 1;
      if (isAtrasado) atual.atrasados += 1;
      if (quando < atual.proximo) { atual.proximo = quando; atual.nome = (l as any).nome; }
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
