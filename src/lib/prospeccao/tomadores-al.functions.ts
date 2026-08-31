import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import {
  TIPO_MARGEM_COLUNA,
  faixaIntervalo,
  faixaDaMargem,
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

// Resumo da carteira de uma consultora (cards "Minha carteira" na página).
export type ResumoCarteira = {
  consultoraNome: string | null;
  pendentes: number;
  emAndamento: number;
  convertidos: number;
  semInteresse: number;
  vagasLivres: number;
};

// Linha do painel de distribuição do admin: uma consultora e o estado da carteira dela.
export type DistribuicaoConsultora = {
  nome: string;
  email: string | null;
  ativo: boolean;
  total: number;
  abertos: number;
  convertidos: number;
  semInteresse: number;
  vagasLivres: number;
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

// Dias sem contato para um lead "novo" voltar ao estoque (reciclagem).
const DIAS_RECICLAGEM = 14;
// Dias após o "sem interesse" para o tomador poder voltar ao estoque. O
// histórico do atendimento (motivo e data) é preservado no registro.
export const DIAS_SEM_INTERESSE_PADRAO = 7;

// Dias sem login para o acesso de uma consultora ser considerado inativo e
// revogado automaticamente (bloqueio reversível), liberando a carteira dela.
export const DIAS_ACESSO_INATIVO = 10;

// Recalcula o contador de cadastro a partir da base real, para o painel admin
// não mostrar número inflado depois de reposições/reciclagens.
async function recalcularContador(client: any, nome: string) {
  const { count } = await client
    .from("tomadores_al")
    .select("id", { count: "exact", head: true })
    .eq("consultora_responsavel", nome);
  await client
    .from("radar_consultoras")
    .update({ total_leads_atribuidos: Number(count ?? 0) })
    .eq("nome", nome);
}

// Devolve ao estoque tomadores marcados como "sem interesse" há mais de
// `dias`, nunca para a mesma consultora que os finalizou. Quando `previa` é
// true apenas conta quantos seriam elegíveis.
async function reciclarSemInteresseBase(
  client: any,
  opts: { dias: number; quantos: number; previa?: boolean; excluirConsultora?: string | null; faixaRange?: (q: any) => any },
): Promise<{ elegiveis: number; reciclados: number }> {
  const limite = new Date(Date.now() - Math.max(1, opts.dias) * 86400000).toISOString();
  const base = (q: any) => {
    let out = q.eq("status_abordagem", "sem_interesse").lt("finalizado_em", limite);
    if (opts.excluirConsultora) out = out.neq("consultora_responsavel", opts.excluirConsultora);
    return opts.faixaRange ? opts.faixaRange(out) : out;
  };

  const { count: elegiveis } = await base(
    client.from("tomadores_al").select("id", { count: "exact", head: true }),
  );

  if (opts.previa || opts.quantos <= 0) return { elegiveis: Number(elegiveis ?? 0), reciclados: 0 };

  const { data: alvos } = await base(client.from("tomadores_al").select("id"))
    .order("finalizado_em", { ascending: true })
    .limit(opts.quantos);
  const ids = (alvos ?? []).map((r: any) => String(r.id));
  if (!ids.length) return { elegiveis: Number(elegiveis ?? 0), reciclados: 0 };

  const { data: upd } = await client
    .from("tomadores_al")
    .update({
      consultora_responsavel: null,
      atribuido_em: null,
      status_abordagem: "novo",
      contatado_em: null,
      finalizado_em: null,
    })
    .in("id", ids)
    .eq("status_abordagem", "sem_interesse")
    .select("id");

  return { elegiveis: Number(elegiveis ?? 0), reciclados: (upd ?? []).length };
}

// Quando o estoque livre de uma faixa acaba, devolvemos ao estoque leads que
// estão parados: presos a consultoras inativas/descadastradas ou nunca
// contatados há mais de DIAS_RECICLAGEM dias. Se ainda faltar, reaproveitamos
// os "sem interesse" antigos. Assim toda consultora consegue completar as 10
// vagas de cada faixa.
async function reciclarFaixa(
  client: any,
  faixaRange: (q: any) => any,
  nome: string,
  quantos: number,
): Promise<void> {
  const { data: ativas } = await client.from("radar_consultoras").select("nome").eq("ativo", true);
  const nomesAtivos = new Set((ativas ?? []).map((c: any) => String(c.nome ?? "").trim().toLowerCase()));
  const limite = new Date(Date.now() - DIAS_RECICLAGEM * 86400000).toISOString();

  const { data: parados } = await faixaRange(
    client
      .from("tomadores_al")
      .select("id,consultora_responsavel,atribuido_em")
      .not("consultora_responsavel", "is", null)
      .neq("consultora_responsavel", nome)
      .eq("status_abordagem", "novo"),
  )
    .order("atribuido_em", { ascending: true, nullsFirst: true })
    .limit(Math.max(quantos * 20, 200));

  const candidatos = (parados ?? []).filter((r: any) => {
    const dono = String(r.consultora_responsavel ?? "").trim().toLowerCase();
    if (!nomesAtivos.has(dono)) return true; // consultora inativa ou sem cadastro
    return !r.atribuido_em || String(r.atribuido_em) < limite; // parado há muito tempo
  });

  const ids = candidatos.slice(0, quantos).map((r: any) => String(r.id));
  let liberados = 0;
  if (ids.length) {
    const { data: upd } = await client
      .from("tomadores_al")
      .update({ consultora_responsavel: null, atribuido_em: null })
      .in("id", ids)
      .eq("status_abordagem", "novo")
      .select("id");
    liberados = (upd ?? []).length;
  }

  const faltam = quantos - liberados;
  if (faltam > 0) {
    await reciclarSemInteresseBase(client, {
      dias: DIAS_SEM_INTERESSE_PADRAO,
      quantos: faltam,
      excluirConsultora: nome,
      faixaRange,
    });
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

  const buscarLivres = async () => {
    const { data } = await faixaRange(
      client
        .from("tomadores_al")
        .select("id,documento,margem_disp_emprestimo")
        .is("consultora_responsavel", null),
    )
      .order(COL_EMPRESTIMO, { ascending: false })
      .limit(Math.max(faltam * 8, 40));
    return (data ?? []) as any[];
  };

  let livres = await buscarLivres();
  if (livres.length < faltam) {
    // Estoque insuficiente nesta faixa: recicla leads parados e tenta de novo.
    await reciclarFaixa(client, faixaRange, nome, faltam - livres.length);
    livres = await buscarLivres();
  }
  if (!livres.length) return 0;

  const ids = await priorizarComTelefone(client, livres, faltam);
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
// (/api/public/hooks/tomadores-repor) e pelo painel admin.
export const reporTodasCarteiras = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<{ atribuidos: number; consultoras: number }> => {
    const admin = await isAdmin(context.supabase, context.userId);
    if (!admin) throw new Error("Apenas administradores podem executar esta ação.");
    const client = await getAdminClient();
    const { data, error } = await client.from("radar_consultoras").select("nome").eq("ativo", true);
    if (error) throw new Error(error.message);
    const nomes = (data ?? []).map((c: any) => String(c.nome ?? "").trim()).filter(Boolean);
    let atribuidos = 0;
    for (const nome of nomes) atribuidos += await garantirPoolTomadores(nome);
    return { atribuidos, consultoras: nomes.length };
  });

// Versão interna (sem auth) para o job diário.
export async function reporTodasCarteirasInterno(): Promise<{ atribuidos: number; consultoras: number }> {
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

      // Carteira exclusiva por faixa: ao entrar na aba (ou ao escolher uma
      // faixa), a consultora recebe reposição até POOL_ALVO leads em aberto
      // em cada faixa de empréstimo — a faixa escolhida é priorizada.
      const historico = data.aba === "historico";
      // Na aba Histórico não repomos nada: é só leitura dos finalizados.
      if (minha && !historico) await garantirPoolTomadores(minha, data.faixa);


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
        // Telefones vêm de enriquecimentos de outras tabelas (Nova Vida /
        // prospect_leads) que a consultora não lê por RLS — usamos o cliente
        // administrativo apenas para os CPFs já visíveis na carteira dela.
        tels = await telefonesPorCpf(
          await getAdminClient(),
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
// Ao finalizar (convertido / sem interesse), a carteira é reposta na hora com
// novos tomadores da base, priorizando a faixa de margem do lead que saiu.
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

    // Consultora só altera leads da própria carteira. Também aproveitamos a
    // leitura para descobrir a faixa de margem do lead — usada na reposição.
    let faixaLead: FaixaMargem = "media";
    if (finalizado) {
      const { data: lead } = await client
        .from("tomadores_al")
        .select("consultora_responsavel,margem_disp_emprestimo")
        .eq("id", data.id)
        .limit(1);
      const r = (lead ?? [])[0];
      if (r) {
        faixaLead = faixaDaMargem("emprestimo", r.margem_disp_emprestimo ?? 0);
        if (!admin && String(r.consultora_responsavel ?? "") !== minha) {
          throw new Error("Este lead não está na sua carteira.");
        }
      }
    }

    const patch: Record<string, unknown> = { status_abordagem: data.status };
    if (finalizado) {
      patch.finalizado_em = agora;
      if (data.status === "sem_interesse") patch.motivo_sem_interesse = data.motivo || null;
    } else {
      patch.finalizado_em = null;
      patch.motivo_sem_interesse = null;
      if (data.status === "contatado") patch.contatado_em = agora;
    }

    const { error } = await client.from("tomadores_al").update(patch as any).eq("id", data.id);
    if (error) throw new Error(error.message);

    // Reposição automática imediata: ao finalizar, novos leads da base entram
    // na carteira no mesmo instante, sem depender de recarregar a página. O
    // admin também dispara a reposição para a consultora dona do lead.
    let repostos = 0;
    if (finalizado) {
      const consultoraRepor = admin
        ? await (async () => {
            const { data: dono } = await client
              .from("tomadores_al")
              .select("consultora_responsavel")
              .eq("id", data.id)
              .limit(1);
            return (dono ?? [])[0]?.consultora_responsavel ?? null;
          })()
        : minha;
      if (consultoraRepor) {
        repostos = await garantirPoolTomadores(consultoraRepor, faixaLead);
      }
    }

    return { ok: true, repostos };
  });


// Resumo da carteira (cards "Minha carteira") para a consultora logada ou
// para uma consultora específica quando o admin está filtrando.
export const getResumoCarteiraTomadores = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => z.object({ consultora: z.string().trim().optional() }).parse(data ?? {}))
  .handler(async ({ context, data }): Promise<ResumoCarteira> => {
    const admin = await isAdmin(context.supabase, context.userId);
    const minha = await nomeConsultora(context.supabase, context.claims, !admin);
    const alvo = admin && data.consultora ? data.consultora.trim() : minha;
    if (!alvo) {
      return {
        consultoraNome: null,
        pendentes: 0,
        emAndamento: 0,
        convertidos: 0,
        semInteresse: 0,
        vagasLivres: 0,
      };
    }

    const client = await getAdminClient();
    const contar = async (status: string[]) => {
      const { count, error } = await client
        .from("tomadores_al")
        .select("id", { count: "exact", head: true })
        .eq("consultora_responsavel", alvo)
        .in("status_abordagem", status);
      if (error) return 0;
      return Number(count ?? 0);
    };

    const pendentes = await contar(["novo"]);
    const emAndamento = await contar(["contatado", "proposta_enviada"]);
    const convertidos = await contar(["convertido"]);
    const semInteresse = await contar(["sem_interesse"]);
    const abertos = pendentes + emAndamento;

    return {
      consultoraNome: alvo,
      pendentes,
      emAndamento,
      convertidos,
      semInteresse,
      vagasLivres: Math.max(0, POOL_TOTAL - abertos),
    };
  });


// Painel do admin: estado atual da distribuição e das carteiras de todas as
// consultoras cadastradas.
export const getDistribuicaoTomadoresAl = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<{
    total: number;
    semResponsavel: number;
    atribuidos: number;
    orfaos: number;
    consultoras: DistribuicaoConsultora[];
  }> => {
    const admin = await isAdmin(context.supabase, context.userId);
    if (!admin) throw new Error("Apenas administradores podem ver a distribuição.");

    const client = await getAdminClient();
    const [{ data: consultoras, error: cErr }, { data: rows, error: rErr }] = await Promise.all([
      client.from("radar_consultoras").select("nome,email,ativo").order("nome"),
      client.from("tomadores_al").select("consultora_responsavel,status_abordagem").limit(100000),
    ]);
    if (cErr) throw new Error(cErr.message);
    if (rErr) throw new Error(rErr.message);

    const mapa = new Map<string, { total: number; abertos: number; convertidos: number; semInteresse: number }>();
    let semResponsavel = 0;
    for (const r of (rows ?? []) as any[]) {
      const nome = r.consultora_responsavel ? String(r.consultora_responsavel) : null;
      if (!nome) {
        semResponsavel++;
        continue;
      }
      const cur = mapa.get(nome) ?? { total: 0, abertos: 0, convertidos: 0, semInteresse: 0 };
      cur.total++;
      if (STATUS_ABERTOS.includes(r.status_abordagem)) cur.abertos++;
      else if (r.status_abordagem === "convertido") cur.convertidos++;
      else if (r.status_abordagem === "sem_interesse") cur.semInteresse++;
      mapa.set(nome, cur);
    }

    const consultorasList = ((consultoras ?? []) as any[]).map((c) => {
      const agg = mapa.get(String(c.nome)) ?? { total: 0, abertos: 0, convertidos: 0, semInteresse: 0 };
      return {
        nome: String(c.nome),
        email: (c.email as string | null) ?? null,
        ativo: !!c.ativo,
        total: agg.total,
        abertos: agg.abertos,
        convertidos: agg.convertidos,
        semInteresse: agg.semInteresse,
        vagasLivres: Math.max(0, POOL_TOTAL - agg.abertos),
      };
    });

    const total = (rows ?? []).length;
    return {
      total,
      semResponsavel,
      atribuidos: total - semResponsavel,
      orfaos: semResponsavel,
      consultoras: consultorasList,
    };
  });


// Ação manual do admin: repõe todas as carteiras ativas de uma vez
// (10 leads por faixa para cada consultora).
export const distribuirTomadoresAl = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<{ atribuidos: number; consultoras: number }> => {
    const admin = await isAdmin(context.supabase, context.userId);
    if (!admin) throw new Error("Apenas administradores podem executar esta ação.");
    return reporTodasCarteirasInterno();
  });


// Cria o vínculo de consultoras automaticamente a partir dos acessos já
// existentes no login (admins são ignorados).
export const importarConsultorasDosAcessos = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<{ criadas: number }> => {
    const admin = await isAdmin(context.supabase, context.userId);
    if (!admin) throw new Error("Apenas administradores podem importar consultoras.");

    const client = await getAdminClient();
    const [{ data: usersData, error: uErr }, { data: roles }, { data: existentes }] = await Promise.all([
      client.auth.admin.listUsers({ page: 1, perPage: 1000 }),
      client.from("user_roles").select("user_id, role"),
      client.from("radar_consultoras").select("email"),
    ]);
    if (uErr) throw new Error(uErr.message);

    const adminIds = new Set(
      (roles ?? []).filter((r: any) => r.role === "admin").map((r: any) => String(r.user_id)),
    );
    const emailsExistentes = new Set(
      (existentes ?? [])
        .map((r: any) => String(r.email ?? "").trim().toLowerCase())
        .filter(Boolean),
    );

    let criadas = 0;
    for (const u of usersData?.users ?? []) {
      if (!u.email || u.deleted_at || adminIds.has(u.id)) continue;
      const email = String(u.email).trim().toLowerCase();
      if (!email || emailsExistentes.has(email)) continue;
      const nome = nomeDoEmail(email);
      const { error: iErr } = await client.from("radar_consultoras").insert({ nome, email, ativo: true });
      if (iErr) continue;
      emailsExistentes.add(email);
      criadas++;
    }

    return { criadas };
  });
