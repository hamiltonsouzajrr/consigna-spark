// Conteúdo gerenciável do Portal do Colaborador.
// Leitura: qualquer usuário autenticado. Escrita: apenas administradores (has_role).

import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

async function assertAdmin(supabase: any, userId: string) {
  const { data, error } = await supabase.rpc("has_role", { _user_id: userId, _role: "admin" });
  if (error) throw new Error(error.message);
  if (!data) throw new Error("Acesso restrito a administradores.");
}

export type Aviso = {
  id: string;
  titulo: string;
  quando: string | null;
  tone: string;
  icon: string;
  sort: number;
};
export type Atalho = { id: string; label: string; icon: string; sort: number };
export type PortalKpis = {
  id: string;
  saldo_ferias: number;
  banco_horas: number;
  salario: number;
  beneficios: number;
  trein_total: number;
  trein_concluidos: number;
};

export type PortalContent = {
  isAdmin: boolean;
  avisos: Aviso[];
  atalhos: Atalho[];
  kpis: PortalKpis | null;
};

export const getPortalContent = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<PortalContent> => {
    const { supabase, userId } = context;

    const { data: isAdmin } = await supabase.rpc("has_role", { _user_id: userId, _role: "admin" });

    const [avisosRes, atalhosRes, kpisRes] = await Promise.all([
      supabase.from("rh_portal_avisos").select("id, titulo, quando, tone, icon, sort").order("sort"),
      supabase.from("rh_portal_atalhos").select("id, label, icon, sort").order("sort"),
      supabase.from("rh_portal_kpis").select("*").order("created_at").limit(1).maybeSingle(),
    ]);

    return {
      isAdmin: !!isAdmin,
      avisos: (avisosRes.data ?? []) as Aviso[],
      atalhos: (atalhosRes.data ?? []) as Atalho[],
      kpis: (kpisRes.data ?? null) as PortalKpis | null,
    };
  });

const avisoSchema = z.object({
  id: z.string().uuid().optional(),
  titulo: z.string().min(1).max(160),
  quando: z.string().max(120).optional().nullable(),
  tone: z.string().min(1).max(20),
  icon: z.string().min(1).max(40),
  sort: z.number().int().min(0).max(999).optional(),
});

export const saveAviso = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => avisoSchema.parse(d))
  .handler(async ({ context, data }): Promise<{ ok: true }> => {
    await assertAdmin(context.supabase, context.userId);
    const row = { titulo: data.titulo, quando: data.quando ?? null, tone: data.tone, icon: data.icon, sort: data.sort ?? 0 };
    const q = data.id
      ? context.supabase.from("rh_portal_avisos").update(row).eq("id", data.id)
      : context.supabase.from("rh_portal_avisos").insert(row);
    const { error } = await q;
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const deleteAviso = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ context, data }): Promise<{ ok: true }> => {
    await assertAdmin(context.supabase, context.userId);
    const { error } = await context.supabase.from("rh_portal_avisos").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

const atalhoSchema = z.object({
  id: z.string().uuid().optional(),
  label: z.string().min(1).max(80),
  icon: z.string().min(1).max(40),
  sort: z.number().int().min(0).max(999).optional(),
});

export const saveAtalho = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => atalhoSchema.parse(d))
  .handler(async ({ context, data }): Promise<{ ok: true }> => {
    await assertAdmin(context.supabase, context.userId);
    const row = { label: data.label, icon: data.icon, sort: data.sort ?? 0 };
    const q = data.id
      ? context.supabase.from("rh_portal_atalhos").update(row).eq("id", data.id)
      : context.supabase.from("rh_portal_atalhos").insert(row);
    const { error } = await q;
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const deleteAtalho = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ context, data }): Promise<{ ok: true }> => {
    await assertAdmin(context.supabase, context.userId);
    const { error } = await context.supabase.from("rh_portal_atalhos").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

const kpisSchema = z.object({
  saldo_ferias: z.number().int().min(0).max(365),
  banco_horas: z.number().int().min(-999).max(999),
  salario: z.number().min(0).max(10_000_000),
  beneficios: z.number().int().min(0).max(99),
  trein_total: z.number().int().min(0).max(999),
  trein_concluidos: z.number().int().min(0).max(999),
});

export const saveKpis = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => kpisSchema.parse(d))
  .handler(async ({ context, data }): Promise<{ ok: true }> => {
    await assertAdmin(context.supabase, context.userId);
    // Mantém uma única linha de configuração.
    const { data: existing } = await context.supabase
      .from("rh_portal_kpis").select("id").order("created_at").limit(1).maybeSingle();
    const q = existing?.id
      ? context.supabase.from("rh_portal_kpis").update(data).eq("id", existing.id)
      : context.supabase.from("rh_portal_kpis").insert(data);
    const { error } = await q;
    if (error) throw new Error(error.message);
    return { ok: true };
  });
