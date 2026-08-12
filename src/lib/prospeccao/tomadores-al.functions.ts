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

// Carteira exclusiva: cada consultora mantém no máximo POOL_ALVO leads em
// aberto. Quando ela finaliza (convertido / sem interesse), a vaga é reposta
// com novos tomadores da planilha que ainda não têm responsável.
export const POOL_ALVO = 10;
const STATUS_ABERTOS = ["novo", "contatado", "proposta_enviada"];

async function garantirPoolTomadores(nome: string): Promise<number> {
  const client = await getAdminClient();

  const { count: abertos, error: cErr } = await client
    .from("tomadores_al")
    .select("id", { count: "exact", head: true })
    .eq("consultora_responsavel", nome)
    .in("status_abordagem", STATUS_ABERTOS);
  if (cErr) return 0;

  const faltam = POOL_ALVO - Number(abertos ?? 0);
  if (faltam <= 0) return 0;

  const { data: livres, error: lErr } = await client
    .from("tomadores_al")
    .select("id")
    .is("consultora_responsavel", null)
    .order("margem_disp_emprestimo", { ascending: false })
    .limit(faltam);
  if (lErr || !livres?.length) return 0;

  const ids = (livres as any[]).map((r) => String(r.id));
  const { data: atualizados, error: uErr } = await client
    .from("tomadores_al")
    .update({ consultora_responsavel: nome, atribuido_em: new Date().toISOString() })
    .in("id", ids)
    .is("consultora_responsavel", null) // evita corrida entre duas consultoras
    .select("id");
  if (uErr) return 0;

  const novos = (atualizados ?? []).length;
  if (novos) {
    const { data: c } = await client
      .from("radar_consultoras")
      .select("id,total_leads_atribuidos")
      .eq("nome", nome)
      .limit(1);
    const alvo = (c ?? [])[0];
    if (alvo) {
      await client
        .from("radar_consultoras")
        .update({ total_leads_atribuidos: Number(alvo.total_leads_atribuidos ?? 0) + novos })
        .eq("id", alvo.id);
    }
  }
  return novos;
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

      // Carteira enxuta e exclusiva: ao entrar na aba, a consultora recebe
      // reposição automática até completar POOL_ALVO leads em aberto.
      if (minha) await garantirPoolTomadores(minha);

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

      const base = (rows ?? []) as TomadorAl[];
      let tels: Record<string, string[]> = {};
      try {
        tels = await telefonesPorCpf(
          context.supabase,
          base.map((r) => String(r.documento ?? "").replace(/\D/g, "")).filter(Boolean),
        );
      } catch {
        tels = {};
      }

      return {
        rows: base.map((r) => ({ ...r, telefones: tels[String(r.documento ?? "").replace(/\D/g, "")] ?? [] })),
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

// Completa a carteira de cada consultora ativa até POOL_ALVO leads em aberto
// (10 exclusivos). O restante da planilha fica no estoque, sem responsável,
// e é reposto automaticamente conforme os leads são finalizados.
export const distribuirTomadoresAl = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<{ atribuidos: number; consultoras: number }> => {
    if (!(await isAdmin(context.supabase, context.userId))) throw new Error("Apenas administradores.");

    const { data: consultoras, error: cErr } = await context.supabase
      .from("radar_consultoras")
      .select("id,nome")
      .eq("ativo", true);
    if (cErr) throw new Error(cErr.message);

    const nomes = (consultoras ?? [])
      .map((c: any) => String(c.nome ?? "").trim())
      .filter(Boolean);
    if (!nomes.length) return { atribuidos: 0, consultoras: 0 };

    let atribuidos = 0;
    for (const nome of nomes) atribuidos += await garantirPoolTomadores(nome);

    return { atribuidos, consultoras: nomes.length };
  });

// Painel admin: quantos tomadores cada consultora recebeu, quantos já foram
// trabalhados e quantos seguem sem responsável após a distribuição.
export type DistribuicaoConsultora = {
  id: string;
  nome: string;
  email: string | null;
  ativo: boolean;
  atribuidos: number;
  trabalhados: number;
  contador_cadastro: number;
};

export const getDistribuicaoTomadoresAl = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(
    async ({
      context,
    }): Promise<{
      total: number;
      semResponsavel: number;
      atribuidos: number;
      orfaos: number;
      consultoras: DistribuicaoConsultora[];
    }> => {
      if (!(await isAdmin(context.supabase, context.userId))) throw new Error("Apenas administradores.");
      const client = await getAdminClient();

      const { data: cs, error: cErr } = await client
        .from("radar_consultoras")
        .select("id,nome,email,ativo,total_leads_atribuidos")
        .order("nome");
      if (cErr) throw new Error(cErr.message);

      const countTomadores = async (build: (q: any) => any) => {
        const { count, error } = await build(
          client.from("tomadores_al").select("id", { count: "exact", head: true }),
        );
        if (error) throw new Error(error.message);
        return Number(count ?? 0);
      };

      const total = await countTomadores((q: any) => q);
      const semResponsavel = await countTomadores((q: any) => q.is("consultora_responsavel", null));

      const consultoras: DistribuicaoConsultora[] = [];
      for (const c of cs ?? []) {
        const nome = String(c.nome ?? "").trim();
        const atribuidos = nome
          ? await countTomadores((q: any) => q.eq("consultora_responsavel", nome))
          : 0;
        const trabalhados = nome
          ? await countTomadores((q: any) =>
              q.eq("consultora_responsavel", nome).neq("status_abordagem", "novo"),
            )
          : 0;
        consultoras.push({
          id: String(c.id),
          nome,
          email: c.email ?? null,
          ativo: Boolean(c.ativo),
          atribuidos,
          trabalhados,
          contador_cadastro: Number(c.total_leads_atribuidos ?? 0),
        });
      }

      const somaConsultoras = consultoras.reduce((a, c) => a + c.atribuidos, 0);
      const atribuidos = total - semResponsavel;
      return {
        total,
        semResponsavel,
        atribuidos,
        orfaos: Math.max(0, atribuidos - somaConsultoras),
        consultoras,
      };
    },
  );

// Resumo da carteira da consultora logada: quantidade atribuída, em andamento,
// concluídos e pendentes. Admin pode consultar a carteira de uma consultora.
export type ResumoCarteira = {
  consultoraNome: string | null;
  atribuidos: number;
  pendentes: number;
  emAndamento: number;
  concluidos: number;
  convertidos: number;
  semInteresse: number;
  vagasLivres: number;
  atualizadoEm: string;
};

export const getResumoCarteiraTomadores = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) =>
    z.object({ consultora: z.string().trim().optional() }).parse(data ?? {}),
  )
  .handler(async ({ context, data }): Promise<ResumoCarteira> => {
    const admin = await isAdmin(context.supabase, context.userId);
    const minha = await nomeConsultora(context.supabase, context.claims);
    const nome = (admin && data.consultora ? data.consultora : minha) ?? null;

    const vazio: ResumoCarteira = {
      consultoraNome: nome,
      atribuidos: 0,
      pendentes: 0,
      emAndamento: 0,
      concluidos: 0,
      convertidos: 0,
      semInteresse: 0,
      vagasLivres: POOL_ALVO,
      atualizadoEm: new Date().toISOString(),
    };
    if (!nome) return vazio;

    const client = await getAdminClient();
    const contar = async (build: (q: any) => any) => {
      const { count, error } = await build(
        client
          .from("tomadores_al")
          .select("id", { count: "exact", head: true })
          .eq("consultora_responsavel", nome),
      );
      if (error) throw new Error(error.message);
      return Number(count ?? 0);
    };

    const atribuidos = await contar((q: any) => q);
    const pendentes = await contar((q: any) => q.eq("status_abordagem", "novo"));
    const emAndamento = await contar((q: any) =>
      q.in("status_abordagem", ["contatado", "proposta_enviada"]),
    );
    const convertidos = await contar((q: any) => q.eq("status_abordagem", "convertido"));
    const semInteresse = await contar((q: any) => q.eq("status_abordagem", "sem_interesse"));

    return {
      ...vazio,
      atribuidos,
      pendentes,
      emAndamento,
      concluidos: convertidos + semInteresse,
      convertidos,
      semInteresse,
      vagasLivres: Math.max(0, POOL_ALVO - (pendentes + emAndamento)),
      atualizadoEm: new Date().toISOString(),
    };
  });
