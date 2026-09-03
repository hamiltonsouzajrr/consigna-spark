// Admin: promovidos que nunca chegaram a nenhuma consultora (leads órfãos).
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const PRAZO_DIAS = 15;

export type LeadOrfao = {
  id: string;
  nome: string;
  cpfParcial: string | null;
  orgao: string | null;
  cargo: string | null;
  tipoMovimentacao: string | null;
  dataPromovido: string | null;
  diasParado: number;
  diasRestantes: number;
  vencido: boolean;
  criadoEm: string;
};

export type LeadsOrfaosResult = {
  total: number;
  vencidos: number;
  aVencer: number;
  itens: LeadOrfao[];
  atualizadoEm: string;
};

async function assertAdminCtx(context: any) {
  const { data } = await context.supabase.rpc("has_role", {
    _user_id: context.userId,
    _role: "admin",
  });
  if (!data) throw new Error("Acesso restrito a administradores.");
}

const dias = (de: Date, ate: Date) =>
  Math.max(0, Math.floor((ate.getTime() - de.getTime()) / 86400000));

export const getLeadsOrfaos = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) =>
    z
      .object({
        limite: z.number().int().min(10).max(500).optional(),
        apenasVencidos: z.boolean().optional(),
      })
      .parse(data ?? {}),
  )
  .handler(async ({ context, data }): Promise<LeadsOrfaosResult> => {
    await assertAdminCtx(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const db: any = supabaseAdmin;

    const { data: rows, error } = await db
      .from("do_registros")
      .select(
        "id, nome_servidor, nome_completo, cpf_parcial, orgao, orgao_lotacao, cargo, cargo_promovido, tipo_movimentacao, data_promocao, data_publicacao, created_at",
      )
      .is("consultora_responsavel", null)
      .order("data_publicacao", { ascending: true, nullsFirst: false })
      .limit(2000);
    if (error) throw new Error(error.message);

    const agora = new Date();
    const itensTodos: LeadOrfao[] = (rows ?? []).map((r: any) => {
      const base = r.data_promocao ?? r.data_publicacao ?? r.created_at;
      const dataPromovido = base ? String(base).slice(0, 10) : null;
      const ref = base ? new Date(base) : agora;
      const diasParado = dias(ref, agora);
      const diasRestantes = PRAZO_DIAS - diasParado;
      return {
        id: r.id,
        nome: r.nome_completo || r.nome_servidor || "Sem nome",
        cpfParcial: r.cpf_parcial ?? null,
        orgao: r.orgao ?? r.orgao_lotacao ?? null,
        cargo: r.cargo_promovido ?? r.cargo ?? null,
        tipoMovimentacao: r.tipo_movimentacao ?? null,
        dataPromovido,
        diasParado,
        diasRestantes,
        vencido: diasRestantes <= 0,
        criadoEm: r.created_at,
      };
    });

    const vencidos = itensTodos.filter((i) => i.vencido).length;
    const filtrados = data.apenasVencidos ? itensTodos.filter((i) => i.vencido) : itensTodos;
    const ordenados = filtrados.sort((a, b) => a.diasRestantes - b.diasRestantes);

    return {
      total: itensTodos.length,
      vencidos,
      aVencer: itensTodos.length - vencidos,
      itens: ordenados.slice(0, data.limite ?? 100),
      atualizadoEm: agora.toISOString(),
    };
  });

// Distribui imediatamente os órfãos pendentes usando o rodízio oficial do banco.
export const distribuirLeadsOrfaos = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<{ atribuidos: number; consultoras: number }> => {
    await assertAdminCtx(context);
    const { distribuirPendentes } = await import("@/lib/radar/distribuicao.server");
    const r = await distribuirPendentes(2000);
    const { logAdminAction } = await import("@/lib/admin/audit.server");
    await logAdminAction({
      actorId: context.userId,
      actorEmail: (context.claims as { email?: string } | undefined)?.email ?? null,
      action: "radar_distribuir_orfaos",
      detail: r,
    });
    return r;
  });
