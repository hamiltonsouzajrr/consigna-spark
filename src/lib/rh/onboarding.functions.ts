// Onboarding — checklists de integração de novos colaboradores.
// Leitura: qualquer usuário autenticado. Escrita: apenas administradores (RH).

import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

async function assertAdmin(supabase: any, userId: string) {
  const { data, error } = await supabase.rpc("has_role", { _user_id: userId, _role: "admin" });
  if (error) throw new Error(error.message);
  if (!data) throw new Error("Acesso restrito a administradores.");
}

export type Tarefa = { label: string; done: boolean };

export type Onboarding = {
  id: string;
  colaborador: string;
  tarefas: Tarefa[];
};

export type OnboardingResult = {
  isAdmin: boolean;
  items: Onboarding[];
};

export const getOnboarding = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<OnboardingResult> => {
    const { supabase, userId } = context;
    const { data: isAdmin } = await supabase.rpc("has_role", { _user_id: userId, _role: "admin" });
    // Onboarding records are intentionally visible to all staff (portal feed),
    // but direct table read access is locked to admins, so we read through the
    // service-role client inside this authenticated server function.
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data, error } = await supabaseAdmin
      .from("rh_onboarding")
      .select("id, colaborador, tarefas")
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    return { isAdmin: !!isAdmin, items: (data ?? []) as Onboarding[] };
  });

const tarefaSchema = z.object({ label: z.string().min(1).max(200), done: z.boolean() });

const schema = z.object({
  id: z.string().uuid().optional(),
  colaborador: z.string().min(1).max(120),
  tarefas: z.array(tarefaSchema).max(50),
});

export const saveOnboarding = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => schema.parse(d))
  .handler(async ({ context, data }): Promise<{ ok: true }> => {
    await assertAdmin(context.supabase, context.userId);
    const row = { colaborador: data.colaborador, tarefas: data.tarefas };
    const q = data.id
      ? context.supabase.from("rh_onboarding").update(row).eq("id", data.id)
      : context.supabase.from("rh_onboarding").insert(row);
    const { error } = await q;
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const deleteOnboarding = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ context, data }): Promise<{ ok: true }> => {
    await assertAdmin(context.supabase, context.userId);
    const { error } = await context.supabase.from("rh_onboarding").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
