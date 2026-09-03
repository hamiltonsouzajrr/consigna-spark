// Métricas de qualidade operacional: abordagem, conversão e follow-up (admin).
import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export type QualidadeConsultora = {
  nome: string;
  leads: number;
  abordados: number;
  taxaAbordagem: number;
  contatos: number;
  qualificados: number;
  ganhos: number;
  taxaConversao: number;
  followupsAbertos: number;
  followupsAtrasados: number;
  followupsConcluidos: number;
  taxaFollowup: number;
};

export type QualidadeOperacional = {
  periodoDias: number;
  abordagem: {
    leadsTotais: number;
    abordados: number;
    pendentes: number;
    taxa: number;
    contatos: number;
    ligacoes: number;
    whatsapp: number;
  };
  conversao: {
    leadsAtivos: number;
    qualificados: number;
    ganhos: number;
    perdidos: number;
    taxaQualificacao: number;
    taxaGanho: number;
  };
  followup: {
    abertos: number;
    atrasados: number;
    concluidos: number;
    taxaConclusao: number;
    taxaAtraso: number;
  };
  porConsultora: QualidadeConsultora[];
  atualizadoEm: string;
};

const pct = (parte: number, total: number) =>
  total > 0 ? Math.round((parte / total) * 100) : 0;

export const getQualidadeOperacional = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<QualidadeOperacional> => {
    const { supabase, userId } = context as any;
    const { assertAdmin } = await import("./prospeccao.server");
    await assertAdmin(supabase, userId);

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const db: any = supabaseAdmin;

    const periodoDias = 30;
    const agora = new Date();
    const desde = new Date(agora);
    desde.setDate(desde.getDate() - periodoDias);
    const desdeIso = desde.toISOString();

    const [registros, eventos, leads, tarefas, funcionarios] = await Promise.all([
      db
        .from("do_registros")
        .select("consultora_responsavel, status_abordagem")
        .limit(50000),
      db
        .from("lead_events")
        .select("consultant_id, kind, created_at")
        .gte("created_at", desdeIso)
        .limit(50000),
      db
        .from("prospect_leads")
        .select("consultant_id, status, updated_at")
        .limit(50000),
      db
        .from("lead_tasks")
        .select("consultant_id, status, due_at")
        .limit(50000),
      db.from("rh_employees").select("full_name, user_id").limit(500),
    ]);

    const nomePorUser = new Map<string, string>();
    for (const e of funcionarios.data ?? []) {
      if (e.user_id && e.full_name) nomePorUser.set(e.user_id, e.full_name);
    }

    const linhas = new Map<string, QualidadeConsultora>();
    const linha = (nome: string) => {
      const chave = nome.trim() || "Sem responsável";
      let atual = linhas.get(chave);
      if (!atual) {
        atual = {
          nome: chave,
          leads: 0,
          abordados: 0,
          taxaAbordagem: 0,
          contatos: 0,
          qualificados: 0,
          ganhos: 0,
          taxaConversao: 0,
          followupsAbertos: 0,
          followupsAtrasados: 0,
          followupsConcluidos: 0,
          taxaFollowup: 0,
        };
        linhas.set(chave, atual);
      }
      return atual;
    };

    // --- Abordagem (leads distribuídos do Diário Oficial) ---
    let leadsTotais = 0;
    let abordados = 0;
    for (const r of registros.data ?? []) {
      leadsTotais += 1;
      const feito = r.status_abordagem && r.status_abordagem !== "pendente";
      if (feito) abordados += 1;
      const l = linha(r.consultora_responsavel ?? "");
      l.leads += 1;
      if (feito) l.abordados += 1;
    }

    // --- Contatos registrados no período ---
    let ligacoes = 0;
    let whatsapp = 0;
    for (const ev of eventos.data ?? []) {
      if (ev.kind !== "ligacao" && ev.kind !== "whatsapp") continue;
      if (ev.kind === "ligacao") ligacoes += 1;
      else whatsapp += 1;
      const nome = nomePorUser.get(ev.consultant_id ?? "");
      if (nome) linha(nome).contatos += 1;
    }

    // --- Conversão ---
    let qualificados = 0;
    let ganhos = 0;
    let perdidos = 0;
    let leadsAtivos = 0;
    for (const l of leads.data ?? []) {
      leadsAtivos += 1;
      if (l.status === "qualificado" || l.status === "proposta") qualificados += 1;
      if (l.status === "ganho") ganhos += 1;
      if (l.status === "perdido") perdidos += 1;
      const nome = nomePorUser.get(l.consultant_id ?? "");
      if (nome) {
        const row = linha(nome);
        if (l.status === "qualificado" || l.status === "proposta") row.qualificados += 1;
        if (l.status === "ganho") row.ganhos += 1;
      }
    }

    // --- Follow-up ---
    let abertos = 0;
    let atrasados = 0;
    let concluidos = 0;
    const agoraIso = agora.toISOString();
    for (const t of tarefas.data ?? []) {
      const nome = nomePorUser.get(t.consultant_id ?? "");
      const row = nome ? linha(nome) : null;
      if (t.status === "done") {
        concluidos += 1;
        if (row) row.followupsConcluidos += 1;
      } else if (t.status === "pending") {
        abertos += 1;
        if (row) row.followupsAbertos += 1;
        if (t.due_at && t.due_at < agoraIso) {
          atrasados += 1;
          if (row) row.followupsAtrasados += 1;
        }
      }
    }

    const porConsultora = [...linhas.values()]
      .map((r) => ({
        ...r,
        taxaAbordagem: pct(r.abordados, r.leads),
        taxaConversao: pct(r.ganhos, r.leads || r.contatos),
        taxaFollowup: pct(
          r.followupsConcluidos,
          r.followupsConcluidos + r.followupsAbertos,
        ),
      }))
      .filter((r) => r.leads > 0 || r.contatos > 0 || r.followupsAbertos > 0)
      .sort((a, b) => b.abordados - a.abordados || b.leads - a.leads)
      .slice(0, 30);

    return {
      periodoDias,
      abordagem: {
        leadsTotais,
        abordados,
        pendentes: leadsTotais - abordados,
        taxa: pct(abordados, leadsTotais),
        contatos: ligacoes + whatsapp,
        ligacoes,
        whatsapp,
      },
      conversao: {
        leadsAtivos,
        qualificados,
        ganhos,
        perdidos,
        taxaQualificacao: pct(qualificados, leadsAtivos),
        taxaGanho: pct(ganhos, leadsAtivos),
      },
      followup: {
        abertos,
        atrasados,
        concluidos,
        taxaConclusao: pct(concluidos, concluidos + abertos),
        taxaAtraso: pct(atrasados, abertos),
      },
      porConsultora,
      atualizadoEm: agora.toISOString(),
    };
  });
