// Portal público de acesso individual das consultoras (sem login).
// O acesso é protegido por um token único (uuid) de cada consultora — quem
// possui o link /consultora/{token} vê apenas a fila de leads atribuída a ela
// pela distribuição automática (round-robin) já existente.
//
// Estas funções são intencionalmente NÃO autenticadas: a autorização vem do
// token secreto. Cada chamada revalida o token e restringe as ações aos leads
// da consultora correspondente. Usam o client admin (service role) por dentro.

import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

export type ConsultoraLead = {
  id: string;
  nome_servidor: string;
  nome_completo: string | null;
  cpf_parcial: string | null;
  orgao: string | null;
  orgao_lotacao: string | null;
  cargo: string | null;
  cargo_atual: string | null;
  cargo_promovido: string | null;
  cargo_anterior: string | null;
  cargo_novo: string | null;
  classe_anterior: string | null;
  classe_nova: string | null;
  nivel_anterior: string | null;
  nivel_novo: string | null;
  data_promocao: string | null;
  data_publicacao: string | null;
  matricula: string | null;
  categoria: string | null;
  tipo_movimentacao: string | null;
  status_abordagem: string;
  status_revisao: string;
};

export type ConsultoraPortal = {
  ok: boolean;
  nome?: string;
  leads?: ConsultoraLead[];
};

const LEAD_COLS =
  "id,nome_servidor,nome_completo,cpf_parcial,orgao,orgao_lotacao,cargo,cargo_atual,cargo_promovido,cargo_anterior,cargo_novo,classe_anterior,classe_nova,nivel_anterior,nivel_novo,data_promocao,data_publicacao,matricula,categoria,tipo_movimentacao,status_abordagem,status_revisao";

async function resolverConsultora(admin: any, token: string): Promise<{ id: string; nome: string } | null> {
  const { data, error } = await admin
    .from("radar_consultoras")
    .select("id,nome")
    .eq("token", token)
    .limit(1);
  if (error) throw new Error(error.message);
  const c = (data ?? [])[0];
  return c ? { id: String(c.id), nome: String(c.nome) } : null;
}

// Busca a consultora pelo token e a fila de leads pendentes (não abordados e
// não revisados) atribuídos a ela. Retorna a fila completa; a UI mostra 10.
export const getConsultoraPortal = createServerFn({ method: "GET" })
  .inputValidator((data) => z.object({ token: z.string().uuid() }).parse(data))
  .handler(async ({ data }): Promise<ConsultoraPortal> => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const consultora = await resolverConsultora(supabaseAdmin, data.token);
    if (!consultora) return { ok: false };

    const { data: leads, error } = await supabaseAdmin
      .from("do_registros")
      .select(LEAD_COLS)
      .eq("consultora_responsavel", consultora.nome)
      .eq("status_abordagem", "novo")
      .eq("status_revisao", "Novo")
      .order("data_publicacao", { ascending: false })
      .limit(200);
    if (error) throw new Error(error.message);

    return { ok: true, nome: consultora.nome, leads: (leads ?? []) as ConsultoraLead[] };
  });

// Atualiza o status (abordagem e/ou revisão) de um lead da fila da consultora.
// Só permite alterar registros efetivamente atribuídos àquela consultora.
export const setConsultoraLeadStatus = createServerFn({ method: "POST" })
  .inputValidator((data) =>
    z
      .object({
        token: z.string().uuid(),
        id: z.string().uuid(),
        status_abordagem: z
          .enum(["novo", "contatado", "proposta_enviada", "convertido", "sem_interesse"])
          .optional(),
        status_revisao: z.enum(["Novo", "Revisado", "Aprovado", "Ignorado", "Duplicado"]).optional(),
      })
      .parse(data),
  )
  .handler(async ({ data }): Promise<{ ok: true }> => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const consultora = await resolverConsultora(supabaseAdmin, data.token);
    if (!consultora) throw new Error("Link inválido ou expirado.");

    const patch: Record<string, unknown> = {};
    if (data.status_abordagem) {
      patch.status_abordagem = data.status_abordagem;
      if (data.status_abordagem === "contatado") patch.contatado_em = new Date().toISOString();
    }
    if (data.status_revisao) patch.status_revisao = data.status_revisao;
    if (!Object.keys(patch).length) return { ok: true };

    const { error } = await supabaseAdmin
      .from("do_registros")
      .update(patch as any)
      .eq("id", data.id)
      .eq("consultora_responsavel", consultora.nome);
    if (error) throw new Error(error.message);

    return { ok: true };
  });
