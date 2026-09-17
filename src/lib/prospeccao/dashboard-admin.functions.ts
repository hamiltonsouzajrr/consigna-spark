import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export type PainelResumo = {
  crm: {
    total: number;
    atribuidos: number;
    sem_responsavel: number;
    trabalhados: number;
    nao_trabalhados: number;
    ganhos: number;
    perdidos: number;
    em_aberto: number;
    com_telefone: number;
    esquecidos_3d: number;
    contatados_hoje: number;
    contatados_7d: number;
    adicionados_7d: number;
    adicionados_30d: number;
  };
  por_status: Record<string, number>;
  lotes: { lote: string; total: number; trabalhados: number; ultimo_em: string | null }[];
  consultoras: {
    consultant_id: string;
    nome: string;
    email?: string;
    recebidos: number;
    trabalhados: number;
    em_aberto: number;
    ganhos: number;
  }[];
  tomadores: {
    total: number;
    atribuidos: number;
    livres: number;
    trabalhados: number;
    convertidos: number;
    sem_interesse: number;
    em_aberto: number;
  };
  promovidos: {
    total: number;
    atribuidos: number;
    livres: number;
    contatados: number;
    ultimos_15d: number;
  };
  vendas: { total: number; valor_total: number; semana: number; mes: number };
  gerado_em: string;
};

/** Resumo completo (contagens exatas) para fiscalização do painel admin. */
export const getPainelResumo = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<PainelResumo> => {
    const { supabase, userId } = context;
    const { assertAdmin } = await import("./prospeccao.server");
    await assertAdmin(supabase, userId);

    const { data, error } = await supabase.rpc("prospect_dashboard_admin" as never);
    if (error) throw new Error(error.message);
    const resumo = data as unknown as PainelResumo;

    // Completa os e-mails das consultoras (nome pode estar vazio no cadastro).
    const ids = (resumo.consultoras ?? []).map((c) => c.consultant_id).filter(Boolean);
    if (ids.length) {
      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
      const { data: users } = await supabaseAdmin.auth.admin.listUsers({ page: 1, perPage: 1000 });
      const emailById = new Map<string, string>();
      for (const u of users?.users ?? []) emailById.set(u.id, u.email ?? "");
      resumo.consultoras = resumo.consultoras.map((c) => ({
        ...c,
        email: emailById.get(c.consultant_id) ?? "",
      }));
    }

    return resumo;
  });
