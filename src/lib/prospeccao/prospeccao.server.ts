export async function assertAdmin(supabase: any, userId: string) {
  const { data, error } = await supabase.rpc("has_role", {
    _user_id: userId,
    _role: "admin",
  });
  if (error) throw new Error(error.message);
  if (!data) throw new Error("Acesso restrito a administradores.");
}

export async function applyAssignments(
  supabaseAdmin: any,
  assignment: Map<string, string>,
): Promise<Record<string, number>> {
  const byCons = new Map<string, string[]>();
  for (const [leadId, cons] of assignment) {
    if (!byCons.has(cons)) byCons.set(cons, []);
    byCons.get(cons)!.push(leadId);
  }
  const perConsultant: Record<string, number> = {};
  for (const [cons, leadIds] of byCons) {
    for (let i = 0; i < leadIds.length; i += 500) {
      const chunk = leadIds.slice(i, i + 500);
      const { error } = await supabaseAdmin
        .from("prospect_leads")
        .update({ consultant_id: cons } as any)
        .in("id", chunk);
      if (error) throw new Error(error.message);
    }
    perConsultant[cons] = leadIds.length;
  }
  return perConsultant;
}

/** Fisher-Yates shuffle (returns a new array). */
export function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/**
 * Clears every lead ownership across the CRM without touching follow-ups
 * (lead_tasks) or notes/events (lead_events) — those stay stored on the lead
 * and are simply detached from the previous owner.
 */
export async function resetAllOwnership(supabaseAdmin: any) {
  const steps: [string, Record<string, unknown>][] = [
    ["prospect_leads", { consultant_id: null, opened_at: null }],
    ["leads_raw", { consultant_id: null, opened_at: null }],
    ["do_registros", { consultora_responsavel: null }],
    ["tomadores_al", { consultora_responsavel: null, atribuido_em: null }],
    ["lead_tasks", { consultant_id: null }],
    ["lead_events", { consultant_id: null }],
  ];
  for (const [table, patch] of steps) {
    const { error } = await supabaseAdmin.from(table).update(patch as any).not("id", "is", null);
    if (error) throw new Error(`${table}: ${error.message}`);
  }
  const { error: cErr } = await supabaseAdmin
    .from("radar_consultoras")
    .update({ total_leads_atribuidos: 0 } as any)
    .not("id", "is", null);
  if (cErr) throw new Error(cErr.message);
}

/** Removes tab permissions and non-admin roles (admins are preserved). */
export async function revokeAllAccess(supabaseAdmin: any) {
  const { error: tErr } = await supabaseAdmin.from("rh_tab_access").delete().not("id", "is", null);
  if (tErr) throw new Error(tErr.message);
  const { error: rErr } = await supabaseAdmin.from("user_roles").delete().neq("role", "admin");
  if (rErr) throw new Error(rErr.message);
}

/** Re-points stored follow-ups and notes of a lead to its new owner. */
export async function reattachLeadHistory(supabaseAdmin: any, assignment: Map<string, string>) {
  const byCons = new Map<string, string[]>();
  for (const [leadId, cons] of assignment) {
    if (!byCons.has(cons)) byCons.set(cons, []);
    byCons.get(cons)!.push(leadId);
  }
  for (const [cons, leadIds] of byCons) {
    for (let i = 0; i < leadIds.length; i += 500) {
      const chunk = leadIds.slice(i, i + 500);
      for (const table of ["lead_tasks", "lead_events"]) {
        const { error } = await supabaseAdmin
          .from(table)
          .update({ consultant_id: cons } as any)
          .in("lead_id", chunk);
        if (error) throw new Error(`${table}: ${error.message}`);
      }
    }
  }
}

/** Maps auth user ids to the matching radar_consultoras name (by e-mail). */
export async function consultoraNamesFor(supabaseAdmin: any, consultantIds: string[]) {
  const emails: string[] = [];
  for (const id of consultantIds) {
    const { data } = await supabaseAdmin.auth.admin.getUserById(id);
    if (data?.user?.email) emails.push(data.user.email.toLowerCase());
  }
  if (!emails.length) return [] as string[];
  const { data: rows } = await supabaseAdmin.from("radar_consultoras").select("nome,email").eq("ativo", true);
  return (rows ?? [])
    .filter((r: any) => r.email && emails.includes(String(r.email).toLowerCase()))
    .map((r: any) => r.nome as string);
}

/** Randomly spreads text-keyed lead tables (do_registros / tomadores_al) by name. */
export async function randomAssignByName(
  supabaseAdmin: any,
  table: "do_registros" | "tomadores_al",
  names: string[],
): Promise<number> {
  if (!names.length) return 0;
  const { data, error } = await supabaseAdmin.from(table).select("id").limit(20000);
  if (error) throw new Error(`${table}: ${error.message}`);
  const ids = shuffle((data ?? []).map((r: any) => r.id as string));
  if (!ids.length) return 0;

  const buckets = new Map<string, string[]>(names.map((n) => [n, [] as string[]]));
  ids.forEach((id, i) => buckets.get(names[i % names.length])!.push(id));

  let total = 0;
  for (const [nome, rowIds] of buckets) {
    for (let i = 0; i < rowIds.length; i += 500) {
      const chunk = rowIds.slice(i, i + 500);
      const patch: Record<string, unknown> = { consultora_responsavel: nome };
      if (table === "tomadores_al") patch['atribuido_em'] = new Date().toISOString();
      const { error: uErr } = await supabaseAdmin.from(table).update(patch as any).in("id", chunk);
      if (uErr) throw new Error(`${table}: ${uErr.message}`);
      total += chunk.length;
    }
  }
  return total;
}
