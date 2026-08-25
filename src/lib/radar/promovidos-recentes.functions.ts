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
    } catch {
      /* silencioso: segue sem vínculo */
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
      };
    }


    const base = () => {
      let q = context.supabase.from("do_registros").select(COLS, { count: "exact" }).gte("data_publicacao", desde);
      if (nome) q = q.eq("consultora_responsavel", nome);
      return q;
    };

    let query = base();
    if (data.apenasNovos) query = query.eq("status_abordagem", "novo");

    const { data: rows, count, error } = await query
      .order("data_publicacao", { ascending: false, nullsFirst: false })
      .order("created_at", { ascending: false })
      .range(offset, offset + limit - 1);
    if (error) throw new Error(error.message);

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

    const [novosHoje, novos7d, semCpf, naoAbordados, ultimaEntrega] = await Promise.all([
      contar((q) => q.eq("data_publicacao", hoje)),
      contar((q) => q.gte("data_publicacao", diasAtras(7))),
      contar((q) => q.is("cpf_confirmado", null)),
      contar((q) => q.eq("status_abordagem", "novo")),
      ultimaEntregaQuery,
    ]);

    return {
      rows: (rows ?? []) as unknown as PromovidoRecente[],
      total: count ?? 0,
      isAdmin,
      consultoraNome: nome,
      vinculada: !isAdmin,
      novosHoje,
      novos7d,
      semCpf,
      naoAbordados,
      ultimaEntrega,
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
    return distribuirPendentes(2000);
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
    return redistribuirIgualmente(data.janelaDias ?? null, data.incluirAbordados ?? false);
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
