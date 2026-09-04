// Server functions for the weekly prospecting competition.
// These are the ONLY write path for lead_events / lead_tasks so that points
// always come with real, verifiable work behind them.
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { RankingRow } from "./competicao.server";

export type CompeticaoData = {
  week_start: string;
  closes_at: string;
  revelado: boolean;
  premio_titulo: string | null;
  premio_descricao: string | null;
  vencedor_user_id: string | null;
  ranking: RankingRow[];
  minha_posicao: number | null;
  minha_linha: RankingRow | null;
  faltam_para_subir: number | null;
  sou_admin: boolean;
  pausada: boolean;
  pausada_em: string | null;
};

export const getCompeticao = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<CompeticaoData> => {
    const { userId } = context;
    const { garantirSemana, ranking, isAdminUser, adminClient } = await import("./competicao.server");
    const semana = await garantirSemana();
    const rows = await ranking(semana.week_start);
    const db = await adminClient();
    const souAdmin = await isAdminUser(db, userId);

    const idx = rows.findIndex((r) => r.user_id === userId);
    const acima = idx > 0 ? rows[idx - 1] : null;
    const minha = idx >= 0 ? rows[idx]! : null;

    return {
      week_start: semana.week_start,
      closes_at: semana.closes_at,
      revelado: Boolean(semana.revelado),
      // O prêmio é misterioso até o fechamento (admin sempre vê).
      premio_titulo: semana.revelado || souAdmin ? semana.premio_titulo ?? null : null,
      premio_descricao: semana.revelado || souAdmin ? semana.premio_descricao ?? null : null,
      vencedor_user_id: semana.vencedor_user_id ?? null,
      ranking: rows,
      minha_posicao: idx >= 0 ? idx + 1 : null,
      minha_linha: minha,
      faltam_para_subir: acima && minha ? Math.max(1, acima.total - minha.total + 1) : null,
      sou_admin: souAdmin,
      pausada: Boolean(semana.pausada),
      pausada_em: semana.pausada_em ?? null,
    };
  });

/** Registers a real contact (call / whatsapp) and scores it when it has lastro. */
export const registrarContato = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) =>
    z
      .object({
        leadId: z.string().uuid(),
        kind: z.enum(["ligacao", "whatsapp", "nota"]),
        body: z.string().trim().max(2000).optional().default(""),
      })
      .parse(data),
  )
  .handler(async ({ context, data }): Promise<{ pontos: number; motivo?: string }> => {
    const { userId } = context;
    const { adminClient, creditar, cooldownLiberado, garantirSemana } = await import("./competicao.server");
    const db = await adminClient();

    const { data: lead } = await db
      .from("prospect_leads")
      .select("id,telefone,telefones,first_response_at")
      .eq("id", data.leadId)
      .maybeSingle();
    if (!lead) throw new Error("Lead não encontrado.");

    const { error } = await db.from("lead_events").insert({
      lead_id: data.leadId,
      consultant_id: userId,
      kind: data.kind,
      body: data.body || null,
    } as any);
    if (error) throw new Error(error.message);

    const nowIso = new Date().toISOString();
    const patch: any = { last_contact_at: nowIso };
    if (!lead.first_response_at) patch.first_response_at = nowIso;
    if (data.kind === "whatsapp") patch.respondeu_whatsapp = true;
    await db.from("prospect_leads").update(patch).eq("id", data.leadId);

    // Verifica se a competição está pausada
    const semana = await garantirSemana();
    if (semana.pausada) return { pontos: 0, motivo: "Competição pausada pelo administrador." };

    // Pontuação: só contatos reais, com telefone, fora do cooldown.
    if (data.kind === "nota") return { pontos: 0, motivo: "Anotação não pontua." };
    const temTelefone = Boolean(lead.telefone) || (lead.telefones?.length ?? 0) > 0;
    if (!temTelefone) return { pontos: 0, motivo: "Lead sem telefone não pontua." };
    if (!(await cooldownLiberado(userId))) {
      return { pontos: 0, motivo: "Contatos em sequência rápida não pontuam (intervalo mínimo de 90s)." };
    }
    const pontos = await creditar(userId, "contato", "prospect_leads", data.leadId, `Contato ${data.kind}`);
    return { pontos };
  });

/** Tags the lead (situação) — the qualification point needs a prior contact. */
export const registrarQualificacao = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) =>
    z
      .object({
        leadId: z.string().uuid(),
        situacao: z.string().trim().min(1).max(120).optional(),
        status: z.enum(["novo", "qualificado", "proposta", "ganho", "perdido"]).optional(),
        lossReason: z.string().trim().max(300).optional(),
      })
      .parse(data),
  )
  .handler(async ({ context, data }): Promise<{ pontos: number; motivo?: string }> => {
    const { userId } = context;
    const { adminClient, estornar, garantirSemana } = await import("./competicao.server");
    const db = await adminClient();


    const { data: lead } = await db
      .from("prospect_leads")
      .select("id,telefone,telefones,situacao,status,orcamento,created_at")
      .eq("id", data.leadId)
      .maybeSingle();
    if (!lead) throw new Error("Lead não encontrado.");

    const patch: any = {};
    if (data.situacao) patch.situacao = data.situacao;
    if (data.status) patch.status = data.status;
    if (data.status === "perdido") patch.loss_reason = data.lossReason ?? null;
    if (Object.keys(patch).length) {
      const { error } = await db.from("prospect_leads").update(patch).eq("id", data.leadId);
      if (error) throw new Error(error.message);
    }
    if (data.status) {
      await db.from("lead_events").insert({
        lead_id: data.leadId,
        consultant_id: userId,
        kind: "status",
        body: `Status → ${data.status}${data.lossReason ? ` (motivo: ${data.lossReason})` : ""}`,
      } as any);
    }

    // Voltar para "novo" desfaz a qualificação: estorna.
    if (data.status === "novo") {
      await estornar("prospect_leads", data.leadId, ["qualificacao", "ganho"], "lead voltou para novo");
      const { cancelarVenda } = await import("./competicao.server");
      await cancelarVenda("prospect_leads", data.leadId, "lead voltou para novo");
      return { pontos: 0, motivo: "Pontos de qualificação estornados." };
    }

    // Lead perdido cancela a venda em stand-by (sem mexer na qualificação).
    if (data.status === "perdido") {
      const { cancelarVenda } = await import("./competicao.server");
      await cancelarVenda("prospect_leads", data.leadId, "lead marcado como perdido");
    }



    // Verifica se a competição está pausada
    const semana = await garantirSemana();
    if (semana.pausada) return { pontos: 0, motivo: "Competição pausada pelo administrador." };

    if (data.status === "ganho") {
      const { registrarVendaPendente } = await import("./competicao.server");
      const r = await registrarVendaPendente(userId, "crm", "prospect_leads", data.leadId, null, "Venda fechada (CRM)");
      return {
        pontos: 0,
        motivo: r.jaConfirmada
          ? "Venda já conferida pelo gerente."
          : "Venda registrada. Aguardando conferência do gerente (peça a verificação: os pontos só entram depois que ele confirmar sua venda).",
      };
    }

    const situacao = data.situacao ?? lead.situacao;
    const status = data.status ?? lead.status;
    const temTelefone = Boolean(lead.telefone) || (lead.telefones?.length ?? 0) > 0;
    const qualificado = ["qualificado", "proposta"].includes(String(status));
    if (!qualificado || !situacao || !temTelefone) {
      return { pontos: 0, motivo: "Qualificação pontua com telefone, situação e status qualificado." };
    }
    const contato = await primeiroContatoEm(data.leadId);
    if (!contato || Date.now() - contato.getTime() < QUALIFICACAO_MIN_APOS_CONTATO_MS) {
      return { pontos: 0, motivo: "Qualificação exige um contato registrado há pelo menos 5 minutos." };
    }
    const pontos = await creditar(userId, "qualificacao", "prospect_leads", data.leadId, `Qualificado: ${situacao}`);
    return { pontos };
  });

/** Schedules a follow-up. Scheduling never scores — only completion does. */
export const agendarFollowup = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) =>
    z
      .object({
        leadId: z.string().uuid(),
        title: z.string().trim().min(1).max(200),
        dueAt: z.string().min(8),
      })
      .parse(data),
  )
  .handler(async ({ context, data }): Promise<{ taskId: string }> => {
    const { userId } = context;
    const { adminClient } = await import("./competicao.server");
    const db = await adminClient();
    const dueIso = new Date(data.dueAt).toISOString();

    const { data: task, error } = await db
      .from("lead_tasks")
      .insert({
        lead_id: data.leadId,
        consultant_id: userId,
        title: data.title,
        due_at: dueIso,
        status: "pending",
      } as any)
      .select("id")
      .single();
    if (error) throw new Error(error.message);

    await db.from("prospect_leads").update({ next_follow_up_at: dueIso } as any).eq("id", data.leadId);
    await db.from("lead_events").insert({
      lead_id: data.leadId,
      consultant_id: userId,
      kind: "followup",
      body: `Follow-up agendado: ${data.title}`,
    } as any);
    return { taskId: task.id as string };
  });

/** Completes a follow-up. Scores only when the retorno really happened. */
export const concluirFollowup = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => z.object({ taskId: z.string().uuid() }).parse(data))
  .handler(async ({ context, data }): Promise<{ pontos: number; motivo?: string }> => {
    const { userId } = context;
    const { adminClient, creditar, contatoHoje, garantirSemana } = await import("./competicao.server");
    const db = await adminClient();

    const { data: task } = await db
      .from("lead_tasks")
      .select("id,lead_id,due_at,status")
      .eq("id", data.taskId)
      .maybeSingle();
    if (!task) throw new Error("Follow-up não encontrado.");

    await db.from("lead_tasks").update({ status: "done" } as any).eq("id", data.taskId);
    await db.from("lead_events").insert({
      lead_id: task.lead_id,
      consultant_id: userId,
      kind: "followup",
      body: "Follow-up concluído",
    } as any);

    // Verifica se a competição está pausada
    const semana = await garantirSemana();
    if (semana.pausada) return { pontos: 0, motivo: "Competição pausada pelo administrador." };

    const venceu = new Date(task.due_at).getTime() <= Date.now() + 60 * 60 * 1000;
    if (!venceu) return { pontos: 0, motivo: "Follow-up concluído antes da hora não pontua." };
    if (!(await contatoHoje(task.lead_id))) {
      return { pontos: 0, motivo: "Registre o contato do retorno para pontuar o follow-up." };
    }
    const pontos = await creditar(userId, "followup", "lead_tasks", data.taskId, "Follow-up cumprido");
    return { pontos };
  });

/** Reschedules a pending follow-up (never scores). */
export const reagendarFollowup = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) =>
    z.object({ taskId: z.string().uuid(), dueAt: z.string().min(8) }).parse(data),
  )
  .handler(async ({ context, data }): Promise<{ dueAt: string }> => {
    const { userId } = context;
    const { adminClient } = await import("./competicao.server");
    const db = await adminClient();

    const { data: task } = await db
      .from("lead_tasks")
      .select("id,lead_id,status")
      .eq("id", data.taskId)
      .maybeSingle();
    if (!task) throw new Error("Follow-up não encontrado.");
    if (task.status !== "pending") throw new Error("Este follow-up já foi encerrado.");

    const dueIso = new Date(data.dueAt).toISOString();
    const { error } = await db.from("lead_tasks").update({ due_at: dueIso } as any).eq("id", data.taskId);
    if (error) throw new Error(error.message);

    await db.from("prospect_leads").update({ next_follow_up_at: dueIso } as any).eq("id", task.lead_id);
    await db.from("lead_events").insert({
      lead_id: task.lead_id,
      consultant_id: userId,
      kind: "followup",
      body: `Follow-up reagendado para ${new Date(dueIso).toLocaleString("pt-BR")}`,
    } as any);
    return { dueAt: dueIso };
  });

/** Skips (cancels) a pending follow-up. Never scores. */
export const pularFollowup = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) =>
    z.object({ taskId: z.string().uuid(), motivo: z.string().trim().max(200).optional() }).parse(data),
  )
  .handler(async ({ context, data }): Promise<{ ok: true }> => {
    const { userId } = context;
    const { adminClient } = await import("./competicao.server");
    const db = await adminClient();

    const { data: task } = await db
      .from("lead_tasks")
      .select("id,lead_id,status")
      .eq("id", data.taskId)
      .maybeSingle();
    if (!task) throw new Error("Follow-up não encontrado.");

    const { error } = await db.from("lead_tasks").update({ status: "canceled" } as any).eq("id", data.taskId);
    if (error) throw new Error(error.message);

    await db.from("prospect_leads").update({ next_follow_up_at: null } as any).eq("id", task.lead_id);
    await db.from("lead_events").insert({
      lead_id: task.lead_id,
      consultant_id: userId,
      kind: "followup",
      body: `Follow-up pulado${data.motivo ? `: ${data.motivo}` : ""}`,
    } as any);
    return { ok: true };
  });



// ---------------------------------------------------------------- admin

export const adminDefinirPremio = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) =>
    z
      .object({
        weekStart: z.string().optional(),
        titulo: z.string().trim().min(1).max(200),
        descricao: z.string().trim().max(1000).optional().default(""),
      })
      .parse(data),
  )
  .handler(async ({ context, data }): Promise<{ ok: true }> => {
    const { supabase, userId } = context;
    const { assertAdmin } = await import("./prospeccao.server");
    await assertAdmin(supabase, userId);
    const { adminClient, garantirSemana } = await import("./competicao.server");
    const semana = await garantirSemana(data.weekStart);
    const db = await adminClient();
    const { error } = await db
      .from("prospect_competicao_semanas")
      .update({ premio_titulo: data.titulo, premio_descricao: data.descricao || null } as any)
      .eq("week_start", semana.week_start);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export type PontoExtrato = {
  id: string;
  user_id: string;
  nome: string;
  categoria: string;
  pontos: number;
  motivo: string | null;
  ref_id: string;
  ref_tabela: string;
  created_at: string;
  anulado_em: string | null;
};

export const adminExtratoPontos = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) =>
    z.object({ weekStart: z.string().optional(), userId: z.string().uuid().optional(), limit: z.number().min(1).max(500).optional() }).parse(data ?? {}),
  )
  .handler(async ({ context, data }): Promise<PontoExtrato[]> => {
    const { supabase, userId } = context;
    const { assertAdmin } = await import("./prospeccao.server");
    await assertAdmin(supabase, userId);
    const { adminClient, weekStart } = await import("./competicao.server");
    const db = await adminClient();
    let q = db
      .from("prospect_pontos")
      .select("id,user_id,categoria,pontos,motivo,ref_id,ref_tabela,created_at,anulado_em")
      .eq("week_start", data.weekStart ?? weekStart())
      .order("created_at", { ascending: false })
      .limit(data.limit ?? 200);
    if (data.userId) q = q.eq("user_id", data.userId);
    const { data: rows, error } = await q;
    if (error) throw new Error(error.message);

    const ids = [...new Set((rows ?? []).map((r: any) => r.user_id))];
    const nomes = new Map<string, string>();
    if (ids.length) {
      const { data: profs } = await db.from("profiles").select("user_id,nome_completo").in("user_id", ids);
      for (const p of profs ?? []) nomes.set(p.user_id, p.nome_completo);
    }
    return (rows ?? []).map((r: any) => ({ ...r, nome: nomes.get(r.user_id) ?? "Consultora" }));
  });

export const adminAnularPonto = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => z.object({ pontoId: z.string().uuid(), motivo: z.string().trim().max(300).optional() }).parse(data))
  .handler(async ({ context, data }): Promise<{ ok: true }> => {
    const { supabase, userId } = context;
    const { assertAdmin } = await import("./prospeccao.server");
    await assertAdmin(supabase, userId);
    const { adminClient } = await import("./competicao.server");
    const db = await adminClient();
    const { error } = await db
      .from("prospect_pontos")
      .update({
        anulado_em: new Date().toISOString(),
        anulado_por: userId,
        motivo: data.motivo ? `anulado: ${data.motivo}` : "anulado pelo admin",
      } as any)
      .eq("id", data.pontoId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const adminFecharSemana = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => z.object({ weekStart: z.string().optional(), force: z.boolean().optional() }).parse(data ?? {}))
  .handler(async ({ context, data }) => {
    const { supabase, userId } = context;
    const { assertAdmin } = await import("./prospeccao.server");
    await assertAdmin(supabase, userId);
    const { fecharSemana } = await import("./competicao-fechar.server");
    return fecharSemana(data.weekStart, data.force ?? true);
  });

/** Pausa a competição da semana atual. Enquanto pausada, nenhum ponto é creditado. */
export const adminPausarCompeticao = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => z.object({ weekStart: z.string().optional() }).parse(data ?? {}))
  .handler(async ({ context, data }): Promise<{ ok: true }> => {
    const { supabase, userId } = context;
    const { assertAdmin } = await import("./prospeccao.server");
    await assertAdmin(supabase, userId);
    const { adminClient, garantirSemana } = await import("./competicao.server");
    const semana = await garantirSemana(data.weekStart);
    const db = await adminClient();
    const { error } = await db
      .from("prospect_competicao_semanas")
      .update({ pausada: true, pausada_em: new Date().toISOString(), pausada_por: userId } as any)
      .eq("week_start", semana.week_start);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

/** Retoma a competição pausada. */
export const adminRetomarCompeticao = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => z.object({ weekStart: z.string().optional() }).parse(data ?? {}))
  .handler(async ({ context, data }): Promise<{ ok: true }> => {
    const { supabase, userId } = context;
    const { assertAdmin } = await import("./prospeccao.server");
    await assertAdmin(supabase, userId);
    const { adminClient, garantirSemana } = await import("./competicao.server");
    const semana = await garantirSemana(data.weekStart);
    const db = await adminClient();
    const { error } = await db
      .from("prospect_competicao_semanas")
      .update({ pausada: false, pausada_em: null, pausada_por: null } as any)
      .eq("week_start", semana.week_start);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

/** Exclui (deleta) a competição da semana atual — apaga a semana e todos os pontos associados. */
export const adminExcluirCompeticao = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => z.object({ weekStart: z.string().optional() }).parse(data ?? {}))
  .handler(async ({ context, data }): Promise<{ ok: true; pontosExcluidos: number }> => {
    const { supabase, userId } = context;
    const { assertAdmin } = await import("./prospeccao.server");
    await assertAdmin(supabase, userId);
    const { adminClient, garantirSemana } = await import("./competicao.server");
    const semana = await garantirSemana(data.weekStart);
    const db = await adminClient();

    // Primeiro exclui os pontos da semana
    const { count } = await db
      .from("prospect_pontos")
      .delete({ count: "exact" })
      .eq("week_start", semana.week_start);

    // Depois exclui o registro da semana
    const { error } = await db
      .from("prospect_competicao_semanas")
      .delete()
      .eq("week_start", semana.week_start);
    if (error) throw new Error(error.message);

    return { ok: true, pontosExcluidos: count ?? 0 };
  });

/** Last closed week the current user has not acknowledged yet (pop-up source). */
export const getFechamentoPendente = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { adminClient } = await import("./competicao.server");
    const db = await adminClient();
    const { data } = await db
      .from("prospect_competicao_semanas")
      .select("week_start,premio_titulo,premio_descricao,vencedor_user_id,placar_final,fechado_em")
      .eq("revelado", true)
      .order("week_start", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (!data) return null;
    return {
      week_start: data.week_start as string,
      premio_titulo: (data.premio_titulo as string) ?? null,
      premio_descricao: (data.premio_descricao as string) ?? null,
      vencedor_user_id: (data.vencedor_user_id as string) ?? null,
      podio: ((data.placar_final ?? []) as RankingRow[]).slice(0, 3),
      sou_vencedor: data.vencedor_user_id === context.userId,
    };
  });

export type AlertaSuspeito = {
  user_id: string;
  nome: string;
  severidade: "alta" | "media";
  tipo: string;
  detalhe: string;
};

/**
 * Automatic gaming detection for the current week. Pure read-only heuristics
 * over the raw ledger (prospect_pontos) crossed with active platform time
 * (app_uso_ativo) and the lead_events history.
 */
export const adminAlertasSuspeitos = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => z.object({ weekStart: z.string().optional() }).parse(data ?? {}))
  .handler(async ({ context, data }): Promise<AlertaSuspeito[]> => {
    const { supabase, userId } = context;
    const { assertAdmin } = await import("./prospeccao.server");
    await assertAdmin(supabase, userId);
    const { adminClient, weekStart } = await import("./competicao.server");
    const db = await adminClient();
    const ws = data.weekStart ?? weekStart();

    const { data: pontos } = await db
      .from("prospect_pontos")
      .select("user_id,categoria,pontos,created_at")
      .eq("week_start", ws)
      .is("anulado_em", null);

    const rows = (pontos ?? []) as Array<{ user_id: string; categoria: string; pontos: number; created_at: string }>;
    if (rows.length === 0) return [];

    const ids = [...new Set(rows.map((r) => r.user_id))];
    const nomes = new Map<string, string>();
    const { data: profs } = await db.from("profiles").select("user_id,nome_completo").in("user_id", ids);
    for (const p of profs ?? []) nomes.set(p.user_id, p.nome_completo);

    // Active platform time in the week (seconds), per consultant.
    const { data: uso } = await db
      .from("app_uso_ativo")
      .select("user_id,segundos,ref_date")
      .gte("ref_date", ws)
      .in("user_id", ids);
    const segundos = new Map<string, number>();
    for (const u of (uso ?? []) as Array<{ user_id: string; segundos: number }>) {
      segundos.set(u.user_id, (segundos.get(u.user_id) ?? 0) + Number(u.segundos ?? 0));
    }

    const alertas: AlertaSuspeito[] = [];

    for (const id of ids) {
      const meus = rows.filter((r) => r.user_id === id);
      const nome = nomes.get(id) ?? "Consultora";
      const total = meus.reduce((s, r) => s + Number(r.pontos ?? 0), 0);
      const contatos = meus.filter((r) => r.categoria === "contato").length;
      const quals = meus.filter((r) => r.categoria === "qualificacao").length;

      // 1. Bursts: more than 35 counted points inside any rolling hour.
      const times = meus.map((r) => new Date(r.created_at).getTime()).sort((a, b) => a - b);
      let pico = 0;
      let ini = 0;
      for (let i = 0; i < times.length; i++) {
        while (times[i]! - times[ini]! > 3_600_000) ini++;
        pico = Math.max(pico, i - ini + 1);
      }
      if (pico >= 35) {
        alertas.push({
          user_id: id,
          nome,
          severidade: pico >= 60 ? "alta" : "media",
          tipo: "Rajada de pontos",
          detalhe: `${pico} pontos contados dentro de uma única hora — ritmo acima do humanamente sustentável.`,
        });
      }

      // 2. Points without matching active time on the platform.
      const min = Math.round((segundos.get(id) ?? 0) / 60);
      if (total >= 100 && min < total / 4) {
        alertas.push({
          user_id: id,
          nome,
          severidade: min < total / 8 ? "alta" : "media",
          tipo: "Pontos sem tempo de uso",
          detalhe: `${total} pontos com apenas ${min} min de uso ativo na semana.`,
        });
      }

      // 3. Volume of contacts with nothing qualified — cliques sem conversa real.
      if (contatos >= 40 && quals === 0) {
        alertas.push({
          user_id: id,
          nome,
          severidade: "media",
          tipo: "Contatos sem qualificação",
          detalhe: `${contatos} contatos contados e nenhuma qualificação registrada.`,
        });
      }
    }

    const peso = { alta: 0, media: 1 } as const;
    return alertas.sort((a, b) => peso[a.severidade] - peso[b.severidade] || a.nome.localeCompare(b.nome));
  });

// ---------------------------------------------------------------------------
// Conferência de vendas fechadas (stand-by → confirmada / recusada)
// ---------------------------------------------------------------------------

export const adminVendas = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) =>
    z
      .object({
        status: z.enum(["pendente", "confirmada", "recusada"]).optional(),
        limit: z.number().min(1).max(300).optional(),
      })
      .parse(data ?? {}),
  )
  .handler(async ({ context, data }) => {
    const { supabase, userId } = context;
    const { assertAdmin } = await import("./prospeccao.server");
    await assertAdmin(supabase, userId);
    const { listarVendas } = await import("./competicao.server");
    return listarVendas(data.status, data.limit ?? 100);
  });

export const adminConfirmarVenda = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => z.object({ vendaId: z.string().uuid() }).parse(data))
  .handler(async ({ context, data }): Promise<{ pontos: number }> => {
    const { supabase, userId } = context;
    const { assertAdmin } = await import("./prospeccao.server");
    await assertAdmin(supabase, userId);
    const { confirmarVenda } = await import("./competicao.server");
    return confirmarVenda(data.vendaId, userId);
  });

export const adminRecusarVenda = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) =>
    z.object({ vendaId: z.string().uuid(), motivo: z.string().trim().min(1).max(300) }).parse(data),
  )
  .handler(async ({ context, data }): Promise<{ ok: true }> => {
    const { supabase, userId } = context;
    const { assertAdmin } = await import("./prospeccao.server");
    await assertAdmin(supabase, userId);
    const { recusarVenda } = await import("./competicao.server");
    await recusarVenda(data.vendaId, userId, data.motivo);
    return { ok: true };
  });

/** Vendas da própria consultora (para mostrar o stand-by no painel dela). */
export const minhasVendas = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase } = context;
    const { data, error } = await supabase
      .from("prospect_vendas")
      .select("id,status,cliente_nome,origem,pontos_creditados,motivo_recusa,created_at,revisado_em")
      .order("created_at", { ascending: false })
      .limit(30);
    if (error) throw new Error(error.message);
    return data ?? [];
  });
