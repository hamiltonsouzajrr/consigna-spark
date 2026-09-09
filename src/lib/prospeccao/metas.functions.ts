// Metas semanais por consultora (definidas pelo gestor) e o progresso real da
// semana: contatos registrados, vendas confirmadas e tempo ativo no sistema.
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export type MetaValores = { meta_contatos: number; meta_vendas: number; meta_horas: number };

export type LinhaMeta = {
  user_id: string;
  nome: string;
  individual: boolean;
  meta: MetaValores;
  contatos: number;
  vendas: number;
  horas: number;
};

export type MetasSemana = {
  weekStart: string;
  padrao: MetaValores;
  /** Percentual esperado da semana já decorrido (segunda 00h → sexta 16h). */
  pctEsperado: number;
  linhas: LinhaMeta[];
  atualizadoEm: string;
};

const DIA_MS = 86_400_000;

const metaSchema = z.object({
  meta_contatos: z.number().int().min(0).max(100_000),
  meta_vendas: z.number().int().min(0).max(10_000),
  meta_horas: z.number().min(0).max(168),
});

/** Fração da semana de campanha já decorrida (0 a 1). */
function fracaoSemana(ws: string): number {
  const [y, m, d] = ws.split("-").map(Number);
  const inicio = Date.UTC(y!, (m ?? 1) - 1, d ?? 1, 3, 0, 0); // segunda 00h Maceió
  const fim = Date.UTC(y!, (m ?? 1) - 1, (d ?? 1) + 4, 19, 0, 0); // sexta 16h Maceió
  const agora = Date.now();
  if (agora <= inicio) return 0;
  if (agora >= fim) return 1;
  return (agora - inicio) / (fim - inicio);
}

export const getMetasSemana = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) =>
    z
      .object({ weekStart: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional() })
      .parse(data ?? {}),
  )
  .handler(async ({ context, data }): Promise<MetasSemana> => {
    const { assertAdmin } = await import("./prospeccao.server");
    await assertAdmin(context.supabase, context.userId);

    const { weekStart } = await import("./competicao.server");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const db: any = supabaseAdmin;

    const ws = data.weekStart ?? weekStart();
    const inicioIso = `${ws}T03:00:00.000Z`;
    const fimDia = new Date(new Date(`${ws}T12:00:00Z`).getTime() + 6 * DIA_MS)
      .toISOString()
      .slice(0, 10);

    const [perfis, admins, metasRows, padraoRow, eventos, vendas, uso] = await Promise.all([
      db.from("profiles").select("user_id,nome_completo").order("nome_completo", { ascending: true }),
      db.from("user_roles").select("user_id").eq("role", "admin"),
      db.from("prospect_metas").select("user_id,meta_contatos,meta_vendas,meta_horas"),
      db.from("prospect_metas_padrao").select("meta_contatos,meta_vendas,meta_horas").eq("id", true).maybeSingle(),
      db
        .from("lead_events")
        .select("consultant_id")
        .in("kind", ["ligacao", "whatsapp"])
        .gte("created_at", inicioIso),
      db.from("prospect_vendas").select("user_id").eq("week_start", ws).eq("status", "confirmada"),
      db.from("app_uso_ativo").select("user_id,segundos").gte("ref_date", ws).lte("ref_date", fimDia),
    ]);

    const padrao: MetaValores = {
      meta_contatos: Number(padraoRow?.data?.meta_contatos ?? 250),
      meta_vendas: Number(padraoRow?.data?.meta_vendas ?? 3),
      meta_horas: Number(padraoRow?.data?.meta_horas ?? 30),
    };

    const adminIds = new Set((admins.data ?? []).map((r: any) => r.user_id));
    const metaPorUser = new Map<string, MetaValores>();
    for (const r of metasRows.data ?? []) {
      metaPorUser.set(r.user_id, {
        meta_contatos: Number(r.meta_contatos ?? 0),
        meta_vendas: Number(r.meta_vendas ?? 0),
        meta_horas: Number(r.meta_horas ?? 0),
      });
    }

    const contar = (rows: any[], campo: string) => {
      const m = new Map<string, number>();
      for (const r of rows ?? []) {
        const k = r[campo];
        if (!k) continue;
        m.set(k, (m.get(k) ?? 0) + 1);
      }
      return m;
    };
    const contatosPorUser = contar(eventos.data ?? [], "consultant_id");
    const vendasPorUser = contar(vendas.data ?? [], "user_id");
    const segundosPorUser = new Map<string, number>();
    for (const r of uso.data ?? []) {
      segundosPorUser.set(r.user_id, (segundosPorUser.get(r.user_id) ?? 0) + Number(r.segundos ?? 0));
    }

    const linhas: LinhaMeta[] = (perfis.data ?? [])
      .filter((p: any) => !adminIds.has(p.user_id))
      .map((p: any) => ({
        user_id: p.user_id,
        nome: p.nome_completo ?? "Consultora",
        individual: metaPorUser.has(p.user_id),
        meta: metaPorUser.get(p.user_id) ?? padrao,
        contatos: contatosPorUser.get(p.user_id) ?? 0,
        vendas: vendasPorUser.get(p.user_id) ?? 0,
        horas: Math.round(((segundosPorUser.get(p.user_id) ?? 0) / 3600) * 10) / 10,
      }));

    return {
      weekStart: ws,
      padrao,
      pctEsperado: Math.round(fracaoSemana(ws) * 100),
      linhas,
      atualizadoEm: new Date().toISOString(),
    };
  });

export const salvarMetaConsultora = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => metaSchema.extend({ userId: z.string().uuid() }).parse(data))
  .handler(async ({ context, data }) => {
    const { assertAdmin } = await import("./prospeccao.server");
    await assertAdmin(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await (supabaseAdmin as any)
      .from("prospect_metas")
      .upsert(
        {
          user_id: data.userId,
          meta_contatos: data.meta_contatos,
          meta_vendas: data.meta_vendas,
          meta_horas: data.meta_horas,
        },
        { onConflict: "user_id" },
      );
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const removerMetaConsultora = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => z.object({ userId: z.string().uuid() }).parse(data))
  .handler(async ({ context, data }) => {
    const { assertAdmin } = await import("./prospeccao.server");
    await assertAdmin(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await (supabaseAdmin as any)
      .from("prospect_metas")
      .delete()
      .eq("user_id", data.userId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const salvarMetaPadrao = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => metaSchema.parse(data))
  .handler(async ({ context, data }) => {
    const { assertAdmin } = await import("./prospeccao.server");
    await assertAdmin(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await (supabaseAdmin as any)
      .from("prospect_metas_padrao")
      .upsert({ id: true, ...data }, { onConflict: "id" });
    if (error) throw new Error(error.message);
    return { ok: true };
  });
