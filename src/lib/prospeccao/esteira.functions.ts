// Esteira de produção: contratos já vendidos, distribuídos para a consultora
// responsável, com lembrete mensal de amortização no mesmo dia do mês da venda.
import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

export type EsteiraContrato = {
  id: string;
  status: string | null;
  data_venda: string;
  cpf: string;
  nome: string;
  banco: string | null;
  seguro: string | null;
  prazo: number | null;
  valor_bruto: number | null;
  producao: number | null;
  repasse: number | null;
  digitador: string | null;
  consultora: string | null;
  consultant_id: string | null;
  observacao: string | null;
  dia_amortizacao: number;
  proximo_contato_em: string | null;
  acompanhamento_ativo: boolean;
  lote_nome: string | null;
  ultimo_contato_em: string | null;
  ultimo_resultado: string | null;
  contatos: number;
  telefone: string | null;
  margem_usada: number | null;
  margem_restante_valor: number | null;
  tipo_margem: string | null;
  removido_em?: string | null;
};

export type CamposVisiveis = {
  status: boolean;
  banco: boolean;
  data_prazo: boolean;
  valor_bruto: boolean;
  producao: boolean;
  digitador: boolean;
  observacao: boolean;
};

export const CAMPOS_VISIVEIS_PADRAO: CamposVisiveis = {
  status: true,
  banco: true,
  data_prazo: true,
  valor_bruto: false,
  producao: false,
  digitador: false,
  observacao: true,
};

const camposSchema = z.object({
  status: z.boolean(),
  banco: z.boolean(),
  data_prazo: z.boolean(),
  valor_bruto: z.boolean(),
  producao: z.boolean(),
  digitador: z.boolean(),
  observacao: z.boolean(),
});

function normalizarCampos(v: any): CamposVisiveis {
  return { ...CAMPOS_VISIVEIS_PADRAO, ...(v && typeof v === "object" ? v : {}) };
}

/** Esconde da consultora o que o admin desligou no lote. Repasse nunca aparece. */
function mascarar(row: any, campos: CamposVisiveis) {
  return {
    ...row,
    repasse: null,
    status: campos.status ? row.status : null,
    banco: campos.banco ? row.banco : null,
    prazo: campos.data_prazo ? row.prazo : null,
    valor_bruto: campos.valor_bruto ? row.valor_bruto : null,
    producao: campos.producao ? row.producao : null,
    digitador: campos.digitador ? row.digitador : null,
    observacao: campos.observacao ? row.observacao : null,
  };
}

export type EsteiraContato = {
  id: string;
  resultado: string;
  observacao: string | null;
  contato_em: string;
};

const RESULTADOS = ["falei", "amortizou", "nao_atendeu", "nao_quis"] as const;

async function admin() {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin as any;
}

async function isAdmin(context: any) {
  const { data } = await context.supabase.rpc("has_role", { _user_id: context.userId, _role: "admin" });
  return Boolean(data);
}

async function assertAdmin(context: any) {
  if (!(await isAdmin(context))) throw new Error("Acesso restrito a administradores.");
}

function hoje(): Date {
  const agora = new Date();
  // Referência no fuso de Maceió (UTC-3).
  return new Date(agora.getTime() - 3 * 60 * 60 * 1000);
}

function iso(d: Date) {
  return d.toISOString().slice(0, 10);
}

/** Data no mês/ano indicados usando o dia pedido (ou o último dia do mês). */
function noDia(ano: number, mes: number, dia: number): Date {
  const ultimo = new Date(Date.UTC(ano, mes + 1, 0)).getUTCDate();
  return new Date(Date.UTC(ano, mes, Math.min(dia, ultimo)));
}

/** Fim do acompanhamento: venda + prazo (meses). Sem prazo, 12 meses. */
function limiteAcompanhamento(dataVenda: string, prazo: number | null): Date {
  const [y, m, d] = dataVenda.split("-").map(Number);
  const meses = prazo && prazo > 0 ? Math.min(prazo, 120) : 12;
  return noDia(y!, (m! - 1) + meses, d!);
}

/** Próxima data de ligação: mesmo dia do mês, a partir de `apartir`. */
function proximaData(dia: number, apartir: Date, limite: Date): string | null {
  let alvo = noDia(apartir.getUTCFullYear(), apartir.getUTCMonth(), dia);
  if (alvo.getTime() < Date.UTC(apartir.getUTCFullYear(), apartir.getUTCMonth(), apartir.getUTCDate())) {
    alvo = noDia(apartir.getUTCFullYear(), apartir.getUTCMonth() + 1, dia);
  }
  if (alvo.getTime() > limite.getTime()) return null;
  return iso(alvo);
}

async function sincronizarTarefa(db: any, contrato: any) {
  await db.from("lead_tasks").update({ status: "canceled" }).eq("esteira_id", contrato.id).eq("status", "pending");
  if (!contrato.acompanhamento_ativo || !contrato.proximo_contato_em || !contrato.consultant_id) return;
  await db.from("lead_tasks").insert({
    esteira_id: contrato.id,
    consultant_id: contrato.consultant_id,
    due_at: new Date(`${contrato.proximo_contato_em}T12:00:00.000Z`).toISOString(),
    title: `Amortização — ${contrato.nome}`,
    status: "pending",
  });
}

export const esteiraConsultoras = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<{ user_id: string; nome: string; email: string | null }[]> => {
    await assertAdmin(context);
    const db = await admin();
    const { data, error } = await db
      .from("profiles")
      .select("user_id,nome_completo,email")
      .order("nome_completo", { ascending: true });
    if (error) throw new Error(error.message);
    return (data ?? []).map((p: any) => ({
      user_id: p.user_id,
      nome: p.nome_completo ?? p.email ?? "Sem nome",
      email: p.email ?? null,
    }));
  });

const itemSchema = z.object({
  status: z.string().max(80).nullable().optional(),
  data_venda: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  cpf: z.string().min(3).max(20),
  nome: z.string().min(2).max(200),
  banco: z.string().max(120).nullable().optional(),
  seguro: z.string().max(40).nullable().optional(),
  prazo: z.number().int().min(0).max(240).nullable().optional(),
  valor_bruto: z.number().nullable().optional(),
  producao: z.number().nullable().optional(),
  repasse: z.number().nullable().optional(),
  digitador: z.string().max(120).nullable().optional(),
  consultora: z.string().max(120).nullable().optional(),
  consultant_id: z.string().uuid().nullable().optional(),
  observacao: z.string().max(500).nullable().optional(),
});

export const esteiraImportar = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) =>
    z
      .object({
        lote: z.string().trim().max(160).optional(),
        campos: camposSchema.optional(),
        items: z.array(itemSchema).min(1).max(3000),
      })
      .parse(data),
  )
  .handler(async ({ context, data }): Promise<{ salvos: number; semResponsavel: number; duplicados: number }> => {
    await assertAdmin(context);
    const db = await admin();
    const hoje0 = hoje();
    const loteId = crypto.randomUUID();

    await db.from("esteira_lotes").insert({
      lote_id: loteId,
      nome: data.lote ?? null,
      campos_visiveis: data.campos ?? CAMPOS_VISIVEIS_PADRAO,
    });


    // Uma planilha pode repetir o mesmo contrato (mesmo CPF + data + banco).
    // O banco não aceita gravar a mesma linha duas vezes no mesmo comando,
    // então mantemos apenas a última ocorrência de cada contrato.
    const unicos = new Map<string, any>();
    for (const it of data.items) {
      const cpf = it.cpf.replace(/\D/g, "");
      const banco = (it.banco ?? "").trim();
      const dia = Number(it.data_venda.slice(8, 10)) || 1;
      const limite = limiteAcompanhamento(it.data_venda, it.prazo ?? null);
      unicos.set(`${cpf}|${it.data_venda}|${banco.toLowerCase()}`, {
        ...it,
        cpf,
        banco,
        lote_id: loteId,
        lote_nome: data.lote ?? null,
        dia_amortizacao: dia,
        proximo_contato_em: proximaData(dia, hoje0, limite),
        acompanhamento_ativo: true,
      });
    }
    const rows = [...unicos.values()];
    const duplicados = data.items.length - rows.length;

    const salvosIds: any[] = [];
    for (let i = 0; i < rows.length; i += 200) {
      const fatia = rows.slice(i, i + 200);
      const { data: saved, error } = await db
        .from("esteira_contratos")
        .upsert(fatia, { onConflict: "cpf,data_venda,banco", ignoreDuplicates: false })
        .select("id,nome,consultant_id,proximo_contato_em,acompanhamento_ativo");
      if (error) throw new Error(error.message);
      salvosIds.push(...(saved ?? []));
    }

    for (const c of salvosIds) await sincronizarTarefa(db, c);

    return {
      salvos: salvosIds.length,
      semResponsavel: rows.filter((r) => !r.consultant_id).length,
      duplicados,
    };
  });


export const esteiraListar = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) =>
    z
      .object({
        consultantId: z.string().uuid().nullable().optional(),
        semResponsavel: z.boolean().default(false),
        busca: z.string().max(120).optional(),
        somenteAtivos: z.boolean().default(true),
        incluirRemovidos: z.boolean().default(false),
        somenteRemovidos: z.boolean().default(false),
        limit: z.number().int().min(1).max(500).default(300),
      })
      .parse(data ?? {}),
  )
  .handler(async ({ context, data }): Promise<EsteiraContrato[]> => {
    const db = await admin();
    const admEh = await isAdmin(context);
    let q = db
      .from("esteira_contratos")
      .select("*")
      .order("proximo_contato_em", { ascending: true, nullsFirst: false })
      .limit(data.limit);
    if (admEh && data.somenteRemovidos) q = q.not("removido_em", "is", null);
    else if (!admEh || !data.incluirRemovidos) q = q.is("removido_em", null);
    if (!admEh) q = q.eq("consultant_id", context.userId);
    else if (data.semResponsavel) q = q.is("consultant_id", null);
    else if (data.consultantId) q = q.eq("consultant_id", data.consultantId);
    if (data.somenteAtivos) q = q.eq("acompanhamento_ativo", true);
    if (data.busca) {
      const like = `%${data.busca.trim()}%`;
      q = q.or(`nome.ilike.${like},cpf.ilike.${like}`);
    }
    const { data: rows, error } = await q;
    if (error) throw new Error(error.message);

    const ids = (rows ?? []).map((r: any) => r.id);
    const contatos = new Map<string, { em: string; resultado: string; total: number }>();
    if (ids.length) {
      const { data: cs } = await db
        .from("esteira_contatos")
        .select("contrato_id,resultado,contato_em")
        .in("contrato_id", ids)
        .order("contato_em", { ascending: false });
      for (const c of cs ?? []) {
        const atual = contatos.get(c.contrato_id);
        if (!atual) contatos.set(c.contrato_id, { em: c.contato_em, resultado: c.resultado, total: 1 });
        else atual.total += 1;
      }
    }

    // Margem usada/restante e telefone vêm da carteira de conversões e do CRM,
    // casados pelo CPF do cliente.
    const cpfs = [...new Set((rows ?? []).map((r: any) => String(r.cpf ?? "").replace(/\D/g, "")).filter(Boolean))];
    const margens = new Map<string, { usada: number | null; restante: number | null; tipo: string | null }>();
    const telefones = new Map<string, string>();
    if (cpfs.length) {
      const [{ data: convs }, { data: leads }] = await Promise.all([
        db
          .from("prospect_conversoes")
          .select("cpf,margem_usada,margem_restante_valor,tipo_margem,data_operacao")
          .in("cpf", cpfs)
          .order("data_operacao", { ascending: false }),
        db.from("prospect_leads").select("cpf,telefone").in("cpf", cpfs),
      ]);
      for (const c of convs ?? []) {
        const k = String(c.cpf ?? "").replace(/\D/g, "");
        if (!k || margens.has(k)) continue;
        margens.set(k, {
          usada: c.margem_usada ?? null,
          restante: c.margem_restante_valor ?? null,
          tipo: c.tipo_margem ?? null,
        });
      }
      for (const l of leads ?? []) {
        const k = String(l.cpf ?? "").replace(/\D/g, "");
        if (k && l.telefone && !telefones.has(k)) telefones.set(k, l.telefone);
      }
    }

    // Regras de exibição por planilha importada (só valem para consultoras).
    const camposPorLote = new Map<string, CamposVisiveis>();
    if (!admEh) {
      const lotes = [...new Set((rows ?? []).map((r: any) => r.lote_id).filter(Boolean))];
      if (lotes.length) {
        const { data: cfgs } = await db.from("esteira_lotes").select("lote_id,campos_visiveis").in("lote_id", lotes);
        for (const cfg of cfgs ?? []) camposPorLote.set(cfg.lote_id, normalizarCampos(cfg.campos_visiveis));
      }
    }

    return (rows ?? []).map((r0: any) => {
      const r = admEh ? r0 : mascarar(r0, camposPorLote.get(r0.lote_id) ?? CAMPOS_VISIVEIS_PADRAO);
      const c = contatos.get(r.id);
      const k = String(r.cpf ?? "").replace(/\D/g, "");
      const m = margens.get(k);
      return {
        ...r,
        ultimo_contato_em: c?.em ?? null,
        ultimo_resultado: c?.resultado ?? null,
        contatos: c?.total ?? 0,
        telefone: r.telefone || telefones.get(k) || null,
        margem_usada: m?.usada ?? null,
        margem_restante_valor: m?.restante ?? null,
        tipo_margem: m?.tipo ?? null,
      } as EsteiraContrato;
    });
  });

export const esteiraHistorico = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => z.object({ contratoId: z.string().uuid() }).parse(data))
  .handler(async ({ context, data }): Promise<EsteiraContato[]> => {
    const db = await admin();
    const { data: contrato } = await db
      .from("esteira_contratos")
      .select("id,consultant_id")
      .eq("id", data.contratoId)
      .maybeSingle();
    if (!contrato) throw new Error("Contrato não encontrado.");
    if (contrato.consultant_id !== context.userId && !(await isAdmin(context)))
      throw new Error("Contrato de outra consultora.");
    const { data: rows, error } = await db
      .from("esteira_contatos")
      .select("id,resultado,observacao,contato_em")
      .eq("contrato_id", data.contratoId)
      .order("contato_em", { ascending: false })
      .limit(100);
    if (error) throw new Error(error.message);
    return (rows ?? []) as EsteiraContato[];
  });

export const esteiraRegistrarContato = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) =>
    z
      .object({
        contratoId: z.string().uuid(),
        resultado: z.enum(RESULTADOS),
        observacao: z.string().max(500).optional(),
      })
      .parse(data),
  )
  .handler(async ({ context, data }): Promise<{ proximo: string | null }> => {
    const db = await admin();
    const { data: contrato } = await db.from("esteira_contratos").select("*").eq("id", data.contratoId).maybeSingle();
    if (!contrato) throw new Error("Contrato não encontrado.");
    if (contrato.consultant_id !== context.userId && !(await isAdmin(context)))
      throw new Error("Contrato de outra consultora.");
    if (contrato.removido_em) throw new Error("Este cliente foi removido da carteira.");

    const { error } = await db.from("esteira_contatos").insert({
      contrato_id: contrato.id,
      consultant_id: context.userId,
      resultado: data.resultado,
      observacao: data.observacao ?? null,
    });
    if (error) throw new Error(error.message);

    const limite = limiteAcompanhamento(contrato.data_venda, contrato.prazo);
    const base = hoje();
    const proximo = proximaData(contrato.dia_amortizacao, new Date(base.getTime() + 24 * 60 * 60 * 1000), limite);
    const ativo = proximo !== null;
    await db
      .from("esteira_contratos")
      .update({ proximo_contato_em: proximo, acompanhamento_ativo: ativo })
      .eq("id", contrato.id);
    await sincronizarTarefa(db, { ...contrato, proximo_contato_em: proximo, acompanhamento_ativo: ativo });
    return { proximo };
  });

export const esteiraEncerrarAcompanhamento = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => z.object({ contratoId: z.string().uuid(), ativo: z.boolean() }).parse(data))
  .handler(async ({ context, data }) => {
    const db = await admin();
    const { data: contrato } = await db.from("esteira_contratos").select("*").eq("id", data.contratoId).maybeSingle();
    if (!contrato) throw new Error("Contrato não encontrado.");
    if (contrato.consultant_id !== context.userId && !(await isAdmin(context)))
      throw new Error("Contrato de outra consultora.");
    let proximo = contrato.proximo_contato_em;
    if (data.ativo && !proximo) {
      proximo = proximaData(contrato.dia_amortizacao, hoje(), limiteAcompanhamento(contrato.data_venda, contrato.prazo));
    }
    await db
      .from("esteira_contratos")
      .update({ acompanhamento_ativo: data.ativo, proximo_contato_em: data.ativo ? proximo : null })
      .eq("id", contrato.id);
    await sincronizarTarefa(db, { ...contrato, acompanhamento_ativo: data.ativo, proximo_contato_em: proximo });
    return { ok: true };
  });

export const esteiraDefinirResponsavel = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) =>
    z.object({ contratoId: z.string().uuid(), consultantId: z.string().uuid().nullable() }).parse(data),
  )
  .handler(async ({ context, data }) => {
    await assertAdmin(context);
    const db = await admin();
    const { data: contrato } = await db.from("esteira_contratos").select("*").eq("id", data.contratoId).maybeSingle();
    if (!contrato) throw new Error("Contrato não encontrado.");
    await db.from("esteira_contratos").update({ consultant_id: data.consultantId }).eq("id", contrato.id);
    await sincronizarTarefa(db, { ...contrato, consultant_id: data.consultantId });
    return { ok: true };
  });

export type EsteiraMetricas = {
  total: number;
  ativos: number;
  semResponsavel: number;
  vencendoHoje: number;
  atrasados: number;
  contatosMes: number;
  amortizacoesMes: number;
  porConsultora: { nome: string; consultant_id: string | null; total: number; pendentes: number; contatos_mes: number }[];
};

export const esteiraMetricas = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<EsteiraMetricas> => {
    await assertAdmin(context);
    const db = await admin();
    const hoje0 = iso(hoje());
    const inicioMes = `${hoje0.slice(0, 7)}-01`;

    const { data: rows, error } = await db
      .from("esteira_contratos")
      .select("id,consultora,consultant_id,acompanhamento_ativo,proximo_contato_em")
      .is("removido_em", null)
      .limit(20000);
    if (error) throw new Error(error.message);

    const { data: contatos } = await db
      .from("esteira_contatos")
      .select("contrato_id,resultado,contato_em")
      .gte("contato_em", `${inicioMes}T00:00:00.000Z`)
      .limit(20000);

    const nomePorContrato = new Map<string, string>();
    for (const r of rows ?? []) nomePorContrato.set(r.id, r.consultora || "Sem responsável");

    const contatosMesPorNome = new Map<string, number>();
    for (const c of contatos ?? []) {
      const nome = nomePorContrato.get(c.contrato_id) ?? "Sem responsável";
      contatosMesPorNome.set(nome, (contatosMesPorNome.get(nome) ?? 0) + 1);
    }

    const agrupado = new Map<string, { consultant_id: string | null; total: number; pendentes: number }>();
    for (const r of rows ?? []) {
      const nome = r.consultora || "Sem responsável";
      const g = agrupado.get(nome) ?? { consultant_id: r.consultant_id ?? null, total: 0, pendentes: 0 };
      if (!g.consultant_id && r.consultant_id) g.consultant_id = r.consultant_id;
      g.total += 1;
      if (r.acompanhamento_ativo && r.proximo_contato_em && r.proximo_contato_em <= hoje0) g.pendentes += 1;
      agrupado.set(nome, g);
    }

    return {
      total: (rows ?? []).length,
      ativos: (rows ?? []).filter((r: any) => r.acompanhamento_ativo).length,
      semResponsavel: (rows ?? []).filter((r: any) => !r.consultant_id).length,
      vencendoHoje: (rows ?? []).filter((r: any) => r.acompanhamento_ativo && r.proximo_contato_em === hoje0).length,
      atrasados: (rows ?? []).filter(
        (r: any) => r.acompanhamento_ativo && r.proximo_contato_em && r.proximo_contato_em < hoje0,
      ).length,
      contatosMes: (contatos ?? []).length,
      amortizacoesMes: (contatos ?? []).filter((c: any) => c.resultado === "amortizou").length,
      porConsultora: [...agrupado.entries()]
        .map(([nome, g]) => ({ nome, ...g, contatos_mes: contatosMesPorNome.get(nome) ?? 0 }))
        .sort((a, b) => b.total - a.total),
    };
  });

// ===== Painel do admin: configuração de exibição, edição e remoção =====

export type EsteiraLote = {
  lote_id: string;
  nome: string | null;
  campos_visiveis: CamposVisiveis;
  total: number;
  created_at: string;
};

export const esteiraLotes = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<EsteiraLote[]> => {
    await assertAdmin(context);
    const db = await admin();
    const { data: lotes, error } = await db
      .from("esteira_lotes")
      .select("lote_id,nome,campos_visiveis,created_at")
      .order("created_at", { ascending: false })
      .limit(60);
    if (error) throw new Error(error.message);

    const totais = new Map<string, number>();
    const ids = (lotes ?? []).map((l: any) => l.lote_id);
    if (ids.length) {
      const { data: rows } = await db
        .from("esteira_contratos")
        .select("lote_id")
        .in("lote_id", ids)
        .is("removido_em", null)
        .limit(20000);
      for (const r of rows ?? []) totais.set(r.lote_id, (totais.get(r.lote_id) ?? 0) + 1);
    }

    return (lotes ?? []).map((l: any) => ({
      lote_id: l.lote_id,
      nome: l.nome ?? null,
      campos_visiveis: normalizarCampos(l.campos_visiveis),
      total: totais.get(l.lote_id) ?? 0,
      created_at: l.created_at,
    }));
  });

export const esteiraAtualizarLote = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) =>
    z
      .object({
        loteId: z.string().uuid(),
        nome: z.string().trim().max(160).nullable().optional(),
        campos: camposSchema,
      })
      .parse(data),
  )
  .handler(async ({ context, data }) => {
    await assertAdmin(context);
    const db = await admin();
    const { error } = await db
      .from("esteira_lotes")
      .upsert(
        { lote_id: data.loteId, nome: data.nome ?? null, campos_visiveis: data.campos },
        { onConflict: "lote_id" },
      );
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const esteiraAtualizarContrato = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) =>
    z
      .object({
        contratoId: z.string().uuid(),
        nome: z.string().trim().min(2).max(200),
        cpf: z.string().trim().min(3).max(20),
        telefone: z.string().trim().max(30).nullable().optional(),
        banco: z.string().trim().max(120).nullable().optional(),
        data_venda: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
        prazo: z.number().int().min(0).max(240).nullable().optional(),
        valor_bruto: z.number().nullable().optional(),
        seguro: z.string().trim().max(40).nullable().optional(),
        status: z.string().trim().max(80).nullable().optional(),
        observacao: z.string().trim().max(500).nullable().optional(),
        dia_amortizacao: z.number().int().min(1).max(31),
        proximo_contato_em: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().optional(),
        acompanhamento_ativo: z.boolean(),
        consultant_id: z.string().uuid().nullable().optional(),
      })
      .parse(data),
  )
  .handler(async ({ context, data }): Promise<{ proximo: string | null }> => {
    await assertAdmin(context);
    const db = await admin();
    const { data: contrato } = await db.from("esteira_contratos").select("*").eq("id", data.contratoId).maybeSingle();
    if (!contrato) throw new Error("Contrato não encontrado.");

    const limite = limiteAcompanhamento(data.data_venda, data.prazo ?? null);
    let proximo: string | null = data.acompanhamento_ativo ? (data.proximo_contato_em ?? null) : null;
    if (data.acompanhamento_ativo && !proximo) proximo = proximaData(data.dia_amortizacao, hoje(), limite);
    const ativo = data.acompanhamento_ativo && proximo !== null;

    const patch = {
      nome: data.nome,
      cpf: data.cpf.replace(/\D/g, "") || data.cpf,
      telefone: data.telefone || null,
      banco: data.banco || null,
      data_venda: data.data_venda,
      prazo: data.prazo ?? null,
      valor_bruto: data.valor_bruto ?? null,
      seguro: data.seguro || null,
      status: data.status || null,
      observacao: data.observacao || null,
      dia_amortizacao: data.dia_amortizacao,
      proximo_contato_em: proximo,
      acompanhamento_ativo: ativo,
      consultant_id: data.consultant_id ?? null,
    };
    const { error } = await db.from("esteira_contratos").update(patch).eq("id", contrato.id);
    if (error) throw new Error(error.message);

    await sincronizarTarefa(db, { ...contrato, ...patch, id: contrato.id });
    return { proximo };
  });

export const esteiraRemoverContrato = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => z.object({ contratoId: z.string().uuid(), remover: z.boolean().default(true) }).parse(data))
  .handler(async ({ context, data }) => {
    await assertAdmin(context);
    const db = await admin();
    const { data: contrato } = await db.from("esteira_contratos").select("*").eq("id", data.contratoId).maybeSingle();
    if (!contrato) throw new Error("Contrato não encontrado.");

    if (data.remover) {
      await db
        .from("esteira_contratos")
        .update({ removido_em: new Date().toISOString(), removido_por: context.userId })
        .eq("id", contrato.id);
      await sincronizarTarefa(db, { ...contrato, acompanhamento_ativo: false, proximo_contato_em: null });
      return { ok: true, removido: true };
    }

    const limite = limiteAcompanhamento(contrato.data_venda, contrato.prazo);
    const proximo = contrato.proximo_contato_em ?? proximaData(contrato.dia_amortizacao, hoje(), limite);
    await db
      .from("esteira_contratos")
      .update({
        removido_em: null,
        removido_por: null,
        proximo_contato_em: proximo,
        acompanhamento_ativo: proximo !== null,
      })
      .eq("id", contrato.id);
    await sincronizarTarefa(db, { ...contrato, proximo_contato_em: proximo, acompanhamento_ativo: proximo !== null });
    return { ok: true, removido: false };
  });
