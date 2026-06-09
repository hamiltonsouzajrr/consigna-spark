// Recrutamento — vagas e candidatos.
// Leitura: qualquer usuário autenticado. Escrita: apenas administradores (RH).

import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

async function assertAdmin(supabase: any, userId: string) {
  const { data, error } = await supabase.rpc("has_role", { _user_id: userId, _role: "admin" });
  if (error) throw new Error(error.message);
  if (!data) throw new Error("Acesso restrito a administradores.");
}

export const ETAPAS = ["Triagem", "Entrevista", "Teste", "Proposta", "Contratado"] as const;
export const DEPARTAMENTOS = ["Comercial", "Tecnologia", "Recursos Humanos", "Administrativo", "Financeiro"] as const;

export type Vaga = {
  id: string;
  titulo: string;
  departamento: string;
  status: string;
};

export type Candidato = {
  id: string;
  nome: string;
  vaga_id: string | null;
  etapa: string;
  email: string | null;
  telefone: string | null;
  fit: number;
  notas: string | null;
};

export type RecrutamentoResult = {
  isAdmin: boolean;
  vagas: Vaga[];
  candidatos: Candidato[];
};

export const getRecrutamento = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<RecrutamentoResult> => {
    const { supabase, userId } = context;
    const { data: isAdmin } = await supabase.rpc("has_role", { _user_id: userId, _role: "admin" });
    const [vagasRes, candRes] = await Promise.all([
      supabase.from("rh_vagas").select("id, titulo, departamento, status").order("created_at", { ascending: false }),
      supabase.from("rh_candidatos").select("id, nome, vaga_id, etapa, email, telefone, fit, notas").order("created_at", { ascending: false }),
    ]);
    if (vagasRes.error) throw new Error(vagasRes.error.message);
    if (candRes.error) throw new Error(candRes.error.message);
    return {
      isAdmin: !!isAdmin,
      vagas: (vagasRes.data ?? []) as Vaga[],
      candidatos: (candRes.data ?? []) as Candidato[],
    };
  });

const vagaSchema = z.object({
  id: z.string().uuid().optional(),
  titulo: z.string().min(1).max(120),
  departamento: z.string().min(1).max(60),
  status: z.enum(["Aberta", "Encerrada"]).optional(),
});

export const saveVaga = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => vagaSchema.parse(d))
  .handler(async ({ context, data }): Promise<{ ok: true }> => {
    await assertAdmin(context.supabase, context.userId);
    const row = { titulo: data.titulo, departamento: data.departamento, status: data.status ?? "Aberta" };
    const q = data.id
      ? context.supabase.from("rh_vagas").update(row).eq("id", data.id)
      : context.supabase.from("rh_vagas").insert(row);
    const { error } = await q;
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const deleteVaga = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ context, data }): Promise<{ ok: true }> => {
    await assertAdmin(context.supabase, context.userId);
    const { error } = await context.supabase.from("rh_vagas").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

const candSchema = z.object({
  id: z.string().uuid().optional(),
  nome: z.string().min(1).max(120),
  vaga_id: z.string().uuid().nullable().optional(),
  etapa: z.enum(["Triagem", "Entrevista", "Teste", "Proposta", "Contratado"]),
  email: z.string().email().max(160).nullable().optional().or(z.literal("")),
  telefone: z.string().max(40).nullable().optional(),
  fit: z.number().int().min(0).max(100).optional(),
  notas: z.string().max(1000).nullable().optional(),
});

export const saveCandidato = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => candSchema.parse(d))
  .handler(async ({ context, data }): Promise<{ ok: true }> => {
    await assertAdmin(context.supabase, context.userId);
    const row = {
      nome: data.nome,
      vaga_id: data.vaga_id || null,
      etapa: data.etapa,
      email: data.email || null,
      telefone: data.telefone || null,
      fit: data.fit ?? 80,
      notas: data.notas || null,
    };
    const q = data.id
      ? context.supabase.from("rh_candidatos").update(row).eq("id", data.id)
      : context.supabase.from("rh_candidatos").insert(row);
    const { error } = await q;
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const moveCandidato = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z.object({
      id: z.string().uuid(),
      etapa: z.enum(["Triagem", "Entrevista", "Teste", "Proposta", "Contratado"]),
    }).parse(d),
  )
  .handler(async ({ context, data }): Promise<{ ok: true }> => {
    await assertAdmin(context.supabase, context.userId);
    const { error } = await context.supabase.from("rh_candidatos").update({ etapa: data.etapa }).eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const deleteCandidato = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ context, data }): Promise<{ ok: true }> => {
    await assertAdmin(context.supabase, context.userId);
    const { error } = await context.supabase.from("rh_candidatos").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
