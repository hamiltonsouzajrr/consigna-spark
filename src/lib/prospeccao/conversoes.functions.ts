// "Minha carteira — conversões": a consultora registra o cliente convertido
// (valor liberado, prazo, parcela), se restou margem e quando deve retornar.
// Registrar aqui NÃO credita pontos: cria a venda pendente para o gestor confirmar.
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export type LembreteOpcao = "nenhum" | "2s" | "3s" | "1m" | "2m" | "3m";
export type TipoMargemConversao = "emprestimo" | "cartao_credito" | "cartao_beneficio";

export const LEMBRETE_LABEL: Record<LembreteOpcao, string> = {
  nenhum: "Não lembrar",
  "2s": "Em 2 semanas",
  "3s": "Em 3 semanas",
  "1m": "Em 1 mês",
  "2m": "Daqui a 2 meses",
  "3m": "Daqui a 3 meses",
};

export const LEMBRETE_OPCOES: LembreteOpcao[] = ["nenhum", "2s", "3s", "1m", "2m", "3m"];

/** Data do lembrete a partir da opção escolhida (10h do dia alvo). */
export function dataLembrete(op: LembreteOpcao, base: Date = new Date()): string | null {
  if (op === "nenhum") return null;
  const d = new Date(base);
  if (op === "2s") d.setDate(d.getDate() + 14);
  else if (op === "3s") d.setDate(d.getDate() + 21);
  else if (op === "1m") d.setMonth(d.getMonth() + 1);
  else if (op === "2m") d.setMonth(d.getMonth() + 2);
  else if (op === "3m") d.setMonth(d.getMonth() + 3);
  d.setHours(10, 0, 0, 0);
  return d.toISOString();
}

export type Conversao = {
  id: string;
  user_id: string;
  consultora_nome: string | null;
  lead_id: string | null;
  tomador_id: string | null;
  origem: "crm" | "tomadores_al";
  cliente_nome: string;
  cpf: string | null;
  data_operacao: string;
  valor_liberado: number;
  prazo: number | null;
  valor_parcela: number | null;
  margem_restante: boolean;
  tipo_margem: TipoMargemConversao | null;
  margem_usada: number | null;
  margem_restante_valor: number | null;
  observacao: string | null;
  lembrete_em: string | null;
  venda_status: "pendente" | "confirmada" | "recusada" | null;
  created_at: string;
};

const TITULO_LEMBRETE = "Retornar ao cliente — pode ter margem nova";

const conversaoSchema = z.object({
  leadId: z.string().uuid().optional().nullable(),
  tomadorId: z.string().uuid().optional().nullable(),
  origem: z.enum(["crm", "tomadores_al"]).default("crm"),
  clienteNome: z.string().trim().min(2).max(200),
  cpf: z.string().trim().max(20).optional().nullable(),
  dataOperacao: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  valorLiberado: z.number().min(0).max(100_000_000),
  prazo: z.number().int().min(1).max(240).optional().nullable(),
  valorParcela: z.number().min(0).max(10_000_000).optional().nullable(),
  margemRestante: z.boolean(),
  tipoMargem: z.enum(["emprestimo", "cartao_credito", "cartao_beneficio"]),
  margemUsada: z.number().min(0).max(10_000_000),
  margemRestanteValor: z.number().min(0).max(10_000_000).optional().nullable(),
  observacao: z.string().trim().max(1000).optional().nullable(),
  lembrete: z.enum(["nenhum", "2s", "3s", "1m", "2m", "3m"]),
});

async function admin() {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin as any;
}

/** Lista conversões: as próprias, ou todas quando administrador/gestor. */
export const listarConversoes = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) =>
    z
      .object({
        mes: z.string().regex(/^\d{4}-\d{2}$/).optional(),
        limit: z.coerce.number().int().min(1).max(300).default(200),
      })
      .parse(data ?? {}),
  )
  .handler(async ({ context, data }): Promise<{ isAdmin: boolean; itens: Conversao[] }> => {
    const db = await admin();
    const { data: roles } = await context.supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", context.userId);
    const isAdmin = (roles ?? []).some((r: any) => r.role === "admin" || r.role === "gestor_acessos");

    let q = db
      .from("prospect_conversoes")
      .select("*")
      .order("data_operacao", { ascending: false })
      .order("created_at", { ascending: false })
      .limit(data.limit);
    if (!isAdmin) q = q.eq("user_id", context.userId);
    if (data.mes) {
      const [y, m] = data.mes.split("-").map(Number);
      const ini = `${data.mes}-01`;
      const fimDate = new Date(Date.UTC(y!, m!, 1));
      const fim = fimDate.toISOString().slice(0, 10);
      q = q.gte("data_operacao", ini).lt("data_operacao", fim);
    }
    const { data: rows, error } = await q;
    if (error) throw new Error(error.message);
    const list = (rows ?? []) as any[];
    if (!list.length) return { isAdmin, itens: [] };

    // Status da venda (aguardando/confirmada/recusada) e nome da consultora.
    const ids = list.map((r) => r.id);
    const [{ data: vendas }, { data: perfis }] = await Promise.all([
      db.from("prospect_vendas").select("ref_id,status").eq("ref_tabela", "prospect_conversoes").in("ref_id", ids),
      isAdmin
        ? db.from("profiles").select("user_id,nome_completo").in("user_id", [...new Set(list.map((r) => r.user_id))])
        : Promise.resolve({ data: [] }),
    ]);
    const statusPorRef = new Map<string, string>();
    for (const v of (vendas ?? []) as any[]) {
      const atual = statusPorRef.get(v.ref_id);
      if (atual === "confirmada") continue;
      statusPorRef.set(v.ref_id, v.status);
    }
    const nomes = new Map<string, string>();
    for (const p of (perfis ?? []) as any[]) nomes.set(p.user_id, p.nome_completo);

    return {
      isAdmin,
      itens: list.map((r) => ({
        id: r.id,
        user_id: r.user_id,
        consultora_nome: nomes.get(r.user_id) ?? null,
        lead_id: r.lead_id,
        tomador_id: r.tomador_id,
        origem: r.origem === "tomadores_al" ? "tomadores_al" : "crm",
        cliente_nome: r.cliente_nome,
        cpf: r.cpf,
        data_operacao: r.data_operacao,
        valor_liberado: Number(r.valor_liberado ?? 0),
        prazo: r.prazo,
        valor_parcela: r.valor_parcela != null ? Number(r.valor_parcela) : null,
        margem_restante: !!r.margem_restante,
        tipo_margem: r.tipo_margem,
        margem_usada: r.margem_usada != null ? Number(r.margem_usada) : null,
        margem_restante_valor: r.margem_restante_valor != null ? Number(r.margem_restante_valor) : null,
        observacao: r.observacao,
        lembrete_em: r.lembrete_em,
        venda_status: (statusPorRef.get(r.id) as Conversao["venda_status"]) ?? null,
        created_at: r.created_at,
      })),
    };
  });

/** Leads da carteira da consultora, para escolher o cliente convertido. */
export const buscarLeadsCarteira = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => z.object({ termo: z.string().trim().max(120).default("") }).parse(data ?? {}))
  .handler(async ({ context, data }) => {
    const termo = data.termo.trim();
    if (termo.length < 2) return [] as { id: string; nome: string; cpf: string | null }[];
    const digits = termo.replace(/\D/g, "");
    let q = context.supabase
      .from("prospect_leads")
      .select("id,nome,cpf")
      .eq("consultant_id", context.userId)
      .limit(10);
    q = digits.length >= 3 ? q.ilike("cpf", `%${digits}%`) : q.ilike("nome", `%${termo}%`);
    const { data: rows, error } = await q;
    if (error) throw new Error(error.message);
    return (rows ?? []) as { id: string; nome: string; cpf: string | null }[];
  });

export const criarConversao = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => conversaoSchema.parse(data))
  .handler(async ({ context, data }) => {
    const db = await admin();
    const lembreteEm = dataLembrete(data.lembrete);
    if (data.origem === "crm" && !data.leadId) throw new Error("Selecione o cliente do CRM.");
    if (data.origem === "tomadores_al" && !data.tomadorId) throw new Error("Selecione o cliente de Tomadores.");
    if (data.leadId) {
      const { data: lead } = await context.supabase.from("prospect_leads").select("id").eq("id", data.leadId).maybeSingle();
      if (!lead) throw new Error("Este cliente não está na sua carteira.");
    }
    if (data.tomadorId) {
      const { data: tomador } = await context.supabase.from("tomadores_al").select("id").eq("id", data.tomadorId).maybeSingle();
      if (!tomador) throw new Error("Este cliente não está na sua carteira.");
    }

    const { data: inserted, error } = await db
      .from("prospect_conversoes")
      .insert({
        user_id: context.userId,
        lead_id: data.leadId ?? null,
        tomador_id: data.tomadorId ?? null,
        origem: data.origem,
        cliente_nome: data.clienteNome,
        cpf: data.cpf?.replace(/\D/g, "") || null,
        data_operacao: data.dataOperacao,
        valor_liberado: data.valorLiberado,
        prazo: data.prazo ?? null,
        valor_parcela: data.valorParcela ?? null,
        margem_restante: data.margemRestante,
        tipo_margem: data.tipoMargem,
        margem_usada: data.margemUsada,
        margem_restante_valor: data.margemRestante ? (data.margemRestanteValor ?? null) : null,
        observacao: data.observacao ?? null,
        lembrete_em: lembreteEm,
      })
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    const id = inserted.id as string;

    // Venda entra como pendente: pontos só após confirmação do gestor.
    const { registrarVendaPendente } = await import("./competicao.server");
    await registrarVendaPendente(
      context.userId,
      data.origem,
      "prospect_conversoes",
      id,
      data.clienteNome,
      "Conversão registrada pela consultora",
    );

    // Lembrete: vira follow-up na agenda quando o cliente é um lead da carteira.
    if (lembreteEm && data.leadId) {
      const { data: task } = await db
        .from("lead_tasks")
        .insert({
          lead_id: data.leadId,
          consultant_id: context.userId,
          title: TITULO_LEMBRETE,
          due_at: lembreteEm,
          status: "pending",
        })
        .select("id")
        .single();
      if (task?.id) await db.from("prospect_conversoes").update({ task_id: task.id }).eq("id", id);
      await db.from("prospect_leads").update({ next_follow_up_at: lembreteEm }).eq("id", data.leadId);
    } else if (lembreteEm && data.tomadorId) {
      const { data: task } = await db.from("lead_tasks").insert({ tomador_id: data.tomadorId, consultant_id: context.userId, title: TITULO_LEMBRETE, due_at: lembreteEm, status: "pending" }).select("id").single();
      if (task?.id) await db.from("prospect_conversoes").update({ task_id: task.id }).eq("id", id);
    }

    return { id };
  });

export const atualizarConversao = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) =>
    conversaoSchema
      .omit({ lembrete: true })
      .extend({
        id: z.string().uuid(),
        lembrete: z.enum(["nenhum", "2s", "3s", "1m", "2m", "3m", "manter"]),
      })
      .parse(data),
  )
  .handler(async ({ context, data }) => {
    const db = await admin();
    const { data: atual, error: e0 } = await db
      .from("prospect_conversoes")
      .select("id,user_id,lead_id,lembrete_em,task_id")
      .eq("id", data.id)
      .maybeSingle();
    if (e0) throw new Error(e0.message);
    if (!atual) throw new Error("Conversão não encontrada");
    const { assertAdmin } = await import("./prospeccao.server");
    if (atual.user_id !== context.userId) await assertAdmin(context.supabase, context.userId);

    const lembreteEm = data.lembrete === "manter" ? atual.lembrete_em : dataLembrete(data.lembrete);
    const { error } = await db
      .from("prospect_conversoes")
      .update({
        lead_id: data.leadId ?? null,
        tomador_id: data.tomadorId ?? null,
        origem: data.origem,
        cliente_nome: data.clienteNome,
        cpf: data.cpf?.replace(/\D/g, "") || null,
        data_operacao: data.dataOperacao,
        valor_liberado: data.valorLiberado,
        prazo: data.prazo ?? null,
        valor_parcela: data.valorParcela ?? null,
        margem_restante: data.margemRestante,
        tipo_margem: data.tipoMargem,
        margem_usada: data.margemUsada,
        margem_restante_valor: data.margemRestante ? (data.margemRestanteValor ?? null) : null,
        observacao: data.observacao ?? null,
        lembrete_em: lembreteEm,
      })
      .eq("id", data.id);
    if (error) throw new Error(error.message);

    const clienteDoLembrete = data.leadId
      ? { lead_id: data.leadId, tomador_id: null }
      : data.tomadorId
        ? { lead_id: null, tomador_id: data.tomadorId }
        : null;

    if (lembreteEm && clienteDoLembrete) {
      let taskId = atual.task_id as string | null;
      if (taskId) {
        const { error: taskError } = await db
          .from("lead_tasks")
          .update({
            ...clienteDoLembrete,
            consultant_id: context.userId,
            title: TITULO_LEMBRETE,
            due_at: lembreteEm,
            status: "pending",
          })
          .eq("id", taskId);
        if (taskError) throw new Error(taskError.message);
      } else {
        const { data: task, error: taskError } = await db
          .from("lead_tasks")
          .insert({
            ...clienteDoLembrete,
            consultant_id: context.userId,
            title: TITULO_LEMBRETE,
            due_at: lembreteEm,
            status: "pending",
          })
          .select("id")
          .single();
        if (taskError) throw new Error(taskError.message);
        taskId = task.id as string;
        const { error: linkError } = await db
          .from("prospect_conversoes")
          .update({ task_id: taskId })
          .eq("id", data.id);
        if (linkError) throw new Error(linkError.message);
      }
      if (data.leadId) {
        const { error: leadError } = await db
          .from("prospect_leads")
          .update({ next_follow_up_at: lembreteEm })
          .eq("id", data.leadId);
        if (leadError) throw new Error(leadError.message);
      }
    } else if (atual.task_id) {
      const { error: taskError } = await db
        .from("lead_tasks")
        .update({ status: "canceled" })
        .eq("id", atual.task_id);
      if (taskError) throw new Error(taskError.message);
    }
    return { ok: true };
  });

export const removerConversao = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => z.object({ id: z.string().uuid() }).parse(data))
  .handler(async ({ context, data }) => {
    const db = await admin();
    const { data: atual } = await db
      .from("prospect_conversoes")
      .select("id,user_id,task_id")
      .eq("id", data.id)
      .maybeSingle();
    if (!atual) return { ok: true };
    if (atual.user_id !== context.userId) {
      const { assertAdmin } = await import("./prospeccao.server");
      await assertAdmin(context.supabase, context.userId);
    }
    const { cancelarVenda } = await import("./competicao.server");
    await cancelarVenda("prospect_conversoes", data.id, "Conversão removida pela consultora");
    if (atual.task_id) await db.from("lead_tasks").update({ status: "canceled" }).eq("id", atual.task_id);
    const { error } = await db.from("prospect_conversoes").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
