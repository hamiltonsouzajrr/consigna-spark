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
  cpf: z.string().trim().max(20).optional().nullable(),
  cidade: z.string().trim().max(120).optional().nullable(),
  origem: z.string().trim().max(60).optional().nullable(),
  orcamento: z.number().nonnegative().max(1_000_000_000).optional().nullable(),
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
      })
      .parse(data),
  )
  .handler(async ({ context, data }): Promise<{ inserted: number; skipped: number }> => {
    const { supabase, userId } = context;
    await assertAdmin(supabase, userId);

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const norm = (v?: string | null) => (v ? v.replace(/\D/g, "") : "");
    let rows = data.leads.map((l) => ({
      nome: l.nome,
      telefone: l.telefone || null,
      cpf: l.cpf || null,
      cidade: l.cidade || null,
      origem: l.origem || "planilha",
      orcamento: l.orcamento ?? null,
      urgencia: l.urgencia || "media",
      consultant_id: l.consultant_id || null,
      created_by: userId,
    }));

    let skipped = 0;
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

      // Dedup against existing leads in the database
      const cpfs = rows.map((r) => r.cpf).filter(Boolean) as string[];
      const tels = rows.map((r) => r.telefone).filter(Boolean) as string[];
      const existingCpf = new Set<string>();
      const existingTel = new Set<string>();
      if (cpfs.length) {
        const { data: ex } = await supabaseAdmin.from("prospect_leads").select("cpf").in("cpf", cpfs);
        (ex ?? []).forEach((e: any) => e.cpf && existingCpf.add(norm(e.cpf)));
      }
      if (tels.length) {
        const { data: ex } = await supabaseAdmin.from("prospect_leads").select("telefone").in("telefone", tels);
        (ex ?? []).forEach((e: any) => e.telefone && existingTel.add(norm(e.telefone)));
      }
      rows = rows.filter((r) => {
        const c = norm(r.cpf), t = norm(r.telefone);
        if ((c && existingCpf.has(c)) || (t && existingTel.has(t))) { skipped++; return false; }
        return true;
      });
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
    return { inserted, skipped };
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
