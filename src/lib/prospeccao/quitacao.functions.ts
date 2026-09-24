import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export type Prazo = { bruto: number | null; troco: number | null };
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
  importado_em: string;
};

const clienteIn = z.object({
  cpf: z.string().min(11).max(11),
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
  .handler(async ({ context }) => {
    const admin = await isAdmin(context.supabase, context.userId);
    const out: QuitacaoCliente[] = [];
    for (let from = 0; ; from += 1000) {
      let q = context.supabase
        .from("quitacao_clientes")
        .select("*")
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
      const { data } = await context.supabase.from("quitacao_lotes").select("id,nome,total,created_at").order("created_at", { ascending: false });
      lotes = (data ?? []) as typeof lotes;
    }
    return { admin, clientes: out, consultoras, lotes };
  });

export const quitacaoImportar = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ nome: z.string().min(1).max(200), clientes: z.array(clienteIn).max(20000), distribuir: z.boolean() }).parse(d))
  .handler(async ({ context, data }) => {
    const { assertAdmin, listConsultantUsers } = await import("./prospeccao.server");
    await assertAdmin(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: lote, error: le } = await supabaseAdmin
      .from("quitacao_lotes")
      .insert({ nome: data.nome, total: data.clientes.length, created_by: context.userId })
      .select("id")
      .single();
    if (le) throw new Error(le.message);

    // Existentes: mantém consultora e resultado
    const existentes = new Map<string, { id: string; consultant_id: string | null }>();
    const cpfs = [...new Set(data.clientes.map((c) => c.cpf))];
    for (let i = 0; i < cpfs.length; i += 500) {
      const { data: ex } = await supabaseAdmin.from("quitacao_clientes").select("id,cpf,cod_ordem,consultant_id").in("cpf", cpfs.slice(i, i + 500));
      for (const e of ex ?? []) existentes.set(`${e.cpf}|${e.cod_ordem}`, { id: e.id, consultant_id: e.consultant_id });
    }

    // Distribuição igualitária pela menor fila
    const consultoras = data.distribuir ? await listConsultantUsers(supabaseAdmin) : [];
    const fila = new Map<string, number>(consultoras.map((c) => [c.id, 0]));
    if (consultoras.length) {
      const { data: carga } = await supabaseAdmin.from("quitacao_clientes").select("consultant_id").is("removido_em", null).not("consultant_id", "is", null).limit(50000);
      for (const r of carga ?? []) if (r.consultant_id && fila.has(r.consultant_id)) fila.set(r.consultant_id, (fila.get(r.consultant_id) ?? 0) + 1);
    }
    const proxima = () => {
      let best: string | null = null;
      for (const [id, n] of fila) if (best === null || n < (fila.get(best) ?? 0)) best = id;
      if (best) fila.set(best, (fila.get(best) ?? 0) + 1);
      return best;
    };

    let novos = 0, atualizados = 0;
    const agora = new Date().toISOString();
    const rows = data.clientes.map((c) => {
      const ex = existentes.get(`${c.cpf}|${c.cod_ordem}`);
      if (ex) atualizados++; else novos++;
      return {
        ...c,
        lote_id: lote.id,
        importado_em: agora,
        removido_em: null,
        consultant_id: ex?.consultant_id ?? (data.distribuir ? proxima() : null),
      };
    });
    for (let i = 0; i < rows.length; i += 500) {
      const { error } = await supabaseAdmin.from("quitacao_clientes").upsert(rows.slice(i, i + 500) as any, { onConflict: "cpf,cod_ordem" });
      if (error) throw new Error(error.message);
    }
    return { novos, atualizados };
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
    }).parse(d),
  )
  .handler(async ({ context, data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: c } = await supabaseAdmin.from("quitacao_clientes").select("consultant_id").eq("id", data.id).maybeSingle();
    const admin = await isAdmin(context.supabase, context.userId);
    if (!c || (!admin && c.consultant_id !== context.userId)) throw new Error("Cliente não pertence a você.");
    const agora = new Date().toISOString();
    await supabaseAdmin.from("quitacao_clientes").update({ resultado: data.resultado, ultimo_contato_em: agora }).eq("id", data.id);
    const { error } = await context.supabase.from("quitacao_contatos").insert({ cliente_id: data.id, user_id: context.userId, resultado: data.resultado, nota: data.nota ?? null });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const quitacaoTelefones = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ cpf: z.string().regex(/^\d{11}$/) }).parse(d))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const fmt = `${data.cpf.slice(0, 3)}.${data.cpf.slice(3, 6)}.${data.cpf.slice(6, 9)}-${data.cpf.slice(9)}`;
    const set = new Set<string>();
    const add = (v: unknown) => {
      const d = String(v ?? "").replace(/\D/g, "").replace(/^55(?=\d{10,11}$)/, "");
      if (d.length === 10 || d.length === 11) set.add(d);
    };
    const [a, b] = await Promise.all([
      supabaseAdmin.from("prospect_leads").select("telefone,telefones").in("cpf", [data.cpf, fmt]).limit(10),
      supabaseAdmin.from("tomadores_al").select("telefones").in("cpf", [data.cpf, fmt]).limit(10),
    ]);
    for (const r of (a.data ?? []) as any[]) { add(r.telefone); (r.telefones ?? []).forEach(add); }
    for (const r of (b.data ?? []) as any[]) (r.telefones ?? []).forEach(add);
    return { telefones: [...set].slice(0, 8) };
  });
