import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import {
  TIPO_MARGEM_COLUNA,
  faixaIntervalo,
  type FaixaMargem,
  type TipoMargem,
} from "@/lib/prospeccao/margem-faixas";

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
  motivo_sem_interesse?: string | null;
  finalizado_em?: string | null;
  telefones?: string[];
};

const SELECT_COLS =
  "id,nome,documento,descricao_cargo,descricao_lotacao,orgao,matricula,dt_nascimento,margem_bruta_emprestimo,margem_bruta_cartao_credito,margem_disp_cartao_credito,margem_disp_emprestimo,margem_util_emprestimo,margem_util_cartao_credito,margem_util_cartao_beneficio,pct_utilizado_emprestimo,consultora_responsavel,status_abordagem,motivo_sem_interesse,finalizado_em";

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

function nomeDoEmail(email: string): string {
  const local = email.split("@")[0] ?? email;
  return local
    .replace(/[._-]+/g, " ")
    .replace(/\d+/g, "")
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .map((p) => p.charAt(0).toUpperCase() + p.slice(1).toLowerCase())
    .join(" ") || local;
}

// Vínculo automático: se o e-mail logado ainda não tem consultora cadastrada,
// criamos (ou adotamos, quando o nome já existe) o registro na hora, para que
// a consultora nunca fique sem carteira esperando ação do administrador.
async function nomeConsultora(_supabase: any, claims: any, autoVincular = false): Promise<string | null> {
  const email = String(claims?.email ?? "").trim().toLowerCase();
  if (!email) return null;
  const client = await getAdminClient();

  const { data } = await client.from("radar_consultoras").select("nome").ilike("email", email).limit(1);
  const nome = (data ?? [])[0]?.nome;
  if (nome) return String(nome).trim();
  if (!autoVincular) return null;

  const candidato = nomeDoEmail(email);

  // Já existe uma consultora com esse nome e sem e-mail? Vincula a ela.
  const { data: semEmail } = await client
    .from("radar_consultoras")
    .select("id,nome,email")
    .ilike("nome", candidato)
    .limit(1);
  const existente = (semEmail ?? [])[0];
  if (existente) {
    if (!existente.email) {
      await client.from("radar_consultoras").update({ email, ativo: true }).eq("id", existente.id);
      return String(existente.nome).trim();
    }
    // Nome ocupado por outro e-mail: diferencia usando o local-part completo.
  }

  const nomeFinal = existente ? `${candidato} (${email.split("@")[0]})` : candidato;
  const { data: criada, error } = await client
    .from("radar_consultoras")
    .insert({ nome: nomeFinal, email, ativo: true })
    .select("nome")
    .single();
  if (error) return null;
  return String(criada.nome).trim();
}


// Carteira exclusiva por faixa de margem: a consultora mantém até POOL_ALVO
// leads em aberto EM CADA faixa de empréstimo (alta, média e baixa), ou seja
// até 30 no total. Ao finalizar um lead, a vaga daquela faixa é reposta com
// novos tomadores da planilha que ainda não têm responsável.
export const POOL_ALVO = 10;
export const FAIXAS_POOL = ["alta", "media", "baixa"] as const;
export const POOL_TOTAL = POOL_ALVO * FAIXAS_POOL.length;
const STATUS_ABERTOS = ["novo", "contatado", "proposta_enviada"];
const STATUS_FINALIZADOS = ["convertido", "sem_interesse"];


// Prioriza a reposição por leads que já têm telefone enriquecido: sem telefone
// a consultora perde tempo antes de conseguir abordar.
async function priorizarComTelefone(client: any, candidatos: any[], faltam: number): Promise<string[]> {
  const docs = candidatos
    .map((r) => String(r.documento ?? "").replace(/\D/g, ""))
    .filter(Boolean);
  let comTel = new Set<string>();
  try {
    const mapa = await telefonesPorCpf(client, docs);
    comTel = new Set(Object.keys(mapa).filter((d) => (mapa[d] ?? []).length > 0));
  } catch {
    comTel = new Set();
  }
  const rank = (r: any) => (comTel.has(String(r.documento ?? "").replace(/\D/g, "")) ? 0 : 1);
  return [...candidatos]
    .sort((a, b) => rank(a) - rank(b) || (b.margem_disp_emprestimo ?? 0) - (a.margem_disp_emprestimo ?? 0))
    .slice(0, faltam)
    .map((r) => String(r.id));
}

const COL_EMPRESTIMO = TIPO_MARGEM_COLUNA.emprestimo;

async function bumpContador(client: any, nome: string, novos: number) {
  if (!novos) return;
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

// Completa a carteira de uma faixa específica de empréstimo até POOL_ALVO.
async function garantirPoolFaixa(nome: string, faixa: "alta" | "media" | "baixa"): Promise<number> {
  const client = await getAdminClient();
  const { gte, lt } = faixaIntervalo("emprestimo", faixa);

  const faixaRange = (q: any) => {
    let out = q.gte(COL_EMPRESTIMO, gte ?? 0);
    if (lt !== null) out = out.lt(COL_EMPRESTIMO, lt);
    return out;
  };

  const { count: abertos, error: cErr } = await faixaRange(
    client
      .from("tomadores_al")
      .select("id", { count: "exact", head: true })
      .eq("consultora_responsavel", nome)
      .in("status_abordagem", STATUS_ABERTOS),
  );
  if (cErr) return 0;

  const faltam = POOL_ALVO - Number(abertos ?? 0);
  if (faltam <= 0) return 0;

  const { data: livres, error: lErr } = await faixaRange(
    client
      .from("tomadores_al")
      .select("id,documento,margem_disp_emprestimo")
      .is("consultora_responsavel", null),
  )
    .order(COL_EMPRESTIMO, { ascending: false })
    .limit(Math.max(faltam * 8, 40));
  if (lErr || !livres?.length) return 0;

  const ids = await priorizarComTelefone(client, livres as any[], faltam);
  if (!ids.length) return 0;

  const { data: atualizados, error: uErr } = await client
    .from("tomadores_al")
    .update({ consultora_responsavel: nome, atribuido_em: new Date().toISOString() })
    .in("id", ids)
    .is("consultora_responsavel", null) // evita corrida entre duas consultoras
    .select("id");
  if (uErr) return 0;

  const novos = (atualizados ?? []).length;
  await bumpContador(client, nome, novos);
  return novos;
}

// Reposição da carteira: 10 leads em aberto por faixa (alta, média e baixa).
// Quando a consultora escolhe uma faixa na tela, priorizamos essa faixa.
async function garantirPoolTomadores(nome: string, prioridade?: FaixaMargem): Promise<number> {
  const ordem: ("alta" | "media" | "baixa")[] =
    prioridade && prioridade !== "todas"
      ? [prioridade, ...FAIXAS_POOL.filter((f) => f !== prioridade)]
      : [...FAIXAS_POOL];
  let novos = 0;
  for (const faixa of ordem) novos += await garantirPoolFaixa(nome, faixa);
  return novos;
}


// Reposição automática de todas as carteiras ativas — usada pelo job diário
// (/api/public/hooks/tomadores-repor) para não depender de a consultora abrir a aba.
export async function reporTodasCarteiras(): Promise<{ atribuidos: number; consultoras: number }> {
  const client = await getAdminClient();
  const { data, error } = await client.from("radar_consultoras").select("nome").eq("ativo", true);
  if (error) throw new Error(error.message);
  const nomes = (data ?? []).map((c: any) => String(c.nome ?? "").trim()).filter(Boolean);
  let atribuidos = 0;
  for (const nome of nomes) atribuidos += await garantirPoolTomadores(nome);
  return { atribuidos, consultoras: nomes.length };
}


// Aplica o filtro de tipo/faixa de margem sobre um builder já montado.
function aplicarFiltroMargem(
  q: any,
  tipoMargem: TipoMargem,
  faixa: FaixaMargem,
  minMargem: number,
): any {
  if (tipoMargem === "qualquer") {
    if (faixa !== "todas") {
      const partes = (Object.keys(TIPO_MARGEM_COLUNA) as Exclude<TipoMargem, "qualquer">[]).map((t) => {
        const col = TIPO_MARGEM_COLUNA[t];
        const { gte, lt } = faixaIntervalo(t, faixa);
        const conds = [`${col}.gte.${Math.max(gte ?? 0, minMargem)}`];
        if (lt !== null) conds.push(`${col}.lt.${lt}`);
        return `and(${conds.join(",")})`;
      });
      return q.or(partes.join(","));
    }
    if (minMargem > 0) {
      const partes = (Object.keys(TIPO_MARGEM_COLUNA) as Exclude<TipoMargem, "qualquer">[]).map(
        (t) => `${TIPO_MARGEM_COLUNA[t]}.gte.${minMargem}`,
      );
      return q.or(partes.join(","));
    }
    return q;
  }

  const col = TIPO_MARGEM_COLUNA[tipoMargem];
  const { gte, lt } = faixaIntervalo(tipoMargem, faixa);
  let out = q.gte(col, Math.max(gte ?? 0, minMargem));
  if (lt !== null) out = out.lt(col, lt);
  return out;
}

function colunaOrdenacao(tipoMargem: TipoMargem): string {
  return tipoMargem === "qualquer"
    ? TIPO_MARGEM_COLUNA.emprestimo
    : TIPO_MARGEM_COLUNA[tipoMargem];
}

const filtrosSchema = z.object({
  offset: z.number().int().min(0).default(0),
  limit: z.number().int().min(1).max(100).default(25),
  termo: z.string().trim().default(""),
  orgao: z.string().trim().default(""),
  minMargem: z.number().min(0).default(0),
  tipoMargem: z.enum(["emprestimo", "cartao_credito", "cartao_beneficio", "qualquer"]).default("emprestimo"),
  faixa: z.enum(["todas", "baixa", "media", "alta"]).default("todas"),
  consultora: z.string().trim().optional(),
  aba: z.enum(["carteira", "historico"]).default("carteira"),
  apenasMeus: z.boolean().default(true),
});

// Lista os tomadores. Consultora vê apenas os seus; admin vê todos e pode
// filtrar por consultora.
export const getTomadoresAl = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => filtrosSchema.parse(data ?? {}))
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
      const minha = await nomeConsultora(context.supabase, context.claims, !admin);

      // Carteira enxuta e exclusiva: ao entrar na aba, a consultora recebe
      // reposição automática até completar POOL_ALVO leads em aberto.


      const historico = data.aba === "historico";
      // Na aba Histórico não repomos nada: é só leitura dos finalizados.
      if (minha && !historico) await garantirPoolTomadores(minha);

      let q: any = context.supabase
        .from("tomadores_al")
        .select(SELECT_COLS, { count: "exact" })
        .order(colunaOrdenacao(data.tipoMargem), { ascending: false })
        .range(data.offset, data.offset + data.limit - 1);

      q = aplicarFiltroMargem(q, data.tipoMargem, data.faixa, data.minMargem);

      if (admin) {
        if (data.consultora) q = q.eq("consultora_responsavel", data.consultora);
        if (historico) q = q.in("status_abordagem", STATUS_FINALIZADOS);
      } else {
        // Sem vínculo de consultora: nenhum lead.
        if (!minha) return { rows: [], total: 0, consultoraNome: null, vinculada: false, isAdmin: false };
        q = q.eq("consultora_responsavel", minha);
        // A carteira mostra apenas leads em aberto: ao finalizar (convertido /
        // sem interesse) o lead sai da lista e o substituto do estoque aparece.
        // O histórico mostra exatamente o oposto: só os finalizados.
        q = q.in("status_abordagem", historico ? STATUS_FINALIZADOS : STATUS_ABERTOS);
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

// Contagem por faixa (baixa / média / alta) respeitando os demais filtros.
export const getContagemFaixasTomadores = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => filtrosSchema.parse(data ?? {}))
  .handler(async ({ context, data }): Promise<{ baixa: number; media: number; alta: number }> => {
    const admin = await isAdmin(context.supabase, context.userId);
    const minha = await nomeConsultora(context.supabase, context.claims, !admin);
    if (!admin && !minha) return { baixa: 0, media: 0, alta: 0 };
    const historico = data.aba === "historico";

    const contar = async (faixa: FaixaMargem): Promise<number> => {
      let q: any = context.supabase.from("tomadores_al").select("id", { count: "exact", head: true });
      q = aplicarFiltroMargem(q, data.tipoMargem, faixa, data.minMargem);
      if (admin) {
        if (data.consultora) q = q.eq("consultora_responsavel", data.consultora);
        if (historico) q = q.in("status_abordagem", STATUS_FINALIZADOS);
      } else {
        q = q
          .eq("consultora_responsavel", minha)
          .in("status_abordagem", historico ? STATUS_FINALIZADOS : STATUS_ABERTOS);
      }
      if (data.orgao) q = q.eq("orgao", data.orgao);
      if (data.termo) {
        const digits = data.termo.replace(/\D/g, "");
        q = digits.length >= 3 ? q.ilike("documento", `%${digits}%`) : q.ilike("nome", `%${data.termo}%`);
      }
      const { count, error } = await q;
      if (error) return 0;
      return Number(count ?? 0);
    };

    const [baixa, media, alta] = await Promise.all([contar("baixa"), contar("media"), contar("alta")]);
    return { baixa, media, alta };
  });


// Atualiza a situação de abordagem. Consultora só altera os leads dela.
export const marcarAbordagemTomador = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) =>
    z
      .object({
        id: z.string().uuid(),
        status: z.enum(["novo", "contatado", "proposta_enviada", "convertido", "sem_interesse"]),
        motivo: z.string().trim().max(80).optional(),
      })
      .parse(data),
  )
  .handler(async ({ context, data }): Promise<{ ok: true; repostos: number }> => {
    const admin = await isAdmin(context.supabase, context.userId);
    const minha = await nomeConsultora(context.supabase, context.claims, !admin);
    if (!admin && !minha) throw new Error("Consultora não vinculada ao seu login.");

    const agora = new Date().toISOString();
    const finalizado = data.status === "convertido" || data.status === "sem_interesse";
    const client = await getAdminClient();
    let upd = client
      .from("tomadores_al")
      .update({
        status_abordagem: data.status,
        contatado_em: data.status === "contatado" ? agora : null,
        finalizado_em: finalizado ? agora : null,
        motivo_sem_interesse: data.status === "sem_interesse" ? (data.motivo ?? null) : null,
      })
      .eq("id", data.id);
    if (!admin) upd = upd.eq("consultora_responsavel", minha);

    const { error } = await upd;
    if (error) throw new Error(error.message);


    // Ao concluir um lead (convertido / sem interesse) a vaga é reposta na hora
    // com novos tomadores do estoque, para a carteira nunca ficar vazia.
    let repostos = 0;
    if (minha && (data.status === "convertido" || data.status === "sem_interesse")) {
      repostos = await garantirPoolTomadores(minha);
    }
    return { ok: true, repostos };
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
    const minha = await nomeConsultora(context.supabase, context.claims, !admin);
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

// Resumo compacto para o Portal do Colaborador (e outros dashboards).
// Admin vê os totais da base; consultora vê a própria carteira de 10 leads.
export type ResumoTomadoresAl = {
  isAdmin: boolean;
  consultoraNome: string | null;
  ativos: number; // novo + contatado + proposta_enviada
  convertidos: number;
  semInteresse: number;
  totalAtribuidos: number;
  vagasLivres: number; // para consultora: quantos faltam para completar 10
  estoque: number; // para admin: leads sem responsável
};

export const getResumoTomadoresAl = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<ResumoTomadoresAl> => {
    const admin = await isAdmin(context.supabase, context.userId);
    const minha = await nomeConsultora(context.supabase, context.claims, !admin);
    const client = await getAdminClient();

    const vazio: ResumoTomadoresAl = {
      isAdmin: admin,
      consultoraNome: minha,
      ativos: 0,
      convertidos: 0,
      semInteresse: 0,
      totalAtribuidos: 0,
      vagasLivres: POOL_ALVO,
      estoque: 0,
    };

    const contar = async (build: (q: any) => any) => {
      const { count, error } = await build(
        client.from("tomadores_al").select("id", { count: "exact", head: true }),
      );
      if (error) throw new Error(error.message);
      return Number(count ?? 0);
    };

    if (admin) {
      const total = await contar((q) => q);
      const estoque = await contar((q) => q.is("consultora_responsavel", null));
      const ativos = await contar((q) => q.in("status_abordagem", STATUS_ABERTOS));
      const convertidos = await contar((q) => q.eq("status_abordagem", "convertido"));
      const semInteresse = await contar((q) => q.eq("status_abordagem", "sem_interesse"));
      return {
        ...vazio,
        ativos,
        convertidos,
        semInteresse,
        totalAtribuidos: total - estoque,
        vagasLivres: estoque,
        estoque,
      };
    }

    if (!minha) return vazio;

    const base = (q: any) => q.eq("consultora_responsavel", minha);
    const ativos = await contar((q) => base(q).in("status_abordagem", STATUS_ABERTOS));
    const convertidos = await contar((q) => base(q).eq("status_abordagem", "convertido"));
    const semInteresse = await contar((q) => base(q).eq("status_abordagem", "sem_interesse"));
    const totalAtribuidos = await contar(base);

    return {
      ...vazio,
      ativos,
      convertidos,
      semInteresse,
      totalAtribuidos,
      vagasLivres: Math.max(0, POOL_ALVO - ativos),
      estoque: 0,
    };
  });

// A tabela de consultoras começa vazia mesmo quando já existem vários acessos
// criados no login. Esta função importa os usuários existentes como consultoras
// (nome derivado do e-mail), ignorando admins e e-mails já cadastrados.
export const importarConsultorasDosAcessos = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(
    async ({ context }): Promise<{ criadas: number; existentes: number; ignorados: number }> => {
      if (!(await isAdmin(context.supabase, context.userId))) throw new Error("Apenas administradores.");
      const client = await getAdminClient();

      const { data: cs, error: cErr } = await client.from("radar_consultoras").select("nome,email");
      if (cErr) throw new Error(cErr.message);
      const emailsExistentes = new Set(
        (cs ?? []).map((c: any) => String(c.email ?? "").trim().toLowerCase()).filter(Boolean),
      );
      const nomesExistentes = new Set(
        (cs ?? []).map((c: any) => String(c.nome ?? "").trim().toLowerCase()).filter(Boolean),
      );

      const { data: rolesData } = await client.from("user_roles").select("user_id").eq("role", "admin");
      const adminIds = new Set((rolesData ?? []).map((r: any) => String(r.user_id)));

      const usuarios: { id: string; email: string }[] = [];
      for (let page = 1; page <= 10; page++) {
        const { data, error } = await client.auth.admin.listUsers({ page, perPage: 200 });
        if (error) throw new Error(error.message);
        const lote = data?.users ?? [];
        for (const u of lote) {
          const email = String(u.email ?? "").trim().toLowerCase();
          if (email) usuarios.push({ id: String(u.id), email });
        }
        if (lote.length < 200) break;
      }

      const nomeDoEmail = (email: string) =>
        email
          .split("@")[0]!
          .replace(/[._\-0-9]+/g, " ")
          .trim()
          .split(/\s+/)
          .filter(Boolean)
          .map((p) => p.charAt(0).toUpperCase() + p.slice(1).toLowerCase())
          .join(" ") || email;

      let criadas = 0;
      let existentes = 0;
      let ignorados = 0;

      for (const u of usuarios) {
        if (adminIds.has(u.id)) { ignorados++; continue; }
        if (emailsExistentes.has(u.email)) { existentes++; continue; }

        let nome = nomeDoEmail(u.email);
        if (nomesExistentes.has(nome.toLowerCase())) nome = `${nome} (${u.email.split("@")[0]})`;

        const { error } = await client
          .from("radar_consultoras")
          .insert({ nome, email: u.email, ativo: true });
        if (error) { ignorados++; continue; }
        emailsExistentes.add(u.email);
        nomesExistentes.add(nome.toLowerCase());
        criadas++;
      }

      return { criadas, existentes, ignorados };
    },
  );
