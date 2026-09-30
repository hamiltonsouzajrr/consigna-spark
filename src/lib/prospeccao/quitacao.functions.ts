import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export type Prazo = { bruto: number | null; troco: number | null };
export type ContratoOp = { banco: string; contrato: string; tipo: string; parcelas: string; restantes: number | null; parcela: number | null; saldo: number | null };
export type QuitacaoCliente = {
  id: string;
  lote_id: string | null;
  cpf: string;
  nome: string;
  status: string | null;
  cod_ordem: string;
  saldo: number | null;
  parcela: number | null;
  reserva: number | null;
  qtd_contratos: number | null;
  pagas: number | null;
  abertas: number | null;
  plano: number | null;
  prazos: Record<string, Prazo>;
  consultant_id: string | null;
  resultado: string;
  ultimo_contato_em: string | null;
  retorno_em: string | null;
  importado_em: string;
  matricula: string | null;
  perfil: string | null;
  ritmo: string | null;
  competencia: string | null;
  banco_previsto: string | null;
  credito_previsto: number | null;
  troco_previsto: number | null;
  contratos: ContratoOp[];
  formato: string;
  produto: string;
  etapa: string;
  prioridade: number | null;
  apto_roteiro: boolean;
  troco_simulado: number | null;
  taxa_simulada: string | null;
  liberacao_prevista: string | null;
  checklist: Record<string, boolean>;
};

const produtoZ = z.enum(["geral", "ng"]).default("geral");
const modoZ = z.enum(["quantidade", "valor"]).default("quantidade");
const trocoDe = (prazos: unknown, previsto?: number | null) => {
  let b: number | null = previsto ?? null;
  for (const v of Object.values((prazos ?? {}) as Record<string, { troco: number | null }>)) if (v?.troco != null && (b == null || v.troco > b)) b = v.troco;
  return b ?? 0;
};

/** Alocação gulosa: por quantidade (menor fila) ou por valor (menor troco somado, desempate pela fila). */
function criarAlocador(ids: string[], modo: "quantidade" | "valor") {
  const fila = new Map<string, number>(ids.map((i) => [i, 0]));
  const soma = new Map<string, number>(ids.map((i) => [i, 0]));
  return {
    carregar(uid: string | null, troco: number) {
      if (!uid || !fila.has(uid)) return;
      fila.set(uid, fila.get(uid)! + 1); soma.set(uid, soma.get(uid)! + Math.max(0, troco));
    },
    descarregar(uid: string | null, troco: number) {
      if (!uid || !fila.has(uid)) return;
      fila.set(uid, Math.max(0, fila.get(uid)! - 1)); soma.set(uid, Math.max(0, soma.get(uid)! - Math.max(0, troco)));
    },
    proxima(troco: number, exceto?: string | null) {
      let best: string | null = null;
      for (const id of fila.keys()) {
        if (id === exceto) continue;
        if (best === null) { best = id; continue; }
        const a = modo === "valor" ? soma.get(id)! - soma.get(best)! : fila.get(id)! - fila.get(best)!;
        const tie = modo === "valor" ? fila.get(id)! - fila.get(best)! : 0;
        if (a < 0 || (a === 0 && tie < 0)) best = id;
      }
      if (best) this.carregar(best, troco);
      return best;
    },
  };
}

async function cargaAtual(supabaseAdmin: any, produto: string, aloc: ReturnType<typeof criarAlocador>) {
  for (let from = 0; ; from += 1000) {
    const { data } = await supabaseAdmin.from("quitacao_clientes").select("consultant_id,prazos,troco_previsto")
      .eq("produto", produto).is("removido_em", null).not("consultant_id", "is", null).range(from, from + 999);
    for (const r of data ?? []) aloc.carregar(r.consultant_id, trocoDe(r.prazos, r.troco_previsto));
    if (!data || data.length < 1000) break;
  }
}

const s = (n: number) => z.string().max(n).nullable().optional();
const clienteIn = z.object({
  cpf: z.string().regex(/^(\d{11})?$/),
  nome: z.string().min(1).max(200),
  status: z.string().max(120).nullable(),
  cod_ordem: z.string().max(60),
  saldo: z.number().nullable(),
  parcela: z.number().nullable(),
  reserva: z.number().nullable(),
  qtd_contratos: z.number().int().nullable(),
  pagas: z.number().int().nullable(),
  abertas: z.number().int().nullable(),
  plano: z.number().int().nullable(),
  prazos: z.record(z.object({ bruto: z.number().nullable(), troco: z.number().nullable() })),
  matricula: s(40),
  perfil: s(60),
  ritmo: s(40),
  competencia: s(80),
  banco_previsto: s(120),
  credito_previsto: z.number().nullable().optional(),
  troco_previsto: z.number().nullable().optional(),
  contratos: z.array(z.object({
    banco: z.string().max(120), contrato: z.string().max(160), tipo: z.string().max(40), parcelas: z.string().max(20),
    restantes: z.number().nullable(), parcela: z.number().nullable(), saldo: z.number().nullable(),
  })).max(100).optional(),
  formato: z.enum(["calculados", "oportunidades"]).optional(),
});

async function isAdmin(supabase: any, userId: string) {
  const { data } = await supabase.rpc("has_role", { _user_id: userId, _role: "admin" });
  return !!data;
}

export const quitacaoMeuPerfil = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => ({ admin: await isAdmin(context.supabase, context.userId) }));

export const quitacaoListar = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ produto: produtoZ }).parse(d ?? {}))
  .handler(async ({ context, data: input }) => {
    const admin = await isAdmin(context.supabase, context.userId);
    const out: QuitacaoCliente[] = [];
    for (let from = 0; ; from += 1000) {
      let q = context.supabase
        .from("quitacao_clientes")
        .select("*")
        .eq("produto", input.produto)
        .is("removido_em", null)
        .range(from, from + 999);
      if (!admin) q = q.eq("consultant_id", context.userId);
      const { data, error } = await q;
      if (error) throw new Error(error.message);
      out.push(...((data ?? []) as unknown as QuitacaoCliente[]));
      if (!data || data.length < 1000) break;
    }
    let consultoras: { id: string; email: string }[] = [];
    let lotes: { id: string; nome: string; total: number; created_at: string }[] = [];
    if (admin) {
      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
      const { listConsultantUsers } = await import("./prospeccao.server");
      consultoras = await listConsultantUsers(supabaseAdmin);
      const { data } = await context.supabase.from("quitacao_lotes").select("id,nome,total,created_at").eq("produto", input.produto).order("created_at", { ascending: false });
      lotes = (data ?? []) as typeof lotes;
    }
    return { admin, clientes: out, consultoras, lotes };
  });

export const quitacaoImportar = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({
    nome: z.string().min(1).max(200), clientes: z.array(clienteIn).max(20000), distribuir: z.boolean(), produto: produtoZ, modo: modoZ,
  }).parse(d))
  .handler(async ({ context, data }) => {
    const { assertAdmin, listConsultantUsers } = await import("./prospeccao.server");
    await assertAdmin(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { NG, prioridadeNg } = await import("./ng-roteiro");
    const ng = data.produto === "ng";

    const { data: lote, error: le } = await supabaseAdmin
      .from("quitacao_lotes")
      .insert({ nome: data.nome, total: data.clientes.length, created_by: context.userId, produto: data.produto } as any)
      .select("id")
      .single();
    if (le) throw new Error(le.message);

    // Existentes: mantém consultora e resultado
    const existentes = new Map<string, { id: string; consultant_id: string | null }>();
    const cpfs = [...new Set(data.clientes.map((c) => c.cpf))];
    for (let i = 0; i < cpfs.length; i += 500) {
      const { data: ex } = await supabaseAdmin.from("quitacao_clientes").select("id,cpf,cod_ordem,consultant_id")
        .eq("produto", data.produto).in("cpf", cpfs.slice(i, i + 500));
      for (const e of ex ?? []) existentes.set(`${e.cpf}|${e.cod_ordem}`, { id: e.id, consultant_id: e.consultant_id });
    }

    const consultoras = data.distribuir ? await listConsultantUsers(supabaseAdmin) : [];
    const aloc = criarAlocador(consultoras.map((c) => c.id), data.modo);
    if (consultoras.length) await cargaAtual(supabaseAdmin, data.produto, aloc);

    let novos = 0, atualizados = 0, foraRoteiro = 0;
    const agora = new Date().toISOString();
    const base = data.clientes.map((c) => {
      const troco = trocoDe(c.prazos, c.troco_previsto);
      const apto = !ng || troco >= NG.trocoMinimo;
      if (!apto) foraRoteiro++;
      return { c, troco, apto };
    });
    // Maior troco primeiro, para o equilíbrio por valor funcionar.
    base.sort((a, b) => b.troco - a.troco);
    const rows = base.map(({ c, troco, apto }) => {
      const ex = existentes.get(`${c.cpf}|${c.cod_ordem}`);
      if (ex) atualizados++; else novos++;
      return {
        ...c,
        produto: data.produto,
        apto_roteiro: apto,
        prioridade: ng ? prioridadeNg(c) : null,
        lote_id: lote.id,
        importado_em: agora,
        removido_em: null,
        consultant_id: ex?.consultant_id ?? (data.distribuir && apto ? aloc.proxima(troco) : null),
      };
    });
    for (let i = 0; i < rows.length; i += 500) {
      const { error } = await supabaseAdmin.from("quitacao_clientes").upsert(rows.slice(i, i + 500) as any, { onConflict: "produto,cpf,cod_ordem" });
      if (error) throw new Error(error.message);
    }
    return { novos, atualizados, foraRoteiro };
  });

export const quitacaoExcluirLote = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ loteId: z.string().uuid() }).parse(d))
  .handler(async ({ context, data }) => {
    const { assertAdmin } = await import("./prospeccao.server");
    await assertAdmin(context.supabase, context.userId);
    const { error } = await context.supabase.from("quitacao_clientes").delete().eq("lote_id", data.loteId);
    if (error) throw new Error(error.message);
    await context.supabase.from("quitacao_lotes").delete().eq("id", data.loteId);
    return { ok: true };
  });

export const quitacaoAdminEditar = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z.object({ id: z.string().uuid(), consultant_id: z.string().uuid().nullable().optional(), remover: z.boolean().optional() }).parse(d),
  )
  .handler(async ({ context, data }) => {
    const { assertAdmin } = await import("./prospeccao.server");
    await assertAdmin(context.supabase, context.userId);
    const patch: { consultant_id?: string | null; removido_em?: string } = {};
    if (data.consultant_id !== undefined) patch.consultant_id = data.consultant_id;
    if (data.remover) patch.removido_em = new Date().toISOString();
    const { error } = await context.supabase.from("quitacao_clientes").update(patch).eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const quitacaoRegistrar = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z.object({
      id: z.string().uuid(),
      resultado: z.enum(["sem_contato", "interessado", "proposta", "fechado", "recusado"]),
      nota: z.string().max(1000).optional(),
      retorno: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().optional(),
    }).parse(d),
  )
  .handler(async ({ context, data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: c } = await supabaseAdmin.from("quitacao_clientes").select("consultant_id").eq("id", data.id).maybeSingle();
    const admin = await isAdmin(context.supabase, context.userId);
    if (!c || (!admin && c.consultant_id !== context.userId)) throw new Error("Cliente não pertence a você.");
    const agora = new Date().toISOString();
    // Fechado/recusado encerram o acompanhamento; os demais podem ter retorno agendado.
    const encerrado = data.resultado === "fechado" || data.resultado === "recusado";
    const retorno = encerrado ? null : data.retorno ? new Date(`${data.retorno}T12:00:00-03:00`).toISOString() : null;
    const patch = { resultado: data.resultado, ultimo_contato_em: agora } as {
      resultado: string; ultimo_contato_em: string; retorno_em?: string | null;
    };
    if (encerrado || data.retorno !== undefined) patch.retorno_em = retorno;
    await supabaseAdmin.from("quitacao_clientes").update(patch).eq("id", data.id);
    const { error } = await context.supabase.from("quitacao_contatos").insert({
      cliente_id: data.id, user_id: context.userId, resultado: data.resultado, nota: data.nota ?? null, retorno_em: retorno,
    });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

/** Distribui igualmente (menor fila) os clientes de quitação que estão sem consultora. */
export const quitacaoDistribuirPendentes = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ loteId: z.string().uuid().nullable().optional(), produto: produtoZ, modo: modoZ }).parse(d ?? {}))
  .handler(async ({ context, data }) => {
    const { assertAdmin, listConsultantUsers } = await import("./prospeccao.server");
    await assertAdmin(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const consultoras = await listConsultantUsers(supabaseAdmin);
    if (!consultoras.length) throw new Error("Nenhuma consultora ativa encontrada.");

    let q = supabaseAdmin.from("quitacao_clientes").select("id,prazos,troco_previsto")
      .eq("produto", data.produto).eq("apto_roteiro", true).is("removido_em", null).is("consultant_id", null).limit(20000);
    if (data.loteId) q = q.eq("lote_id", data.loteId);
    const { data: pend, error: pe } = await q;
    if (pe) throw new Error(pe.message);
    if (!pend?.length) return { atribuidos: 0, consultoras: consultoras.length };

    const aloc = criarAlocador(consultoras.map((c) => c.id), data.modo);
    await cargaAtual(supabaseAdmin, data.produto, aloc);
    const itens = pend.map((r: any) => ({ id: r.id as string, troco: trocoDe(r.prazos, r.troco_previsto) })).sort((a, b) => b.troco - a.troco);

    const porConsultora = new Map<string, string[]>();
    for (const it of itens) {
      const best = aloc.proxima(it.troco);
      if (!best) break;
      (porConsultora.get(best) ?? porConsultora.set(best, []).get(best)!).push(it.id);
    }

    let atribuidos = 0;
    for (const [uid, ids] of porConsultora) {
      for (let i = 0; i < ids.length; i += 500) {
        const slice = ids.slice(i, i + 500);
        const { error } = await supabaseAdmin.from("quitacao_clientes").update({ consultant_id: uid }).in("id", slice);
        if (error) throw new Error(error.message);
        atribuidos += slice.length;
      }
    }
    return { atribuidos, consultoras: porConsultora.size };
  });

/** Redistribui igualmente clientes sem contato há X dias (opcionalmente de uma consultora). */
export const quitacaoRedistribuir = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({
    diasSemContato: z.number().int().min(0).max(365), deConsultora: z.string().uuid().nullable().optional(), produto: produtoZ, modo: modoZ,
  }).parse(d))
  .handler(async ({ context, data }) => {
    const { assertAdmin, listConsultantUsers } = await import("./prospeccao.server");
    await assertAdmin(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const consultoras = await listConsultantUsers(supabaseAdmin);
    if (!consultoras.length) throw new Error("Nenhuma consultora ativa encontrada.");

    const corte = new Date(Date.now() - data.diasSemContato * 86400_000).toISOString();
    let q = supabaseAdmin
      .from("quitacao_clientes").select("id,consultant_id,ultimo_contato_em,importado_em,prazos,troco_previsto")
      .eq("produto", data.produto).is("removido_em", null).not("consultant_id", "is", null)
      .in("resultado", ["novo", "sem_contato"]).limit(20000);
    if (data.produto === "ng") q = q.in("etapa", ["novo", "contatado"]);
    if (data.deConsultora) q = q.eq("consultant_id", data.deConsultora);
    const { data: rows, error } = await q;
    if (error) throw new Error(error.message);

    const alvo = (rows ?? []).filter((r: any) => (r.ultimo_contato_em ?? r.importado_em) <= corte)
      .map((r: any) => ({ ...r, troco: trocoDe(r.prazos, r.troco_previsto) })).sort((a: any, b: any) => b.troco - a.troco);
    if (!alvo.length) return { movidos: 0 };

    const aloc = criarAlocador(consultoras.map((c) => c.id), data.modo);
    await cargaAtual(supabaseAdmin, data.produto, aloc);
    for (const r of alvo) aloc.descarregar(r.consultant_id, r.troco);

    const porConsultora = new Map<string, string[]>();
    let movidos = 0;
    for (const r of alvo) {
      const best = aloc.proxima(r.troco, r.consultant_id);
      if (!best) continue;
      (porConsultora.get(best) ?? porConsultora.set(best, []).get(best)!).push(r.id);
    }
    for (const [uid, ids] of porConsultora) {
      for (let i = 0; i < ids.length; i += 500) {
        const slice = ids.slice(i, i + 500);
        const { error: ue } = await supabaseAdmin.from("quitacao_clientes").update({ consultant_id: uid }).in("id", slice);
        if (ue) throw new Error(ue.message);
        movidos += slice.length;
      }
    }
    return { movidos };
  });

/** Andamento da proposta NG: etapa, checklist do roteiro e valores simulados. */
export const quitacaoNgAtualizar = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({
    id: z.string().uuid(),
    etapa: z.enum(["novo", "contatado", "interessado", "documentos", "digitada", "validacao", "liberada", "recusada"]).optional(),
    checklist: z.record(z.boolean()).optional(),
    troco_simulado: z.number().min(0).max(1_000_000).nullable().optional(),
    taxa_simulada: z.string().max(20).nullable().optional(),
    nota: z.string().max(1000).optional(),
    retorno: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().optional(),
  }).parse(d))
  .handler(async ({ context, data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { previsaoLiberacao } = await import("./ng-roteiro");
    const { data: c } = await supabaseAdmin.from("quitacao_clientes").select("consultant_id,etapa,liberacao_prevista").eq("id", data.id).maybeSingle();
    const admin = await isAdmin(context.supabase, context.userId);
    if (!c || (!admin && c.consultant_id !== context.userId)) throw new Error("Cliente não pertence a você.");
    const agora = new Date().toISOString();
    const patch: Record<string, unknown> = {};
    if (data.checklist) patch.checklist = data.checklist;
    if (data.troco_simulado !== undefined) patch.troco_simulado = data.troco_simulado;
    if (data.taxa_simulada !== undefined) patch.taxa_simulada = data.taxa_simulada;
    const encerrada = data.etapa === "liberada" || data.etapa === "recusada";
    const retorno = encerrada ? null : data.retorno ? new Date(`${data.retorno}T12:00:00-03:00`).toISOString() : undefined;
    if (data.etapa) {
      patch.etapa = data.etapa;
      patch.ultimo_contato_em = agora;
      patch.resultado = data.etapa === "liberada" ? "fechado" : data.etapa === "recusada" ? "recusado"
        : ["digitada", "validacao", "documentos"].includes(data.etapa) ? "proposta" : data.etapa === "interessado" ? "interessado" : "sem_contato";
      if ((data.etapa === "digitada" || data.etapa === "validacao") && !c.liberacao_prevista) patch.liberacao_prevista = previsaoLiberacao().toISOString();
      if (retorno !== undefined) patch.retorno_em = retorno;
    }
    const { error } = await supabaseAdmin.from("quitacao_clientes").update(patch as any).eq("id", data.id);
    if (error) throw new Error(error.message);
    if (data.etapa) {
      await context.supabase.from("quitacao_contatos").insert({
        cliente_id: data.id, user_id: context.userId, resultado: String(patch.resultado), etapa: data.etapa,
        nota: data.nota ?? null, retorno_em: retorno ?? null,
      } as any);
    }
    return { ok: true, liberacao_prevista: (patch.liberacao_prevista as string | undefined) ?? c.liberacao_prevista };
  });

export const quitacaoTelefones = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ cpf: z.string().regex(/^(\d{11})?$/), matricula: z.string().max(40).optional() }).parse(d))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const set = new Set<string>();
    const add = (v: unknown) => {
      const d = String(v ?? "").replace(/\D/g, "").replace(/^55(?=\d{10,11}$)/, "");
      if (d.length === 10 || d.length === 11) set.add(d);
    };
    const jobs: PromiseLike<any>[] = [];
    if (data.cpf) {
      const fmt = `${data.cpf.slice(0, 3)}.${data.cpf.slice(3, 6)}.${data.cpf.slice(6, 9)}-${data.cpf.slice(9)}`;
      jobs.push(supabaseAdmin.from("prospect_leads").select("telefone,telefones").in("cpf", [data.cpf, fmt]).limit(10));
      jobs.push(supabaseAdmin.from("tomadores_al").select("telefones").in("documento", [data.cpf, fmt]).limit(10));
    }
    if (data.matricula) {
      const m = data.matricula.trim();
      const semDv = m.split("-")[0].replace(/\D/g, "");
      const vals = [...new Set([m, semDv, m.replace(/\D/g, "")].filter(Boolean))];
      jobs.push(supabaseAdmin.from("tomadores_al").select("telefones").in("matricula", vals).limit(10));
    }
    const res = await Promise.all(jobs);
    for (const r of res) for (const row of (r.data ?? []) as any[]) { add(row.telefone); (row.telefones ?? []).forEach(add); }
    return { telefones: [...set].slice(0, 8) };
  });

/** Telefones de vários clientes de uma vez, para os atalhos de contato nos cards. */
export const quitacaoTelefonesLote = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z.object({
      itens: z.array(z.object({
        id: z.string().uuid(),
        cpf: z.string().regex(/^(\d{11})?$/),
        matricula: z.string().max(40).nullable().optional(),
      })).max(300),
    }).parse(d),
  )
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const limpar = (v: unknown) => {
      const d = String(v ?? "").replace(/\D/g, "").replace(/^55(?=\d{10,11}$)/, "");
      return d.length === 10 || d.length === 11 ? d : null;
    };
    const fmtCpf = (c: string) => `${c.slice(0, 3)}.${c.slice(3, 6)}.${c.slice(6, 9)}-${c.slice(9)}`;
    const matVals = (m: string) => [...new Set([m.trim(), m.split("-")[0].replace(/\D/g, ""), m.replace(/\D/g, "")].filter(Boolean))];

    const cpfs = [...new Set(data.itens.map((i) => i.cpf).filter(Boolean))];
    const mats = [...new Set(data.itens.flatMap((i) => (i.matricula ? matVals(i.matricula) : [])))];
    const cpfKeys = cpfs.flatMap((c) => [c, fmtCpf(c)]);

    const porCpf = new Map<string, Set<string>>();
    const porMat = new Map<string, Set<string>>();
    const push = (map: Map<string, Set<string>>, k: string, tels: unknown[]) => {
      const key = k.replace(/\D/g, "");
      if (!key) return;
      const set = map.get(key) ?? new Set<string>();
      for (const t of tels) { const v = limpar(t); if (v) set.add(v); }
      if (set.size) map.set(key, set);
    };

    for (let i = 0; i < cpfKeys.length; i += 400) {
      const slice = cpfKeys.slice(i, i + 400);
      const [leads, tom] = await Promise.all([
        supabaseAdmin.from("prospect_leads").select("cpf,telefone,telefones").in("cpf", slice).limit(2000),
        supabaseAdmin.from("tomadores_al").select("documento,telefones").in("documento", slice).limit(2000),
      ]);
      for (const r of (leads.data ?? []) as any[]) push(porCpf, String(r.cpf ?? ""), [r.telefone, ...(r.telefones ?? [])]);
      for (const r of (tom.data ?? []) as any[]) push(porCpf, String(r.documento ?? ""), r.telefones ?? []);
    }
    for (let i = 0; i < mats.length; i += 400) {
      const { data: rows } = await supabaseAdmin
        .from("tomadores_al").select("matricula,telefones").in("matricula", mats.slice(i, i + 400)).limit(2000);
      for (const r of (rows ?? []) as any[]) push(porMat, String(r.matricula ?? ""), r.telefones ?? []);
    }

    const out: Record<string, string[]> = {};
    for (const it of data.itens) {
      const set = new Set<string>();
      if (it.cpf) for (const t of porCpf.get(it.cpf) ?? []) set.add(t);
      if (it.matricula) for (const m of matVals(it.matricula)) for (const t of porMat.get(m.replace(/\D/g, "")) ?? []) set.add(t);
      if (set.size) out[it.id] = [...set].slice(0, 4);
    }
    return { telefones: out };
  });
