// Redistribuição de leads já trabalhados e qualificados.
//
// A regra de negócio: mesmo que uma consultora já tenha trabalhado o lead
// (aberto e avançado para "qualificado" ou "proposta"), ele volta ao rodízio
// depois de um prazo (padrão 4 dias) para a base continuar circulando e não
// ficar presa com uma única pessoa. O status e o histórico (follow-ups e
// anotações) são preservados e seguem para o novo responsável.

import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export type ResultadoRedistribuicaoTrabalhados = {
  redistribuidos: number;
  perConsultant: Record<string, number>;
};

async function redistribuirTrabalhadosCore(
  supabaseAdmin: any,
  consultantIds: string[],
  dias: number,
): Promise<ResultadoRedistribuicaoTrabalhados> {
  const { assertConsultantIds, applyAssignments, reattachLeadHistory } = await import("./prospeccao.server");
  await assertConsultantIds(supabaseAdmin, consultantIds);

  const cutoff = new Date(Date.now() - Math.max(1, dias) * 86400000).toISOString();

  // Leads qualificados / em proposta que foram abertos há mais de `dias` dias
  // e seguem com a mesma consultora, sem terem fechado (ganho/perdido).
  const { data: leads, error } = await supabaseAdmin
    .from("prospect_leads")
    .select("id,consultant_id,opened_at")
    .in("status", ["qualificado", "proposta"])
    .not("consultant_id", "is", null)
    .lt("opened_at", cutoff)
    .limit(10000);
  if (error) throw new Error(error.message);

  const candidatos = (leads ?? []).filter(
    (r: any) => r.consultant_id && r.opened_at && String(r.opened_at) < cutoff,
  );
  if (!candidatos.length) return { redistribuidos: 0, perConsultant: {} };

  // Round-robin, evitando devolver o lead para a mesma consultora que já o tinha.
  const assignment = new Map<string, string>();
  let idx = 0;
  for (const l of candidatos) {
    const leadId = String(l.id);
    const dono = String(l.consultant_id);
    let alvo = consultantIds[idx % consultantIds.length];
    if (alvo === dono && consultantIds.length > 1) {
      alvo = consultantIds[(idx + 1) % consultantIds.length];
      idx += 1;
    }
    assignment.set(leadId, alvo);
    idx += 1;
  }

  const perConsultant = await applyAssignments(supabaseAdmin, assignment);
  await reattachLeadHistory(supabaseAdmin, assignment);

  // Renova a janela de trabalho: o novo responsável recebe o lead com o prazo
  // completo pela frente, sem perder o status já conquistado.
  const agora = new Date().toISOString();
  const ids = [...assignment.keys()];
  for (let i = 0; i < ids.length; i += 500) {
    const chunk = ids.slice(i, i + 500);
    const { error: uErr } = await supabaseAdmin
      .from("prospect_leads")
      .update({ opened_at: agora } as any)
      .in("id", chunk)
      .lt("opened_at", cutoff);
    if (uErr) throw new Error(uErr.message);
  }

  return { redistribuidos: assignment.size, perConsultant };
}

// Acionada pelo painel administrativo da Prospecção.
export const adminRedistributeTrabalhados = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) =>
    z
      .object({
        consultantIds: z.array(z.string().uuid()).min(1).max(100),
        dias: z.number().int().min(1).max(30).default(4),
      })
      .parse(data ?? {}),
  )
  .handler(async ({ context, data }): Promise<ResultadoRedistribuicaoTrabalhados> => {
    const { supabase, userId } = context;
    const { assertAdmin } = await import("./prospeccao.server");
    await assertAdmin(supabase, userId);

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    return redistribuirTrabalhadosCore(supabaseAdmin, data.consultantIds, data.dias);
  });

// Versão interna (sem auth) para o job agendado
// /api/public/hooks/leads-redistribuir-trabalhados.
export async function redistribuirTrabalhadosInterno(dias = 4): Promise<{
  redistribuidos: number;
  consultoras: number;
}> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { listConsultantUsers } = await import("./prospeccao.server");
  const consultoras = await listConsultantUsers(supabaseAdmin);
  if (!consultoras.length) return { redistribuidos: 0, consultoras: 0 };

  const res = await redistribuirTrabalhadosCore(
    supabaseAdmin,
    consultoras.map((c) => c.id),
    dias,
  );
  return { redistribuidos: res.redistribuidos, consultoras: consultoras.length };
}
