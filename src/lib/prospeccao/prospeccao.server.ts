export async function assertAdmin(supabase: any, userId: string) {
  const { data, error } = await supabase.rpc("has_role", {
    _user_id: userId,
    _role: "admin",
  });
  if (error) throw new Error(error.message);
  if (!data) throw new Error("Acesso restrito a administradores.");
}

export type ConsultantUser = { id: string; email: string };

export async function listConsultantUsers(supabaseAdmin: any): Promise<ConsultantUser[]> {
  const [{ data: usersData, error }, { data: roles }] = await Promise.all([
    supabaseAdmin.auth.admin.listUsers({ page: 1, perPage: 1000 }),
    supabaseAdmin.from("user_roles").select("user_id, role"),
  ]);
  if (error) throw new Error(error.message);

  const adminIds = new Set((roles ?? []).filter((r: any) => r.role === "admin").map((r: any) => String(r.user_id)));
  return (usersData.users ?? [])
    .filter((u: any) => !u.deleted_at && u.email && !adminIds.has(u.id))
    .map((u: any) => ({ id: String(u.id), email: String(u.email) }))
    .sort((a: ConsultantUser, b: ConsultantUser) => a.email.localeCompare(b.email));
}

export async function assertConsultantIds(supabaseAdmin: any, consultantIds: string[]) {
  const unique = [...new Set(consultantIds.filter(Boolean))];
  if (!unique.length) return;
  const allowed = new Set((await listConsultantUsers(supabaseAdmin)).map((c) => c.id));
  const invalid = unique.filter((id) => !allowed.has(id));
  if (invalid.length) {
    throw new Error("Selecione apenas consultoras ativas. Atualize a lista e tente novamente.");
  }
}

export async function applyAssignments(
  supabaseAdmin: any,
  assignment: Map<string, string>,
): Promise<Record<string, number>> {
  await assertConsultantIds(supabaseAdmin, [...assignment.values()]);
  const byCons = new Map<string, string[]>();
  for (const [leadId, cons] of assignment) {
    const bucket = byCons.get(cons) ?? [];
    bucket.push(leadId);
    byCons.set(cons, bucket);
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
    const bucket = byCons.get(cons) ?? [];
    bucket.push(leadId);
    byCons.set(cons, bucket);
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
  const ids = shuffle<string>((data ?? []).map((r: any) => String(r.id)));
  if (!ids.length) return 0;

  const buckets = new Map<string, string[]>(names.map((n) => [n, [] as string[]]));
  ids.forEach((id, i) => {
    const nome = names[i % names.length];
    const bucket = buckets.get(nome) ?? [];
    bucket.push(id);
    buckets.set(nome, bucket);
  });

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
