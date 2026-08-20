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
