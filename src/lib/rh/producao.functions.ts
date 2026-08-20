// Server functions for produção mensal.
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { mesAtual, producaoInputItem } from "./producao.utils";

export type ProducaoRow = {
  id: string;
  consultora: string;
  departamento: string | null;
  mes: string;
  valor: number;
  contratos: number;
  created_at: string;
  updated_at: string;
};



export const fetchMesesFn = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async (): Promise<string[]> => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data, error } = await supabaseAdmin
      .from("rh_producao")
      .select("mes")
      .order("mes", { ascending: false });
    if (error) throw new Error(error.message);
    const set = new Set<string>((data ?? []).map((r: any) => r.mes as string));
    set.add(mesAtual());
    return Array.from(set).sort().reverse();
  });

export const fetchProducaoMesFn = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ mes: z.string().min(1).max(7) }).parse(d))
  .handler(async ({ data }): Promise<ProducaoRow[]> => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: rows, error } = await supabaseAdmin
      .from("rh_producao")
      .select("*")
      .eq("mes", data.mes)
      .order("valor", { ascending: false });
    if (error) throw new Error(error.message);
    return (rows ?? []) as ProducaoRow[];
  });

export const fetchProducaoConsultoraFn = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ consultora: z.string().min(1).max(160) }).parse(d))
  .handler(async ({ data }): Promise<ProducaoRow[]> => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: rows, error } = await supabaseAdmin
      .from("rh_producao")
      .select("*")
      .eq("consultora", data.consultora)
      .order("mes", { ascending: false });
    if (error) throw new Error(error.message);
    return (rows ?? []) as ProducaoRow[];
  });


export const upsertProducaoFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => producaoInputItem.parse(d))
  .handler(async ({ data, context }): Promise<{ ok: true }> => {
    const { assertAdmin } = await import("./producao.server");
    await assertAdmin(context.supabase, context.userId);

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.from("rh_producao").upsert(
      {
        consultora: data.consultora,
        departamento: data.departamento ?? null,
        mes: data.mes,
        valor: data.valor,
        contratos: data.contratos,
        created_by: context.userId,
      },
      { onConflict: "consultora,mes" },
    );
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const upsertProducaoBatchFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ items: z.array(producaoInputItem).min(1).max(2000) }).parse(d))
  .handler(async ({ data, context }): Promise<{ ok: true }> => {
    const { assertAdmin } = await import("./producao.server");
    await assertAdmin(context.supabase, context.userId);

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.from("rh_producao").upsert(
      data.items.map((input) => ({
        consultora: input.consultora,
        departamento: input.departamento ?? null,
        mes: input.mes,
        valor: input.valor,
        contratos: input.contratos,
        created_by: context.userId,
      })),
      { onConflict: "consultora,mes" },
    );
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const deleteProducaoFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }): Promise<{ ok: true }> => {
    const { assertAdmin } = await import("./producao.server");
    await assertAdmin(context.supabase, context.userId);

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.from("rh_producao").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
