// Dashboard por consultora: leads abordados, conversões, follow-ups e tempo ativo.
import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export type DashboardConsultoraLinha = {
  nome: string;
  email: string | null;
  leads: number;
  abordados: number;
  pendentes: number;
  taxaAbordagem: number;
  contatos: number;
  ligacoes: number;
  whatsapp: number;
  qualificados: number;
  ganhos: number;
  taxaConversao: number;
  followupsAbertos: number;
  followupsAtrasados: number;
  followupsConcluidos: number;
  taxaFollowup: number;
  tempoAtivoSegundos: number;
  tempoAtivoHojeSegundos: number;
};

export type DashboardConsultoras = {
  periodoDias: number;
  isAdmin: boolean;
  linhas: DashboardConsultoraLinha[];
  totais: {
    consultoras: number;
    leads: number;
    abordados: number;
    contatos: number;
    ganhos: number;
    followupsAbertos: number;
    tempoAtivoSegundos: number;
  };
  atualizadoEm: string;
};

const pct = (parte: number, total: number) =>
  total > 0 ? Math.round((parte / total) * 100) : 0;

export const getDashboardConsultoras = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<DashboardConsultoras> => {
    const { supabase, userId } = context as any;

    const { data: isAdminRaw } = await supabase.rpc("has_role", {
      _user_id: userId,
      _role: "admin",
    });
    const isAdmin = Boolean(isAdminRaw);

    let meuNome: string | null = null;
    if (!isAdmin) {
      const { data } = await supabase.rpc("minha_consultora_nome");
      meuNome = (data as string | null) ?? null;
      if (!meuNome) {
        return {
          periodoDias: 30,
          isAdmin,
          linhas: [],
          totais: {
            consultoras: 0,
            leads: 0,
            abordados: 0,
            contatos: 0,
            ganhos: 0,
            followupsAbertos: 0,
            tempoAtivoSegundos: 0,
          },
          atualizadoEm: new Date().toISOString(),
        };
      }
    }

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const db: any = supabaseAdmin;

    const periodoDias = 30;
    const agora = new Date();
    const desde = new Date(agora);
    desde.setDate(desde.getDate() - periodoDias);
    const desdeIso = desde.toISOString();
    const desdeDate = desdeIso.slice(0, 10);
    const hoje = agora.toISOString().slice(0, 10);

    let registrosQuery = db
      .from("do_registros")
      .select("consultora_responsavel, status_abordagem")
      .not("consultora_responsavel", "is", null)
      .limit(50000);
    if (meuNome) registrosQuery = registrosQuery.eq("consultora_responsavel", meuNome);

    const [registros, consultoras, eventos, leads, tarefas, uso] = await Promise.all([
      registrosQuery,
      db.from("radar_consultoras").select("nome, email, ativo").limit(500),
      db
        .from("lead_events")
        .select("consultant_id, kind, created_at")
        .gte("created_at", desdeIso)
        .limit(50000),
      db.from("prospect_leads").select("consultant_id, status").limit(50000),
      db.from("lead_tasks").select("consultant_id, status, due_at").limit(50000),
      db
        .from("app_uso_ativo")
        .select("user_id, ref_date, segundos")
        .gte("ref_date", desdeDate)
        .limit(50000),
    ]);

    // Vínculo consultora <-> usuário por e-mail.
    const emailPorNome = new Map<string, string>();
    const nomesAtivos: string[] = [];
    for (const c of consultoras.data ?? []) {
      if (!c?.nome) continue;
      if (c.email) emailPorNome.set(c.nome, String(c.email).toLowerCase());
      if (c.ativo) nomesAtivos.push(c.nome);
    }

    const emails = [...emailPorNome.values()];
    const nomePorUser = new Map<string, string>();
    if (emails.length > 0) {
      const { data: perfis } = await db
        .from("profiles")
        .select("user_id, email, nome_completo")
        .limit(2000);
      for (const p of perfis ?? []) {
        const mail = String(p.email ?? "").toLowerCase();
        if (!mail) continue;
        for (const [nome, e] of emailPorNome) {
          if (e === mail) nomePorUser.set(p.user_id, nome);
        }
      }
    }

    const linhas = new Map<string, DashboardConsultoraLinha>();
    const linha = (nome: string) => {
      const chave = (nome ?? "").trim();
      if (!chave) return null;
      if (meuNome && chave !== meuNome) return null;
      let atual = linhas.get(chave);
      if (!atual) {
        atual = {
          nome: chave,
          email: emailPorNome.get(chave) ?? null,
          leads: 0,
          abordados: 0,
          pendentes: 0,
          taxaAbordagem: 0,
          contatos: 0,
          ligacoes: 0,
          whatsapp: 0,
          qualificados: 0,
          ganhos: 0,
          taxaConversao: 0,
          followupsAbertos: 0,
          followupsAtrasados: 0,
          followupsConcluidos: 0,
          taxaFollowup: 0,
          tempoAtivoSegundos: 0,
          tempoAtivoHojeSegundos: 0,
        };
        linhas.set(chave, atual);
      }
      return atual;
    };

    if (meuNome) linha(meuNome);
    else for (const nome of nomesAtivos) linha(nome);

    for (const r of registros.data ?? []) {
      const l = linha(r.consultora_responsavel ?? "");
      if (!l) continue;
      l.leads += 1;
      if (r.status_abordagem && r.status_abordagem !== "pendente") l.abordados += 1;
      else l.pendentes += 1;
    }

    for (const ev of eventos.data ?? []) {
      if (ev.kind !== "ligacao" && ev.kind !== "whatsapp") continue;
      const nome = nomePorUser.get(ev.consultant_id ?? "");
      const l = nome ? linha(nome) : null;
      if (!l) continue;
      l.contatos += 1;
      if (ev.kind === "ligacao") l.ligacoes += 1;
      else l.whatsapp += 1;
    }

    for (const lead of leads.data ?? []) {
      const nome = nomePorUser.get(lead.consultant_id ?? "");
      const l = nome ? linha(nome) : null;
      if (!l) continue;
      if (lead.status === "qualificado" || lead.status === "proposta") l.qualificados += 1;
      if (lead.status === "ganho") l.ganhos += 1;
    }

    const agoraIso = agora.toISOString();
    for (const t of tarefas.data ?? []) {
      const nome = nomePorUser.get(t.consultant_id ?? "");
      const l = nome ? linha(nome) : null;
      if (!l) continue;
      if (t.status === "done") l.followupsConcluidos += 1;
      else if (t.status === "pending") {
        l.followupsAbertos += 1;
        if (t.due_at && t.due_at < agoraIso) l.followupsAtrasados += 1;
      }
    }

    for (const u of uso.data ?? []) {
      const nome = nomePorUser.get(u.user_id ?? "");
      const l = nome ? linha(nome) : null;
      if (!l) continue;
      l.tempoAtivoSegundos += u.segundos ?? 0;
      if (u.ref_date === hoje) l.tempoAtivoHojeSegundos += u.segundos ?? 0;
    }

    const finais = [...linhas.values()]
      .map((r) => ({
        ...r,
        taxaAbordagem: pct(r.abordados, r.leads),
        taxaConversao: pct(r.ganhos, r.contatos || r.leads),
        taxaFollowup: pct(r.followupsConcluidos, r.followupsConcluidos + r.followupsAbertos),
      }))
      .sort(
        (a, b) =>
          b.abordados - a.abordados ||
          b.contatos - a.contatos ||
          b.tempoAtivoSegundos - a.tempoAtivoSegundos,
      );

    return {
      periodoDias,
      isAdmin,
      linhas: finais,
      totais: {
        consultoras: finais.length,
        leads: finais.reduce((s, r) => s + r.leads, 0),
        abordados: finais.reduce((s, r) => s + r.abordados, 0),
        contatos: finais.reduce((s, r) => s + r.contatos, 0),
        ganhos: finais.reduce((s, r) => s + r.ganhos, 0),
        followupsAbertos: finais.reduce((s, r) => s + r.followupsAbertos, 0),
        tempoAtivoSegundos: finais.reduce((s, r) => s + r.tempoAtivoSegundos, 0),
      },
      atualizadoEm: agora.toISOString(),
    };
  });
