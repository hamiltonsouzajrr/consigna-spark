// Server functions for produção mensal. Reads are available to any authenticated
// staff member (the ranking is an intentional company-wide feature) but go
// through the service-role client inside an authenticated handler so the
// underlying table's direct read access stays locked to admins. Writes assert
// the caller is an admin.
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

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

function mesAtual(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

async function assertAdmin(supabase: any, userId: string) {
  const { data, error } = await supabase.rpc("has_role", { _user_id: userId, _role: "admin" });
  if (error) throw new Error(error.message);
  if (!data) throw new Error("Acesso restrito a administradores.");
}

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

const inputItem = z.object({
  consultora: z.string().min(1).max(160),
  departamento: z.string().max(160).nullable().optional(),
  mes: z.string().min(1).max(7),
  valor: z.number(),
  contratos: z.number().int(),
});

export const upsertProducaoFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => inputItem.parse(d))
  .handler(async ({ data, context }): Promise<{ ok: true }> => {
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
  .inputValidator((d) => z.object({ items: z.array(inputItem).min(1).max(2000) }).parse(d))
  .handler(async ({ data, context }): Promise<{ ok: true }> => {
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
    await assertAdmin(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.from("rh_producao").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
