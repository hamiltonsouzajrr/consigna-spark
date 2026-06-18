// Server functions for the "Recém promovidos" area inside the CRM.
// - getPromovidos: authenticated; lists promoted people (most recent first).
// - savePromovidos: admin-only; bulk-inserts reviewed entries from a PDF.
// - deletePromovido: admin-only; removes a single entry.

import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

async function assertAdmin(supabase: any, userId: string) {
  const { data, error } = await supabase.rpc("has_role", {
    _user_id: userId,
    _role: "admin",
  });
  if (error) throw new Error(error.message);
  if (!data) throw new Error("Acesso restrito a administradores.");
}

export type Promovido = {
  id: string;
  nome: string;
  cpf: string;
  cargo: string;
  mes_referencia: string;
  created_at: string;
};

export const getPromovidos = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<Promovido[]> => {
    const { supabase } = context;
    const { data, error } = await supabase
      .from("promovidos")
      .select("id,nome,cpf,cargo,mes_referencia,created_at")
      .order("mes_referencia", { ascending: false })
      .order("nome", { ascending: true })
      .limit(2000);
    if (error) throw new Error(error.message);
    return (data ?? []) as Promovido[];
  });

const entry = z.object({
  nome: z.string().trim().min(1).max(200),
  cpf: z.string().trim().min(1).max(20),
  cargo: z.string().trim().min(1).max(160),
});

export const savePromovidos = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) =>
    z
      .object({
        mes_referencia: z.string().regex(/^\d{4}-\d{2}$/, "Mês inválido (use AAAA-MM)"),
        entries: z.array(entry).min(1).max(1000),
      })
      .parse(data),
  )
  .handler(async ({ context, data }): Promise<{ inserted: number }> => {
    const { supabase, userId } = context;
    await assertAdmin(supabase, userId);

    const mesDate = `${data.mes_referencia}-01`;
    const rows = data.entries.map((e) => ({
      nome: e.nome,
      cpf: e.cpf,
      cargo: e.cargo,
      mes_referencia: mesDate,
      created_by: userId,
    }));

    const { error } = await supabase.from("promovidos").insert(rows as any);
    if (error) throw new Error(error.message);
    return { inserted: rows.length };
  });

export const deletePromovido = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => z.object({ id: z.string().uuid() }).parse(data))
  .handler(async ({ context, data }): Promise<{ ok: true }> => {
    const { supabase, userId } = context;
    await assertAdmin(supabase, userId);
    const { error } = await supabase.from("promovidos").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
