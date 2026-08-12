import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

// Base "CLIENTES TOMADORES COM MARGEM - AL": mesma lógica de distribuição
// exclusiva usada no Radar (round-robin least-loaded por consultora ativa),
// garantindo que um mesmo tomador nunca caia para duas pessoas.

export type TomadorAl = {
  id: string;
  nome: string;
  documento: string;
  descricao_cargo: string | null;
  descricao_lotacao: string | null;
  orgao: string | null;
  matricula: string | null;
  dt_nascimento: string | null;
  margem_bruta_emprestimo: number | null;
  margem_bruta_cartao_credito: number | null;
  margem_disp_cartao_credito: number | null;
  margem_disp_emprestimo: number | null;
  margem_util_emprestimo: number | null;
  margem_util_cartao_credito: number | null;
  margem_util_cartao_beneficio: number | null;
  pct_utilizado_emprestimo: number | null;
  consultora_responsavel: string | null;
  status_abordagem: string;
  telefones?: string[];
};

const SELECT_COLS =
  "id,nome,documento,descricao_cargo,descricao_lotacao,orgao,matricula,dt_nascimento,margem_bruta_emprestimo,margem_bruta_cartao_credito,margem_disp_cartao_credito,margem_disp_emprestimo,margem_util_emprestimo,margem_util_cartao_credito,margem_util_cartao_beneficio,pct_utilizado_emprestimo,consultora_responsavel,status_abordagem";

// Telefones não vêm na planilha — buscamos nos enriquecimentos já feitos
// (pesquisas Nova Vida e leads de prospecção) pelo CPF do tomador.
async function telefonesPorCpf(supabase: any, docs: string[]): Promise<Record<string, string[]>> {
  const map: Record<string, Set<string>> = {};
  const add = (doc: string, tel?: string | null) => {
    const d = String(doc ?? "").replace(/\D/g, "");
    const t = String(tel ?? "").replace(/\D/g, "");
    if (!d || t.length < 10) return;
    (map[d] ??= new Set()).add(t);
  };
  if (!docs.length) return {};

  const [nv, leads] = await Promise.all([
    supabase.from("pesquisas_nv").select("documento,celular").in("documento", docs).limit(500),
    supabase.from("prospect_leads").select("cpf,telefone,telefones").in("cpf", docs).limit(500),
  ]);
  for (const r of nv.data ?? []) add(r.documento, r.celular);
  for (const r of leads.data ?? []) {
    add(r.cpf, r.telefone);
    for (const t of r.telefones ?? []) add(r.cpf, t);
  }
  return Object.fromEntries(Object.entries(map).map(([k, v]) => [k, [...v]]));
}

async function getAdminClient() {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin as any;
}

async function isAdmin(supabase: any, userId: string): Promise<boolean> {
  const { data } = await supabase.rpc("has_role", { _user_id: userId, _role: "admin" });
  return Boolean(data);
}

async function nomeConsultora(supabase: any, claims: any): Promise<string | null> {
  const email = String(claims?.email ?? "").trim().toLowerCase();
  if (!email) return null;
  const { data } = await supabase
    .from("radar_consultoras")
    .select("nome")
    .ilike("email", email)
    .limit(1);
  const nome = (data ?? [])[0]?.nome;
  return nome ? String(nome).trim() : null;
}

// Lista os tomadores. Consultora vê apenas os seus; admin vê todos e pode
// filtrar por consultora.
export const getTomadoresAl = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) =>
    z
      .object({
        offset: z.number().int().min(0).default(0),
        limit: z.number().int().min(1).max(100).default(25),
        termo: z.string().trim().default(""),
        orgao: z.string().trim().default(""),
        minMargem: z.number().min(0).default(0),
        consultora: z.string().trim().optional(),
        apenasMeus: z.boolean().default(true),
      })
      .parse(data ?? {}),
  )
  .handler(
    async ({
      context,
      data,
    }): Promise<{
      rows: TomadorAl[];
      total: number;
      consultoraNome: string | null;
      vinculada: boolean;
      isAdmin: boolean;
    }> => {
      const admin = await isAdmin(context.supabase, context.userId);
      const minha = await nomeConsultora(context.supabase, context.claims);

      let q = context.supabase
        .from("tomadores_al")
        .select(SELECT_COLS, { count: "exact" })
        .gte("margem_disp_emprestimo", data.minMargem)
        .order("margem_disp_emprestimo", { ascending: false })
        .range(data.offset, data.offset + data.limit - 1);

      if (admin) {
        if (data.consultora) q = q.eq("consultora_responsavel", data.consultora);
      } else {
        // Sem vínculo de consultora: nenhum lead.
        if (!minha) return { rows: [], total: 0, consultoraNome: null, vinculada: false, isAdmin: false };
        q = q.eq("consultora_responsavel", minha);
      }

      if (data.orgao) q = q.eq("orgao", data.orgao);
      if (data.termo) {
        const digits = data.termo.replace(/\D/g, "");
        q = digits.length >= 3 ? q.ilike("documento", `%${digits}%`) : q.ilike("nome", `%${data.termo}%`);
      }

      const { data: rows, count, error } = await q;
      if (error) throw new Error(error.message);
      return {
        rows: (rows ?? []) as TomadorAl[],
        total: count ?? 0,
        consultoraNome: minha,
        vinculada: Boolean(minha),
        isAdmin: admin,
      };
    },
  );

// Atualiza a situação de abordagem. Consultora só altera os leads dela.
export const marcarAbordagemTomador = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) =>
    z
      .object({
        id: z.string().uuid(),
        status: z.enum(["novo", "contatado", "proposta_enviada", "convertido", "sem_interesse"]),
      })
      .parse(data),
  )
  .handler(async ({ context, data }): Promise<{ ok: true }> => {
    const admin = await isAdmin(context.supabase, context.userId);
    const minha = await nomeConsultora(context.supabase, context.claims);
    if (!admin && !minha) throw new Error("Consultora não vinculada ao seu login.");

    const client = await getAdminClient();
    let upd = client
      .from("tomadores_al")
      .update({
        status_abordagem: data.status,
        contatado_em: data.status === "contatado" ? new Date().toISOString() : null,
      })
      .eq("id", data.id);
    if (!admin) upd = upd.eq("consultora_responsavel", minha);

    const { error } = await upd;
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// Distribui em rodízio (least-loaded) todos os tomadores ainda sem consultora.
export const distribuirTomadoresAl = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<{ atribuidos: number; consultoras: number }> => {
    if (!(await isAdmin(context.supabase, context.userId))) throw new Error("Apenas administradores.");

    const { data: consultoras, error: cErr } = await context.supabase
      .from("radar_consultoras")
      .select("id,nome,total_leads_atribuidos")
      .eq("ativo", true);
    if (cErr) throw new Error(cErr.message);

    const ativas = (consultoras ?? [])
      .map((c: any) => ({ id: String(c.id), nome: String(c.nome ?? "").trim(), total: Number(c.total_leads_atribuidos ?? 0) }))
      .filter((c: any) => c.nome);
    if (!ativas.length) return { atribuidos: 0, consultoras: 0 };

    const client = await getAdminClient();
    const { data: rows, error } = await client
      .from("tomadores_al")
      .select("id")
      .is("consultora_responsavel", null)
      .order("margem_disp_emprestimo", { ascending: false })
      .limit(20000);
    if (error) throw new Error(error.message);
    if (!rows?.length) return { atribuidos: 0, consultoras: ativas.length };

    const buckets = new Map<string, string[]>(ativas.map((c: any) => [c.id, [] as string[]]));
    for (const r of rows as any[]) {
      let alvo = ativas[0];
      for (const c of ativas) if (c.total < alvo.total) alvo = c;
      buckets.get(alvo.id)!.push(String(r.id));
      alvo.total += 1;
    }

    let atribuidos = 0;
    for (const c of ativas) {
      const ids = buckets.get(c.id)!;
      if (!ids.length) continue;
      for (let i = 0; i < ids.length; i += 500) {
        const { error: upErr } = await client
          .from("tomadores_al")
          .update({ consultora_responsavel: c.nome, atribuido_em: new Date().toISOString() })
          .in("id", ids.slice(i, i + 500))
          .is("consultora_responsavel", null);
        if (upErr) throw new Error(upErr.message);
      }
      const { error: cntErr } = await client
        .from("radar_consultoras")
        .update({ total_leads_atribuidos: c.total })
        .eq("id", c.id);
      if (cntErr) throw new Error(cntErr.message);
      atribuidos += ids.length;
    }

    return { atribuidos, consultoras: ativas.length };
  });
