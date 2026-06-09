// Ocorrências (advertências, elogios e observações).
// Leitura completa: apenas administradores. Uma consultora vê apenas os
// elogios direcionados a ela (usado no pop-up direcionado).

import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

async function assertAdmin(supabase: any, userId: string) {
  const { data, error } = await supabase.rpc("has_role", { _user_id: userId, _role: "admin" });
  if (error) throw new Error(error.message);
  if (!data) throw new Error("Acesso restrito a administradores.");
}

export const TIPOS_OCORRENCIA = ["Elogio", "Advertência", "Observação"] as const;

export type Ocorrencia = {
  id: string;
  colaborador: string;
  para_user_id: string | null;
  tipo: string;
  data: string;
  descricao: string;
  popup: boolean;
};

export type Consultora = { user_id: string; nome: string };

export type OcorrenciasResult = {
  isAdmin: boolean;
  items: Ocorrencia[];
  consultoras: Consultora[];
};

export const getOcorrencias = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<OcorrenciasResult> => {
    const { supabase, userId } = context;
    const { data: isAdmin } = await supabase.rpc("has_role", { _user_id: userId, _role: "admin" });
    if (!isAdmin) return { isAdmin: false, items: [], consultoras: [] };

    const { data, error } = await supabase
      .from("rh_ocorrencias")
      .select("id, colaborador, para_user_id, tipo, data, descricao, popup")
      .order("data", { ascending: false });
    if (error) throw new Error(error.message);

    // Lista de consultoras (usuários) para direcionar elogios.
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: usersData } = await supabaseAdmin.auth.admin.listUsers({ page: 1, perPage: 1000 });
    const { data: emps } = await supabaseAdmin.from("rh_employees").select("full_name, user_id");
    const nameByUser = new Map<string, string>();
    for (const e of (emps ?? []) as any[]) {
      if (e.user_id) nameByUser.set(e.user_id as string, e.full_name as string);
    }
    const consultoras: Consultora[] = (usersData?.users ?? []).map((u) => ({
      user_id: u.id,
      nome: nameByUser.get(u.id) ?? u.email ?? "(sem nome)",
    }));

    return { isAdmin: true, items: (data ?? []) as Ocorrencia[], consultoras };
  });

// Pop-up direcionado: elogios da consultora autenticada marcados como pop-up.
export const getMeusElogios = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<Ocorrencia[]> => {
    const { supabase, userId } = context;
    const { data, error } = await supabase
      .from("rh_ocorrencias")
      .select("id, colaborador, para_user_id, tipo, data, descricao, popup")
      .eq("para_user_id", userId)
      .eq("tipo", "Elogio")
      .eq("popup", true)
      .order("data", { ascending: false });
    if (error) throw new Error(error.message);
    return (data ?? []) as Ocorrencia[];
  });

const schema = z.object({
  id: z.string().uuid().optional(),
  colaborador: z.string().min(1).max(120),
  para_user_id: z.string().uuid().nullable().optional(),
  tipo: z.enum(["Elogio", "Advertência", "Observação"]),
  data: z.string().min(1),
  descricao: z.string().min(1).max(1000),
  popup: z.boolean().optional(),
});

export const saveOcorrencia = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => schema.parse(d))
  .handler(async ({ context, data }): Promise<{ ok: true }> => {
    await assertAdmin(context.supabase, context.userId);
    const row = {
      colaborador: data.colaborador,
      para_user_id: data.para_user_id || null,
      tipo: data.tipo,
      data: data.data,
      descricao: data.descricao,
      popup: data.popup ?? true,
      created_by: context.userId,
    };
    const q = data.id
      ? context.supabase.from("rh_ocorrencias").update(row).eq("id", data.id)
      : context.supabase.from("rh_ocorrencias").insert(row);
    const { error } = await q;
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const deleteOcorrencia = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ context, data }): Promise<{ ok: true }> => {
    await assertAdmin(context.supabase, context.userId);
    const { error } = await context.supabase.from("rh_ocorrencias").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
