// Server functions for the Prospecção (CRM) area.
// - getProspectConsultants: admin-only; lists user accounts for lead assignment.
// - adminCreateLeads: admin-only; bulk-inserts leads (spreadsheet upload / manual).
// - adminAssignLeads: admin-only; (re)assigns leads to a consultant.
// - getAdminStats: admin-only; aggregated CRM metrics for the admin panel.
// - aiLeadAssist: assistant that summarizes the timeline and suggests next steps.

import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

async function assertAdmin(supabase: any, userId: string) {
  const { data, error } = await supabase.rpc("has_role", {
    _user_id: userId,
    _role: "admin",
  });
  if (error) throw new Error(error.message);
  if (!data) throw new Error("Acesso restrito a administradores.");
}

export type ProspectConsultant = { id: string; email: string };

export const getProspectConsultants = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<ProspectConsultant[]> => {
    const { supabase, userId } = context;
    await assertAdmin(supabase, userId);

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data, error } = await supabaseAdmin.auth.admin.listUsers({ page: 1, perPage: 1000 });
    if (error) throw new Error(error.message);
    return data.users.map((u) => ({ id: u.id, email: u.email ?? "(sem e-mail)" }));
  });

const leadInput = z.object({
  nome: z.string().trim().min(1).max(200),
  telefone: z.string().trim().max(40).optional().nullable(),
  telefones: z.array(z.string().trim().max(40)).max(20).optional().nullable(),
  cpf: z.string().trim().max(20).optional().nullable(),
  cidade: z.string().trim().max(120).optional().nullable(),
  origem: z.string().trim().max(60).optional().nullable(),
  orcamento: z.number().nonnegative().max(1_000_000_000_000).optional().nullable(),
  urgencia: z.enum(["alta", "media", "baixa"]).optional().nullable(),
  consultant_id: z.string().uuid().optional().nullable(),
});

export const adminCreateLeads = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) =>
    z
      .object({
        leads: z.array(leadInput).min(1).max(2000),
        dedup: z.boolean().optional(),
        update: z.boolean().optional(),
        batch: z.string().trim().max(160).optional().nullable(),
      })
      .parse(data),
  )
  .handler(async ({ context, data }): Promise<{ inserted: number; skipped: number; updated: number }> => {
    const { supabase, userId } = context;
    await assertAdmin(supabase, userId);

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const batchLabel = (data.batch && data.batch.trim()) || `Importação ${new Date().toISOString().slice(0, 16).replace("T", " ")}`;
    const norm = (v?: string | null) => (v ? v.replace(/\D/g, "") : "");
    let rows = data.leads.map((l) => ({
      nome: l.nome,
      telefone: l.telefone || null,
      telefones: (l.telefones && l.telefones.length ? l.telefones : (l.telefone ? [l.telefone] : [])),
      cpf: l.cpf || null,
      cidade: l.cidade || null,
      origem: l.origem || "planilha",
      orcamento: l.orcamento ?? null,
      urgencia: l.urgencia || "media",
      consultant_id: l.consultant_id || null,
      created_by: userId,
      import_batch: batchLabel,
    }));

    let skipped = 0;
    let updated = 0;
    if (data.dedup) {
      // Dedup within the batch (by normalized CPF, then telefone)
      const seen = new Set<string>();
      rows = rows.filter((r) => {
        const key = norm(r.cpf) || norm(r.telefone);
        if (!key) return true;
        if (seen.has(key)) { skipped++; return false; }
        seen.add(key);
        return true;
      });

      // Find existing leads by CPF so we can update or skip them.
      const cpfs = rows.map((r) => r.cpf).filter(Boolean) as string[];
      const tels = rows.map((r) => r.telefone).filter(Boolean) as string[];
      const existingByCpf = new Map<string, any>();
      const existingTel = new Set<string>();
      if (cpfs.length) {
        const { data: ex } = await supabaseAdmin
          .from("prospect_leads")
          .select("id,cpf,telefone,cidade,orcamento")
          .in("cpf", cpfs);
        (ex ?? []).forEach((e: any) => { if (e.cpf) existingByCpf.set(norm(e.cpf), e); });
      }
      if (tels.length) {
        const { data: ex } = await supabaseAdmin.from("prospect_leads").select("telefone").in("telefone", tels);
        (ex ?? []).forEach((e: any) => e.telefone && existingTel.add(norm(e.telefone)));
      }

      const remaining: typeof rows = [];
      for (const r of rows) {
        const c = norm(r.cpf), t = norm(r.telefone);
        const existing = c ? existingByCpf.get(c) : undefined;
        if (existing) {
          if (data.update) {
            // Backfill empty fields on the existing lead.
            const patch: Record<string, unknown> = {};
            if (r.telefone && !existing.telefone) patch.telefone = r.telefone;
            if (r.cidade && !existing.cidade) patch.cidade = r.cidade;
            if (r.orcamento != null && existing.orcamento == null) patch.orcamento = r.orcamento;
            if (Object.keys(patch).length) {
              const { error } = await supabaseAdmin.from("prospect_leads").update(patch as any).eq("id", existing.id);
              if (error) throw new Error(error.message);
              updated++;
            } else {
              skipped++;
            }
          } else {
            skipped++;
          }
          continue;
        }
        if (t && existingTel.has(t)) { skipped++; continue; }
        remaining.push(r);
      }
      rows = remaining;
    }

    let inserted = 0;
    const chunkSize = 1000;
    for (let i = 0; i < rows.length; i += chunkSize) {
      const chunk = rows.slice(i, i + chunkSize);
      if (!chunk.length) continue;
      const { error, count } = await supabaseAdmin
        .from("prospect_leads")
        .insert(chunk as any, { count: "exact" });
      if (error) throw new Error(error.message);
      inserted += count ?? chunk.length;
    }
    return { inserted, skipped, updated };
  });


export const adminAssignLeads = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) =>
    z
      .object({
        leadIds: z.array(z.string().uuid()).min(1).max(5000),
        consultantId: z.string().uuid().nullable(),
      })
      .parse(data),
  )
  .handler(async ({ context, data }): Promise<{ ok: true }> => {
    const { supabase, userId } = context;
    await assertAdmin(supabase, userId);

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin
      .from("prospect_leads")
      .update({ consultant_id: data.consultantId } as any)
      .in("id", data.leadIds);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// Refill the signed-in consultant's queue with fresh leads from the pool.
// A lead is "prospected" once it has been responded to or moved past "novo";
// those leave the active queue. We then claim untouched, unassigned leads
// (consultant_id IS NULL, status 'novo') until the queue reaches the target.
export const refillMyQueue = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) =>
    z.object({ target: z.number().int().min(1).max(100).optional() }).parse(data ?? {}),
  )
  .handler(async ({ context, data }): Promise<{ claimed: number; active: number }> => {
    const { userId } = context;
    const target = data.target ?? 15;

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    // How many fresh (un-prospected) leads does the consultant already hold?
    const { count: activeCount } = await supabaseAdmin
      .from("prospect_leads")
      .select("id", { count: "exact", head: true })
      .eq("consultant_id", userId)
      .eq("status", "novo")
      .is("first_response_at", null)
      .is("opened_at", null);

    const have = activeCount ?? 0;
    const need = Math.max(0, target - have);
    if (need === 0) return { claimed: 0, active: have };

    // Pull candidate unassigned leads from the pool, prioritising by score.
    const { data: pool, error: poolErr } = await supabaseAdmin
      .from("prospect_leads")
      .select("id")
      .is("consultant_id", null)
      .eq("status", "novo")
      .is("first_response_at", null)
      .is("opened_at", null)
      .order("score", { ascending: false })
      .limit(need * 3);
    if (poolErr) throw new Error(poolErr.message);
    if (!pool?.length) return { claimed: 0, active: have };

    // Claim leads one chunk at a time, guarding against concurrent claims by
    // only updating rows that are still unassigned.
    const candidateIds = pool.map((r: any) => r.id).slice(0, need);
    const { data: claimedRows, error: claimErr } = await supabaseAdmin
      .from("prospect_leads")
      .update({ consultant_id: userId } as any)
      .in("id", candidateIds)
      .is("consultant_id", null)
      .select("id");
    if (claimErr) throw new Error(claimErr.message);

    const claimed = claimedRows?.length ?? 0;
    return { claimed, active: have + claimed };
  });

// Mark a lead as opened by the signed-in consultant. The first time a lead is
// opened it gets stamped with opened_at, which removes it from the active queue
// (so it can be replaced by a fresh lead) and surfaces it in "Recentes".
// We then top the consultant's queue back up so a new lead appears immediately.
export const markLeadOpened = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => z.object({ leadId: z.string().uuid() }).parse(data))
  .handler(async ({ context, data }): Promise<{ opened: boolean; claimed: number }> => {
    const { userId } = context;
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    // Stamp opened_at only if it's still null, and only for a lead this
    // consultant owns (or an unassigned one, which we also claim on open).
    const { data: updated, error } = await supabaseAdmin
      .from("prospect_leads")
      .update({ opened_at: new Date().toISOString(), consultant_id: userId } as any)
      .eq("id", data.leadId)
      .is("opened_at", null)
      .select("id");
    if (error) throw new Error(error.message);

    const opened = (updated?.length ?? 0) > 0;
    if (!opened) return { opened: false, claimed: 0 };

    // Top the queue back up so a fresh lead replaces the one just opened.
    const target = 15;
    const { count: activeCount } = await supabaseAdmin
      .from("prospect_leads")
      .select("id", { count: "exact", head: true })
      .eq("consultant_id", userId)
      .eq("status", "novo")
      .is("first_response_at", null)
      .is("opened_at", null);
    const need = Math.max(0, target - (activeCount ?? 0));
    if (need === 0) return { opened: true, claimed: 0 };

    const { data: pool } = await supabaseAdmin
      .from("prospect_leads")
      .select("id")
      .is("consultant_id", null)
      .eq("status", "novo")
      .is("first_response_at", null)
      .is("opened_at", null)
      .order("score", { ascending: false })
      .limit(need * 3);
    if (!pool?.length) return { opened: true, claimed: 0 };

    const candidateIds = pool.map((r: any) => r.id).slice(0, need);
    const { data: claimedRows } = await supabaseAdmin
      .from("prospect_leads")
      .update({ consultant_id: userId } as any)
      .in("id", candidateIds)
      .is("consultant_id", null)
      .select("id");

    return { opened: true, claimed: claimedRows?.length ?? 0 };
  });

// Helper: apply leadId -> consultantId assignments in chunked updates.
async function applyAssignments(
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

// Distribute UNASSIGNED open leads across consultants. Each lead goes to exactly one.
export const adminDistributeLeads = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) =>
    z
      .object({
        consultantIds: z.array(z.string().uuid()).min(1).max(100),
        mode: z.enum(["round_robin", "score", "city"]),
      })
      .parse(data),
  )
  .handler(async ({ context, data }): Promise<{ assigned: number; perConsultant: Record<string, number> }> => {
    const { supabase, userId } = context;
    await assertAdmin(supabase, userId);

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: leads, error } = await supabaseAdmin
      .from("prospect_leads")
      .select("id,cidade,score")
      .is("consultant_id", null)
      .not("status", "in", "(ganho,perdido)");
    if (error) throw new Error(error.message);
    if (!leads?.length) return { assigned: 0, perConsultant: {} };

    const ids = data.consultantIds;
    const assignment = new Map<string, string>();

    if (data.mode === "city") {
      const cityMap = new Map<string, any[]>();
      for (const l of leads) {
        const c = (l.cidade || "—").toLowerCase().trim();
        if (!cityMap.has(c)) cityMap.set(c, []);
        cityMap.get(c)!.push(l);
      }
      const cities = [...cityMap.entries()].sort((a, b) => b[1].length - a[1].length);
      let ci = 0;
      for (const [, arr] of cities) {
        const cons = ids[ci % ids.length];
        ci++;
        for (const l of arr) assignment.set(l.id, cons);
      }
    } else {
      const ordered = [...leads];
      if (data.mode === "score") ordered.sort((a, b) => (b.score ?? 0) - (a.score ?? 0));
      ordered.forEach((l, i) => assignment.set(l.id, ids[i % ids.length]));
    }

    const perConsultant = await applyAssignments(supabaseAdmin, assignment);
    return { assigned: assignment.size, perConsultant };
  });

// Recycle stale leads (assigned but neglected) to the least-loaded consultants.
export const adminRecycleLeads = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) =>
    z
      .object({
        consultantIds: z.array(z.string().uuid()).min(1).max(100),
        idleDays: z.number().min(1).max(60),
        mode: z.enum(["round_robin", "score"]).optional(),
      })
      .parse(data),
  )
  .handler(async ({ context, data }): Promise<{ recycled: number; perConsultant: Record<string, number> }> => {
    const { supabase, userId } = context;
    await assertAdmin(supabase, userId);

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const cutoff = new Date(Date.now() - data.idleDays * 86400000).toISOString();

    // Open leads, assigned to someone, created before cutoff and never (or long) contacted.
    const { data: rows, error } = await supabaseAdmin
      .from("prospect_leads")
      .select("id,score,consultant_id,last_contact_at,created_at")
      .not("status", "in", "(ganho,perdido)")
      .not("consultant_id", "is", null)
      .lt("created_at", cutoff);
    if (error) throw new Error(error.message);
    const stale = (rows ?? []).filter(
      (r: any) => !r.last_contact_at || r.last_contact_at < cutoff,
    );
    if (!stale.length) return { recycled: 0, perConsultant: {} };

    // Current open-lead load per candidate consultant.
    const { data: loadRows } = await supabaseAdmin
      .from("prospect_leads")
      .select("consultant_id")
      .not("status", "in", "(ganho,perdido)")
      .in("consultant_id", data.consultantIds);
    const load: Record<string, number> = {};
    data.consultantIds.forEach((id) => (load[id] = 0));
    (loadRows ?? []).forEach((r: any) => {
      if (r.consultant_id in load) load[r.consultant_id]++;
    });

    const ordered = [...stale];
    if (data.mode === "score") ordered.sort((a, b) => (b.score ?? 0) - (a.score ?? 0));

    const assignment = new Map<string, string>();
    for (const l of ordered) {
      let cands = data.consultantIds.filter((id) => id !== l.consultant_id);
      if (!cands.length) cands = [...data.consultantIds];
      cands.sort((a, b) => load[a] - load[b]);
      const pick = cands[0];
      // Skip if the only candidate is the current owner (nothing to recycle).
      if (pick === l.consultant_id) continue;
      assignment.set(l.id, pick);
      load[pick]++;
    }
    if (!assignment.size) return { recycled: 0, perConsultant: {} };

    const perConsultant = await applyAssignments(supabaseAdmin, assignment);
    return { recycled: assignment.size, perConsultant };
  });

export type AdminStats = {
  totalLeads: number;
  semTratativa: number;
  esquecidos: number;
  ranking: { consultantId: string | null; email: string; total: number; ganhos: number; conversao: number }[];
  porStatus: Record<string, number>;
  porOrigem: { origem: string; total: number; ganhos: number; conversao: number }[];
};

export const getAdminStats = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<AdminStats> => {
    const { supabase, userId } = context;
    await assertAdmin(supabase, userId);

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: leads, error } = await supabaseAdmin
      .from("prospect_leads")
      .select("id, consultant_id, status, origem, first_response_at, last_contact_at, created_at");
    if (error) throw new Error(error.message);

    const { data: usersData } = await supabaseAdmin.auth.admin.listUsers({ page: 1, perPage: 1000 });
    const emailById = new Map<string, string>();
    for (const u of usersData?.users ?? []) emailById.set(u.id, u.email ?? "(sem e-mail)");

    const now = Date.now();
    const threeDays = 3 * 86400_000;
    const all = (leads ?? []) as any[];

    const semTratativa = all.filter((l) => !l.first_response_at && l.status === "novo").length;
    const esquecidos = all.filter(
      (l) => !["ganho", "perdido"].includes(l.status) &&
        now - new Date(l.last_contact_at ?? l.created_at).getTime() >= threeDays,
    ).length;

    const byConsultant = new Map<string, { total: number; ganhos: number }>();
    const byOrigem = new Map<string, { total: number; ganhos: number }>();
    const porStatus: Record<string, number> = {};
    for (const l of all) {
      porStatus[l.status] = (porStatus[l.status] ?? 0) + 1;
      const ck = l.consultant_id ?? "__none__";
      const c = byConsultant.get(ck) ?? { total: 0, ganhos: 0 };
      c.total++; if (l.status === "ganho") c.ganhos++;
      byConsultant.set(ck, c);
      const ok = (l.origem ?? "—") as string;
      const o = byOrigem.get(ok) ?? { total: 0, ganhos: 0 };
      o.total++; if (l.status === "ganho") o.ganhos++;
      byOrigem.set(ok, o);
    }

    const ranking = [...byConsultant.entries()]
      .map(([cid, v]) => ({
        consultantId: cid === "__none__" ? null : cid,
        email: cid === "__none__" ? "Não atribuído" : emailById.get(cid) ?? cid,
        total: v.total,
        ganhos: v.ganhos,
        conversao: v.total ? Math.round((v.ganhos / v.total) * 100) : 0,
      }))
      .sort((a, b) => b.ganhos - a.ganhos || b.total - a.total);

    const porOrigem = [...byOrigem.entries()]
      .map(([origem, v]) => ({
        origem,
        total: v.total,
        ganhos: v.ganhos,
        conversao: v.total ? Math.round((v.ganhos / v.total) * 100) : 0,
      }))
      .sort((a, b) => b.conversao - a.conversao);

    return {
      totalLeads: all.length,
      semTratativa,
      esquecidos,
      ranking,
      porStatus,
      porOrigem,
    };
  });

export const aiLeadAssist = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => z.object({ leadId: z.string().uuid() }).parse(data))
  .handler(async ({ context, data }): Promise<{ text: string }> => {
    const { supabase } = context;

    const { data: lead, error: leadErr } = await supabase
      .from("prospect_leads")
      .select("nome, cidade, origem, orcamento, urgencia, status, score, sla_status, loss_reason, notes")
      .eq("id", data.leadId)
      .single();
    if (leadErr) throw new Error(leadErr.message);

    const { data: events } = await supabase
      .from("lead_events")
      .select("kind, body, created_at")
      .eq("lead_id", data.leadId)
      .order("created_at", { ascending: true })
      .limit(40);

    const apiKey = process.env.LOVABLE_API_KEY;
    if (!apiKey) throw new Error("Assistente de IA indisponível (chave ausente).");

    const timeline = (events ?? [])
      .map((e: any) => `- [${e.kind}] ${new Date(e.created_at).toLocaleString("pt-BR")}: ${e.body ?? ""}`)
      .join("\n");

    const prompt = `Você é um assistente de vendas (consignado). Analise o lead e o histórico e responda em português do Brasil, de forma objetiva e em markdown, com estas seções:
**Resumo do histórico** · **Possíveis objeções** · **Próxima ação recomendada** · **Sugestão de mensagem (WhatsApp)**.

Dados do lead:
Nome: ${lead.nome}
Cidade: ${lead.cidade ?? "-"}
Origem: ${lead.origem ?? "-"}
Orçamento: ${lead.orcamento ?? "-"}
Urgência: ${lead.urgencia ?? "-"}
Status atual: ${lead.status}
Score: ${lead.score}
SLA: ${lead.sla_status}
Notas: ${lead.notes ?? "-"}

Timeline:
${timeline || "(sem interações registradas)"}`;

    const resp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [{ role: "user", content: prompt }],
      }),
    });
    if (resp.status === 429) throw new Error("Limite de uso da IA atingido. Tente novamente em instantes.");
    if (resp.status === 402) throw new Error("Créditos de IA esgotados. Adicione créditos no workspace.");
    if (!resp.ok) throw new Error(`Falha na IA (${resp.status}).`);
    const json = await resp.json();
    const text = json?.choices?.[0]?.message?.content ?? "Sem resposta da IA.";
    return { text };
  });

export type ImportBatch = {
  batch: string | null;
  label: string;
  total: number;
  assigned: number;
  unassigned: number;
  worked: number;
  first_at: string;
  last_at: string;
};

// List imported spreadsheets grouped by import_batch (admin-only).
export const adminListImportBatches = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<ImportBatch[]> => {
    const { supabase, userId } = context;
    await assertAdmin(supabase, userId);

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const groups = new Map<string, ImportBatch>();
    const pageSize = 1000;
    for (let from = 0; ; from += pageSize) {
      const { data, error } = await supabaseAdmin
        .from("prospect_leads")
        .select("import_batch,consultant_id,status,created_at")
        .range(from, from + pageSize - 1);
      if (error) throw new Error(error.message);
      if (!data || data.length === 0) break;
      for (const r of data as any[]) {
        const key = r.import_batch ?? "__none__";
        let g = groups.get(key);
        if (!g) {
          g = {
            batch: r.import_batch ?? null,
            label: r.import_batch ?? "Importação inicial (sem rótulo)",
            total: 0, assigned: 0, unassigned: 0, worked: 0,
            first_at: r.created_at, last_at: r.created_at,
          };
          groups.set(key, g);
        }
        g.total++;
        if (r.consultant_id) g.assigned++; else g.unassigned++;
        if (r.status && r.status !== "novo") g.worked++;
        if (r.created_at < g.first_at) g.first_at = r.created_at;
        if (r.created_at > g.last_at) g.last_at = r.created_at;
      }
      if (data.length < pageSize) break;
    }
    return Array.from(groups.values()).sort((a, b) => (a.last_at < b.last_at ? 1 : -1));
  });

// Delete every lead from a given imported spreadsheet (admin-only).
export const adminDeleteImportBatch = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) =>
    z.object({ batch: z.string().max(160).nullable() }).parse(data),
  )
  .handler(async ({ context, data }): Promise<{ deleted: number }> => {
    const { supabase, userId } = context;
    await assertAdmin(supabase, userId);

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const base = () => supabaseAdmin.from("prospect_leads").delete({ count: "exact" });
    const q = data.batch === null ? base().is("import_batch", null) : base().eq("import_batch", data.batch);
    const { error, count } = await q;
    if (error) throw new Error(error.message);
    return { deleted: count ?? 0 };
  });

// ===================== System access management (admin-only) =====================

export type SystemUser = {
  id: string;
  email: string;
  isAdmin: boolean;
  leadCount: number;
  created_at: string | null;
  last_sign_in_at: string | null;
};

// List every user account with role + lead-load info.
export const adminListSystemUsers = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<SystemUser[]> => {
    const { supabase, userId } = context;
    await assertAdmin(supabase, userId);

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: usersData, error } = await supabaseAdmin.auth.admin.listUsers({ page: 1, perPage: 1000 });
    if (error) throw new Error(error.message);

    const { data: roles } = await supabaseAdmin.from("user_roles").select("user_id, role");
    const adminSet = new Set((roles ?? []).filter((r: any) => r.role === "admin").map((r: any) => r.user_id));

    const { data: leadRows } = await supabaseAdmin.from("prospect_leads").select("consultant_id");
    const leadCount = new Map<string, number>();
    for (const r of (leadRows ?? []) as any[]) {
      if (r.consultant_id) leadCount.set(r.consultant_id, (leadCount.get(r.consultant_id) ?? 0) + 1);
    }

    return usersData.users
      .map((u) => ({
        id: u.id,
        email: u.email ?? "(sem e-mail)",
        isAdmin: adminSet.has(u.id),
        leadCount: leadCount.get(u.id) ?? 0,
        created_at: u.created_at ?? null,
        last_sign_in_at: u.last_sign_in_at ?? null,
      }))
      .sort((a, b) => Number(b.isAdmin) - Number(a.isAdmin) || a.email.localeCompare(b.email));
  });

// Grant or revoke the admin role for a user.
export const adminSetUserRole = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) =>
    z.object({ targetUserId: z.string().uuid(), makeAdmin: z.boolean() }).parse(data),
  )
  .handler(async ({ context, data }): Promise<{ ok: true }> => {
    const { supabase, userId } = context;
    await assertAdmin(supabase, userId);

    if (data.targetUserId === userId && !data.makeAdmin) {
      throw new Error("Você não pode remover o seu próprio acesso de administrador.");
    }

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    if (data.makeAdmin) {
      const { error } = await supabaseAdmin
        .from("user_roles")
        .upsert({ user_id: data.targetUserId, role: "admin" } as any, { onConflict: "user_id,role" });
      if (error) throw new Error(error.message);
    } else {
      const { error } = await supabaseAdmin
        .from("user_roles")
        .delete()
        .eq("user_id", data.targetUserId)
        .eq("role", "admin");
      if (error) throw new Error(error.message);
    }
    return { ok: true };
  });

// Delete a user account entirely (and unassign their leads).
export const adminDeleteSystemUser = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => z.object({ targetUserId: z.string().uuid() }).parse(data))
  .handler(async ({ context, data }): Promise<{ ok: true }> => {
    const { supabase, userId } = context;
    await assertAdmin(supabase, userId);

    if (data.targetUserId === userId) {
      throw new Error("Você não pode excluir o seu próprio usuário.");
    }

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    // Unassign this user's leads so they return to the pool.
    await supabaseAdmin
      .from("prospect_leads")
      .update({ consultant_id: null } as any)
      .eq("consultant_id", data.targetUserId);

    // Clean up roles.
    await supabaseAdmin.from("user_roles").delete().eq("user_id", data.targetUserId);

    const { error } = await supabaseAdmin.auth.admin.deleteUser(data.targetUserId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
