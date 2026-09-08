// Aba "PROMOVIDOS RECENTEMENTE": leads do Radar Diário Oficial publicados nos
// últimos dias, entregues automaticamente à consultora logada (rodízio).
// - getPromovidosRecentes: lista paginada + contadores (hoje / 7 dias / sem CPF).
// - confirmarCpfPromovido: consultora salva o CPF completo confirmado no Congonhas.
// - distribuirPromovidosAgora: admin dispara a distribuição manualmente.

import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { isValidCpf, normalizeCpf } from "@/lib/cpf";

export const JANELA_DIAS = 15;

export type PromovidoRecente = {
  id: string;
  nome_servidor: string;
  cpf_parcial: string | null;
  cpf_confirmado: string | null;
  cpf_validado_em: string | null;
  matricula: string | null;
  cargo: string | null;
  cargo_anterior: string | null;
  cargo_novo: string | null;
  orgao: string | null;
  tipo_movimentacao: string | null;
  potencial_financeiro: string | null;
  data_publicacao: string | null;
  status_abordagem: string;
  consultora_responsavel: string | null;
  trecho_original: string | null;
  created_at: string;
};

const COLS =
  "id,nome_servidor,cpf_parcial,cpf_confirmado,cpf_validado_em,matricula,cargo,cargo_anterior,cargo_novo,orgao,tipo_movimentacao,potencial_financeiro,data_publicacao,status_abordagem,consultora_responsavel,trecho_original,created_at";

export type PromovidosRecentesResult = {
  rows: PromovidoRecente[];
  total: number;
  isAdmin: boolean;
  consultoraNome: string | null;
  vinculada: boolean;
  novosHoje: number;
  novos7d: number;
  semCpf: number;
  naoAbordados: number;
  ultimaEntrega: string | null;
  /** true quando não há nada na janela de 15 dias e listamos os mais recentes. */
  foraDaJanela: boolean;
  /** Data da publicação mais recente já capturada pelo Radar. */
  ultimaPublicacao: string | null;
};

function diasAtras(dias: number): string {
  return new Date(Date.now() - dias * 86_400_000).toISOString().slice(0, 10);
}

async function buscarNome(context: any, email: string): Promise<string | null> {
  const { data } = await context.supabase
    .from("radar_consultoras")
    .select("nome")
    .ilike("email", email)
    .limit(1);
  return (data?.[0]?.nome as string | undefined) ?? null;
}

async function identificar(context: any): Promise<{ isAdmin: boolean; nome: string | null }> {
  const { data: isAdminRaw } = await context.supabase.rpc("has_role", {
    _user_id: context.userId,
    _role: "admin",
  });
  if (isAdminRaw) return { isAdmin: true, nome: null };
  const email = String(context.claims?.email ?? "").trim().toLowerCase();
  if (!email) return { isAdmin: false, nome: null };

  let nome = await buscarNome(context, email);
  if (!nome) {
    // Vínculo na hora: cria o cadastro da consultora a partir da conta e tenta de novo,
    // para ninguém ficar preso na mensagem "conta não vinculada".
    try {
      const { sincronizarConsultoras } = await import("@/lib/radar/distribuicao.server");
      await sincronizarConsultoras();
      nome = await buscarNome(context, email);
    } catch (e) {
      console.error("[promovidos] falha ao vincular consultora automaticamente", e);
    }
  }
  return { isAdmin: false, nome };
}

export const getPromovidosRecentes = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) =>
    z
      .object({
        offset: z.number().int().min(0).max(100000).optional(),
        limit: z.number().int().min(1).max(50).optional(),
        apenasNovos: z.boolean().optional(),
        consultora: z.string().trim().max(120).optional(),
      })
      .parse(data ?? {}),
  )
  .handler(async ({ context, data }): Promise<PromovidosRecentesResult> => {
    const offset = data.offset ?? 0;
    const limit = data.limit ?? 12;
    const desde = diasAtras(JANELA_DIAS);

    const { isAdmin, nome: nomeAuto } = await identificar(context);
    const nome = isAdmin ? (data.consultora?.trim() || null) : nomeAuto;

    if (!isAdmin && !nome) {
      return {
        rows: [], total: 0, isAdmin: false, consultoraNome: null, vinculada: false,
        novosHoje: 0, novos7d: 0, semCpf: 0, naoAbordados: 0, ultimaEntrega: null,
        foraDaJanela: false, ultimaPublicacao: null,
      };
    }


    const base = (comJanela = true) => {
      // Contagem só na primeira página (a UI guarda o total); contar a tabela
      // inteira em cada página deixava a tela lenta e podia estourar o tempo.
      let q = context.supabase
        .from("do_registros")
        .select(COLS, offset === 0 ? { count: "estimated" } : undefined);
      if (comJanela) q = q.gte("data_publicacao", desde);
      if (nome) q = q.eq("consultora_responsavel", nome);
      return q;
    };

    const listar = async (comJanela: boolean) => {
      let query = base(comJanela);
      if (data.apenasNovos) query = query.eq("status_abordagem", "novo");
      const res = await query
        .order("data_publicacao", { ascending: false, nullsFirst: false })
        .order("created_at", { ascending: false })
        .range(offset, offset + limit - 1);
      if (res.error) throw new Error(res.error.message);
      return { rows: (res.data ?? []) as unknown as PromovidoRecente[], count: res.count ?? 0 };
    };

    let { rows, count } = await listar(true);
    let foraDaJanela = false;

    // Sem nada publicado nos últimos 15 dias: em vez de tela vazia, mostramos
    // os promovidos mais recentes da carteira (a UI marca a idade de cada um).
    if (!rows.length && offset === 0) {
      const fallback = await listar(false);
      if (fallback.rows.length) {
        rows = fallback.rows;
        count = fallback.count;
        foraDaJanela = true;
      }
    }

    const hoje = new Date().toISOString().slice(0, 10);
    const contar = async (build: (q: any) => any): Promise<number> => {
      let q = context.supabase
        .from("do_registros")
        .select("id", { count: "exact", head: true })
        .gte("data_publicacao", desde);
      if (nome) q = q.eq("consultora_responsavel", nome);
      const { count: c } = await build(q);
      return c ?? 0;
    };

    const ultimaEntregaQuery = (async () => {
      let q = context.supabase
        .from("do_registros")
        .select("atribuido_em")
        .not("atribuido_em", "is", null);
      if (nome) q = q.eq("consultora_responsavel", nome);
      const { data: d } = await q.order("atribuido_em", { ascending: false }).limit(1);
      return ((d?.[0] as any)?.atribuido_em as string | undefined) ?? null;
    })();

    const ultimaPublicacaoQuery = (async () => {
      const { data: d } = await context.supabase
        .from("do_registros")
        .select("data_publicacao")
        .not("data_publicacao", "is", null)
        .order("data_publicacao", { ascending: false })
        .limit(1);
      return ((d?.[0] as any)?.data_publicacao as string | undefined) ?? null;
    })();

    const [novosHoje, novos7d, semCpf, naoAbordados, ultimaEntrega, ultimaPublicacao] = await Promise.all([
      contar((q) => q.eq("data_publicacao", hoje)),
      contar((q) => q.gte("data_publicacao", diasAtras(7))),
      contar((q) => q.is("cpf_confirmado", null)),
      contar((q) => q.eq("status_abordagem", "novo")),
      ultimaEntregaQuery,
      ultimaPublicacaoQuery,
    ]);

    return {
      rows,
      total: count,
      isAdmin,
      consultoraNome: nome,
      vinculada: !isAdmin,
      novosHoje,
      novos7d,
      semCpf,
      naoAbordados,
      ultimaEntrega,
      foraDaJanela,
      ultimaPublicacao,
    };
  });

export const confirmarCpfPromovido = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) =>
    z.object({ id: z.string().uuid(), cpf: z.string().trim().min(11).max(20) }).parse(data),
  )
  .handler(async ({ context, data }): Promise<{ ok: true; cpf: string }> => {
    const cpf = normalizeCpf(data.cpf);
    if (!isValidCpf(cpf)) throw new Error("CPF inválido. Confira os dígitos.");

    const { isAdmin, nome } = await identificar(context);
    const { data: reg, error: rErr } = await context.supabase
      .from("do_registros")
      .select("id,cpf_parcial,consultora_responsavel")
      .eq("id", data.id)
      .limit(1);
    if (rErr) throw new Error(rErr.message);
    const row = reg?.[0] as any;
    if (!row) throw new Error("Registro não encontrado.");
    if (!isAdmin && (!nome || row.consultora_responsavel !== nome)) {
      throw new Error("Este lead não está na sua carteira.");
    }

    // Confere os dígitos publicados no Diário (quando existirem) para evitar
    // salvar o CPF de um homônimo.
    const parciais = String(row.cpf_parcial ?? "").replace(/\D/g, "");
    if (parciais.length === 3 && !cpf.includes(parciais)) {
      throw new Error(`Os 3 dígitos publicados (${parciais}) não aparecem neste CPF. Confira o homônimo.`);
    }

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin
      .from("do_registros")
      .update({
        cpf_confirmado: cpf,
        cpf_validado_em: new Date().toISOString(),
        cpf_validado_por: context.userId,
      } as any)
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true, cpf };
  });

export const distribuirPromovidosAgora = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<{ atribuidos: number; consultoras: number }> => {
    const { data: isAdminRaw } = await context.supabase.rpc("has_role", {
      _user_id: context.userId,
      _role: "admin",
    });
    if (!isAdminRaw) throw new Error("Acesso restrito a administradores.");
    const { distribuirPendentes } = await import("@/lib/radar/distribuicao.server");
    const r = await distribuirPendentes(2000);
    const { logAdminAction } = await import("@/lib/admin/audit.server");
    await logAdminAction({
      actorId: context.userId,
      actorEmail: (context.claims as { email?: string } | undefined)?.email ?? null,
      action: "radar_distribuir_pendentes",
      detail: r,
    });
    return r;
  });

async function assertAdminCtx(context: any) {
  const { data: isAdminRaw } = await context.supabase.rpc("has_role", {
    _user_id: context.userId,
    _role: "admin",
  });
  if (!isAdminRaw) throw new Error("Acesso restrito a administradores.");
}

// Admin: espalha os leads do Radar em partes iguais entre todas as consultoras ativas.
export const redistribuirPromovidosIgualmente = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) =>
    z
      .object({
        janelaDias: z.number().int().min(1).max(365).nullable().optional(),
        incluirAbordados: z.boolean().optional(),
      })
      .parse(data ?? {}),
  )
  .handler(async ({ context, data }): Promise<{ atribuidos: number; consultoras: number }> => {
    await assertAdminCtx(context);
    const { redistribuirIgualmente } = await import("@/lib/radar/distribuicao.server");
    const r = await redistribuirIgualmente(data.janelaDias ?? null, data.incluirAbordados ?? false);
    const { logAdminAction } = await import("@/lib/admin/audit.server");
    await logAdminAction({
      actorId: context.userId,
      actorEmail: (context.claims as { email?: string } | undefined)?.email ?? null,
      action: "radar_redistribuir_igualmente",
      detail: { ...r, ...data },
    });
    return r;
  });

export type CarteiraResumoItem = {
  nome: string;
  email: string | null;
  ativo: boolean;
  total: number;
  janela: number;
  ultimaEntrega: string | null;
};

// Admin: quantos leads do Radar cada consultora tem (janela e total).
export const getResumoCarteiras = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<CarteiraResumoItem[]> => {
    await assertAdminCtx(context);
    const { resumoCarteiras } = await import("@/lib/radar/distribuicao.server");
    return resumoCarteiras(JANELA_DIAS);
  });

// Admin: distribuição por desempenho — quem produz mais recebe mais leads.
export const redistribuirPromovidosPorDesempenho = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) =>
    z
      .object({
        diasDesempenho: z.number().int().min(1).max(180).optional(),
        janelaDias: z.number().int().min(1).max(365).nullable().optional(),
        pesoMax: z.number().min(1).max(10).optional(),
        status: z.array(z.string().min(1).max(40)).max(20).optional(),
        somenteNaoContatados: z.boolean().optional(),
      })
      .parse(data ?? {}),
  )
  .handler(
    async ({
      context,
      data,
    }): Promise<{ atribuidos: number; consultoras: number; topConsultora: string | null; topPeso: number }> => {
      await assertAdminCtx(context);
      const { redistribuirPorDesempenho } = await import("@/lib/radar/distribuicao.server");
      const r = await redistribuirPorDesempenho(
        data.diasDesempenho ?? 14,
        data.janelaDias ?? null,
        data.pesoMax ?? 4,
        data.status?.length ? data.status : ["novo"],
        data.somenteNaoContatados ?? true,
      );
      const { logAdminAction } = await import("@/lib/admin/audit.server");
      await logAdminAction({
        actorId: context.userId,
        actorEmail: (context.claims as { email?: string } | undefined)?.email ?? null,
        action: "radar_redistribuir_desempenho",
        detail: { ...r, ...data },
      });
      return r;
    },
  );

// ---------------------------------------------------------------------------
// Liberação administrativa dos promovidos
// Somente leads liberados pelo administrador aparecem para as consultoras.
// ---------------------------------------------------------------------------

export type LotePendente = {
  data_publicacao: string | null;
  total: number;
  comCpf: number;
  semConsultora: number;
};

export const getPromovidosPendentesLiberacao = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<{ lotes: LotePendente[]; total: number }> => {
    await assertAdminCtx(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data, error } = await (supabaseAdmin as any)
      .from("do_registros")
      .select("data_publicacao,cpf_confirmado,consultora_responsavel")
      .is("liberado_em", null)
      .order("data_publicacao", { ascending: false })
      .limit(5000);
    if (error) throw new Error(error.message);
    const mapa = new Map<string, LotePendente>();
    for (const r of (data ?? []) as any[]) {
      const key = (r.data_publicacao as string | null) ?? "sem-data";
      const cur = mapa.get(key) ?? {
        data_publicacao: r.data_publicacao ?? null,
        total: 0,
        comCpf: 0,
        semConsultora: 0,
      };
      cur.total += 1;
      if (r.cpf_confirmado) cur.comCpf += 1;
      if (!r.consultora_responsavel) cur.semConsultora += 1;
      mapa.set(key, cur);
    }
    const lotes = [...mapa.values()].sort((a, b) =>
      String(b.data_publicacao ?? "").localeCompare(String(a.data_publicacao ?? "")),
    );
    return { lotes, total: lotes.reduce((s, l) => s + l.total, 0) };
  });

export const liberarPromovidos = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { datas?: string[]; todos?: boolean; distribuir?: boolean }) =>
    z
      .object({
        datas: z.array(z.string()).optional(),
        todos: z.boolean().optional(),
        distribuir: z.boolean().optional(),
      })
      .parse(d),
  )
  .handler(
    async ({ data, context }): Promise<{ liberados: number; distribuidos: number }> => {
      await assertAdminCtx(context);
      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

      let distribuidos = 0;
      if (data.distribuir !== false) {
        try {
          const { distribuirPendentes } = await import("@/lib/radar/distribuicao.server");
          const r: any = await distribuirPendentes(2000);
          distribuidos = Number(r?.atribuidos ?? 0);
        } catch {
          /* distribuição é best-effort; a liberação continua */
        }
      }

      let q = (supabaseAdmin as any)
        .from("do_registros")
        .update({ liberado_em: new Date().toISOString(), liberado_por: context.userId })
        .is("liberado_em", null);
      if (!data.todos) {
        const datas = data.datas ?? [];
        if (datas.length === 0) return { liberados: 0, distribuidos };
        q = q.in("data_publicacao", datas);
      }
      const { data: rows, error } = await q.select("id");
      if (error) throw new Error(error.message);
      return { liberados: (rows ?? []).length, distribuidos };
    },
  );

export const recolherPromovidos = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { datas: string[] }) => z.object({ datas: z.array(z.string()).min(1) }).parse(d))
  .handler(async ({ data, context }): Promise<{ recolhidos: number }> => {
    await assertAdminCtx(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: rows, error } = await (supabaseAdmin as any)
      .from("do_registros")
      .update({ liberado_em: null, liberado_por: null })
      .in("data_publicacao", data.datas)
      .not("liberado_em", "is", null)
      .select("id");
    if (error) throw new Error(error.message);
    return { recolhidos: (rows ?? []).length };
  });

// ── Consultoras cadastradas sem conta de acesso ───────────────────────────────
// Um lead atribuído a um nome que não tem conta no sistema fica invisível: a RLS
// casa pelo e-mail do usuário logado. Aqui o admin enxerga esses casos e devolve
// os leads ao rateio igualitário.

export type ConsultoraSemConta = {
  nome: string;
  email: string | null;
  ativo: boolean;
  leads: number;
};

async function emailsComConta(): Promise<Set<string>> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const emails = new Set<string>();
  for (let page = 1; page <= 20; page++) {
    const { data, error } = await supabaseAdmin.auth.admin.listUsers({ page, perPage: 1000 });
    if (error) throw new Error(error.message);
    const users = data?.users ?? [];
    for (const u of users) if (u.email) emails.add(u.email.trim().toLowerCase());
    if (users.length < 1000) break;
  }
  return emails;
}

export const getConsultorasSemConta = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(
    async ({ context }): Promise<{ itens: ConsultoraSemConta[]; leadsInvisiveis: number }> => {
      await assertAdminCtx(context);
      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

      const [contas, consultoras, registros] = await Promise.all([
        emailsComConta(),
        supabaseAdmin.from("radar_consultoras").select("nome, email, ativo"),
        supabaseAdmin.from("do_registros").select("consultora_responsavel").not("consultora_responsavel", "is", null),
      ]);
      if (consultoras.error) throw new Error(consultoras.error.message);
      if (registros.error) throw new Error(registros.error.message);

      const porNome = new Map<string, number>();
      for (const r of (registros.data ?? []) as Array<{ consultora_responsavel: string | null }>) {
        const n = r.consultora_responsavel;
        if (!n) continue;
        porNome.set(n, (porNome.get(n) ?? 0) + 1);
      }

      const itens: ConsultoraSemConta[] = [];
      const nomesComConta = new Set<string>();
      for (const c of (consultoras.data ?? []) as Array<{ nome: string; email: string | null; ativo: boolean }>) {
        const em = (c.email ?? "").trim().toLowerCase();
        if (em && contas.has(em)) {
          nomesComConta.add(c.nome);
          continue;
        }
        itens.push({ nome: c.nome, email: c.email, ativo: c.ativo, leads: porNome.get(c.nome) ?? 0 });
      }

      // Nomes usados em do_registros que nem existem mais no cadastro.
      for (const [nome, leads] of porNome) {
        if (nomesComConta.has(nome)) continue;
        if (itens.some((i) => i.nome === nome)) continue;
        itens.push({ nome, email: null, ativo: false, leads });
      }

      itens.sort((a, b) => b.leads - a.leads || a.nome.localeCompare(b.nome));
      const leadsInvisiveis = itens.reduce((acc, i) => acc + i.leads, 0);
      return { itens, leadsInvisiveis };
    },
  );

/** Solta os leads presos com nomes sem conta e refaz o rateio igualitário. */
export const devolverLeadsSemConta = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(
    async ({ context }): Promise<{ liberados: number; atribuidos: number; consultoras: number }> => {
      await assertAdminCtx(context);
      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

      const contas = await emailsComConta();
      const { data: cs, error: eCs } = await supabaseAdmin
        .from("radar_consultoras")
        .select("nome, email");
      if (eCs) throw new Error(eCs.message);

      const nomesValidos = new Set(
        ((cs ?? []) as Array<{ nome: string; email: string | null }>)
          .filter((c) => {
            const em = (c.email ?? "").trim().toLowerCase();
            return em.length > 0 && contas.has(em);
          })
          .map((c) => c.nome),
      );

      const { data: regs, error: eRegs } = await supabaseAdmin
        .from("do_registros")
        .select("id, consultora_responsavel")
        .not("consultora_responsavel", "is", null);
      if (eRegs) throw new Error(eRegs.message);

      const ids = ((regs ?? []) as Array<{ id: string; consultora_responsavel: string }>)
        .filter((r) => !nomesValidos.has(r.consultora_responsavel))
        .map((r) => r.id);

      let liberados = 0;
      for (let i = 0; i < ids.length; i += 500) {
        const lote = ids.slice(i, i + 500);
        const { data: upd, error } = await (supabaseAdmin as any)
          .from("do_registros")
          .update({ consultora_responsavel: null, atribuido_em: null })
          .in("id", lote)
          .select("id");
        if (error) throw new Error(error.message);
        liberados += (upd ?? []).length;
      }

      const { redistribuirIgualmente } = await import("@/lib/radar/distribuicao.server");
      const r = liberados > 0
        ? await redistribuirIgualmente(null, true)
        : { atribuidos: 0, consultoras: 0 };

      try {
        const { logAdminAction } = await import("@/lib/admin/audit.server");
        await logAdminAction({
          actorId: context.userId,
          actorEmail: (context.claims as { email?: string } | undefined)?.email ?? null,
          action: "radar_devolver_leads_sem_conta",
          detail: { liberados, ...r },
        });
      } catch {
        /* auditoria best-effort */
      }

      return { liberados, atribuidos: r.atribuidos, consultoras: r.consultoras };
    },
  );

// Admin, 1 clique: devolve todos os promovidos ao estoque e reparte de novo entre
// todas as consultoras com conta, sem entregar o mesmo lead para quem já o atendeu
// nos últimos N dias (padrão 7).
export const reiniciarPromovidosTodos = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) =>
    z
      .object({
        diasBloqueio: z.number().int().min(0).max(365).optional(),
        janelaDias: z.number().int().min(1).max(365).nullable().optional(),
      })
      .parse(data ?? {}),
  )
  .handler(
    async ({
      context,
      data,
    }): Promise<{ reiniciados: number; atribuidos: number; consultoras: number; semDono: number }> => {
      await assertAdminCtx(context);
      const { callRpcRow } = await import("@/lib/radar/rpc.server");
      const row = await callRpcRow<{
        reiniciados: number;
        atribuidos: number;
        consultoras: number;
        sem_dono: number;
      }>("reiniciar_promovidos_e_redistribuir", {
        _dias_bloqueio: data.diasBloqueio ?? 7,
        _janela_dias: data.janelaDias ?? null,
        _limite: 20000,
      });

      const r = {
        reiniciados: Number(row?.reiniciados ?? 0),
        atribuidos: Number(row?.atribuidos ?? 0),
        consultoras: Number(row?.consultoras ?? 0),
        semDono: Number(row?.sem_dono ?? 0),
      };

      try {
        const { logAdminAction } = await import("@/lib/admin/audit.server");
        await logAdminAction({
          actorId: context.userId,
          actorEmail: (context.claims as { email?: string } | undefined)?.email ?? null,
          action: "radar_reiniciar_promovidos_todos",
          detail: { ...r, ...data },
        });
      } catch {
        /* auditoria best-effort */
      }

      return r;
    },
  );
