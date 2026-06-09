// Reconhecimentos (recognitions) — readable by any authenticated user,
// writable only by administrators (RH/admin). Includes an optional display
// period that makes a recognition pop up for everyone while active.

import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

async function assertAdmin(supabase: any, userId: string) {
  const { data, error } = await supabase.rpc("has_role", { _user_id: userId, _role: "admin" });
  if (error) throw new Error(error.message);
  if (!data) throw new Error("Acesso restrito a administradores.");
}

export const TIPOS = ["Trabalho em equipe", "Liderança", "Inovação", "Destaque do mês"] as const;

export type Reconhecimento = {
  id: string;
  de: string;
  para: string;
  tipo: string;
  mensagem: string;
  data: string;
  periodo_inicio: string | null;
  periodo_fim: string | null;
  popup: boolean;
};

export type ReconhecimentosResult = {
  isAdmin: boolean;
  items: Reconhecimento[];
};

export const getReconhecimentos = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<ReconhecimentosResult> => {
    const { supabase, userId } = context;
    const { data: isAdmin } = await supabase.rpc("has_role", { _user_id: userId, _role: "admin" });
    const { data, error } = await supabase
      .from("rh_reconhecimentos")
      .select("id, de, para, tipo, mensagem, data, periodo_inicio, periodo_fim, popup")
      .order("data", { ascending: false });
    if (error) throw new Error(error.message);
    return { isAdmin: !!isAdmin, items: (data ?? []) as Reconhecimento[] };
  });

const schema = z.object({
  id: z.string().uuid().optional(),
  de: z.string().min(1).max(120),
  para: z.string().min(1).max(120),
  tipo: z.string().min(1).max(60),
  mensagem: z.string().min(1).max(600),
  data: z.string().min(1),
  periodo_inicio: z.string().nullable().optional(),
  periodo_fim: z.string().nullable().optional(),
  popup: z.boolean().optional(),
});

export const saveReconhecimento = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => schema.parse(d))
  .handler(async ({ context, data }): Promise<{ ok: true }> => {
    await assertAdmin(context.supabase, context.userId);
    const row = {
      de: data.de,
      para: data.para,
      tipo: data.tipo,
      mensagem: data.mensagem,
      data: data.data,
      periodo_inicio: data.periodo_inicio || null,
      periodo_fim: data.periodo_fim || null,
      popup: data.popup ?? true,
    };
    const q = data.id
      ? context.supabase.from("rh_reconhecimentos").update(row).eq("id", data.id)
      : context.supabase.from("rh_reconhecimentos").insert(row);
    const { error } = await q;
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const deleteReconhecimento = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ context, data }): Promise<{ ok: true }> => {
    await assertAdmin(context.supabase, context.userId);
    const { error } = await context.supabase.from("rh_reconhecimentos").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
