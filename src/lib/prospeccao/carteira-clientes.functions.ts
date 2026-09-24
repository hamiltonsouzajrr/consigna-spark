import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { isValidCpf } from "@/lib/cpf";

const fichaSchema = z.object({
  pessoa: z.object({
    cpf: z.string().nullable(),
    nome: z.string().nullable(),
    nascimento: z.string().nullable().optional(),
    idade: z.string().nullable().optional(),
    sexo: z.string().nullable().optional(),
    mae: z.string().nullable().optional(),
    campos: z.array(z.object({ label: z.string(), valor: z.string() })),
  }),
  telefones: z.array(z.string()),
  telefonesDetalhe: z.array(z.unknown()).optional(),
  emails: z.array(z.string()),
  enderecos: z.array(z.string()),
  tabelas: z.array(z.unknown()),
});

const calculoSchema = z.object({
  leadId: z.string().uuid(),
  calculadora: z.enum(["bancos", "contracheque", "banese"]),
  entradas: z.record(z.string(), z.unknown()),
  resultado: z.record(z.string(), z.unknown()),
});

const digits = (value: unknown) => String(value ?? "").replace(/\D/g, "");
const telefone = (value: unknown) => {
  const d = digits(value);
  return d.length > 11 && d.startsWith("55") ? d.slice(2) : d;
};

function cidadeDoEndereco(endereco: string | undefined): string | null {
  if (!endereco) return null;
  const partes = endereco.split(/[,·|-]/).map((p) => p.trim()).filter(Boolean);
  const comUf = partes.find((p) => /\b[A-Z]{2}\b/.test(p));
  return comUf?.replace(/\/?\s*[A-Z]{2}\b.*$/, "").trim() || null;
}

export type ClienteCarteira = {
  id: string;
  nome: string;
  cpf: string | null;
  telefone: string | null;
  endereco: string | null;
};

export type CalculoCarteira = {
  id: string;
  leadId: string;
  clienteNome: string;
  calculadora: "bancos" | "contracheque" | "banese";
  entradas: Record<string, unknown>;
  resultado: Record<string, unknown>;
  criadoEm: string;
};

export const salvarFichaNaCarteira = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => z.object({ ficha: fichaSchema }).parse(data))
  .handler(async ({ context, data }) => {
    const cpf = digits(data.ficha.pessoa.cpf);
    const nome = data.ficha.pessoa.nome?.trim();
    if (!nome) throw new Error("A ficha não possui nome para salvar.");
    if (cpf.length !== 11 || !isValidCpf(cpf)) throw new Error("A ficha não possui um CPF válido.");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: existentes, error: buscaError } = await supabaseAdmin
      .from("prospect_leads")
      .select("id,consultant_id")
      .in("cpf", [cpf, cpf.replace(/^(\d{3})(\d{3})(\d{3})(\d{2})$/, "$1.$2.$3-$4")]);
    if (buscaError) throw new Error(buscaError.message);
    const deOutra = (existentes ?? []).find((row) => row.consultant_id && row.consultant_id !== context.userId);
    if (deOutra) {
      const { data: perfil } = await supabaseAdmin.from("profiles").select("nome_completo,email").eq("user_id", deOutra.consultant_id).maybeSingle();
      throw new Error(`Este cliente já pertence a ${perfil?.nome_completo || perfil?.email || "outra consultora"}.`);
    }
    const proprio = (existentes ?? []).find((row) => row.consultant_id === context.userId || !row.consultant_id);
    const telefones = [...new Set(data.ficha.telefones.map(telefone).filter((n) => n.length >= 8))];
    const endereco = data.ficha.enderecos[0] ?? null;
    const payload = {
      nome,
      cpf,
      telefone: telefones[0] ?? null,
      telefones,
      cidade: cidadeDoEndereco(endereco),
      origem: "rockdata",
      consultant_id: context.userId,
      created_by: context.userId,
      raw_data: JSON.parse(JSON.stringify({
        origem: "rockdata",
        endereco,
        enderecos: data.ficha.enderecos,
        emails: data.ficha.emails,
        rockdata_ficha: data.ficha,
      })),
    };
    const query = proprio
      ? supabaseAdmin.from("prospect_leads").update(payload).eq("id", proprio.id)
      : supabaseAdmin.from("prospect_leads").insert(payload);
    const { data: lead, error } = await query.select("id").single();
    if (error) throw new Error(error.message);
    return { leadId: lead.id as string, atualizado: !!proprio };
  });

export const buscarClientesParaCalculo = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => z.object({ termo: z.string().trim().max(120).default("") }).parse(data ?? {}))
  .handler(async ({ context, data }): Promise<ClienteCarteira[]> => {
    const termo = data.termo.trim();
    if (termo.length < 2) return [];
    const d = digits(termo);
    let query = context.supabase.from("prospect_leads").select("id,nome,cpf,telefone,raw_data").eq("consultant_id", context.userId).limit(20);
    query = d.length >= 3 ? query.ilike("cpf", `%${d}%`) : query.ilike("nome", `%${termo}%`);
    const { data: rows, error } = await query.order("nome");
    if (error) throw new Error(error.message);
    return (rows ?? []).map((row) => ({
      id: row.id,
      nome: row.nome,
      cpf: row.cpf,
      telefone: row.telefone,
      endereco: row.raw_data && typeof row.raw_data === "object" && !Array.isArray(row.raw_data)
        ? String((row.raw_data as Record<string, unknown>).endereco ?? "") || null
        : null,
    }));
  });

export const salvarCalculoCliente = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => calculoSchema.parse(data))
  .handler(async ({ context, data }) => {
    const { data: lead } = await context.supabase.from("prospect_leads").select("id").eq("id", data.leadId).eq("consultant_id", context.userId).maybeSingle();
    if (!lead) throw new Error("Selecione um cliente da sua carteira.");
    const { data: calculo, error } = await context.supabase.from("prospect_calculos").insert({
      user_id: context.userId,
      lead_id: data.leadId,
      calculadora: data.calculadora,
      entradas: data.entradas,
      resultado: data.resultado,
    }).select("id").single();
    if (error) throw new Error(error.message);
    return { id: calculo.id as string };
  });

export const listarClientesRockdata = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<{ clientes: ClienteCarteira[]; calculos: CalculoCarteira[] }> => {
    const { data: clientes, error } = await context.supabase
      .from("prospect_leads")
      .select("id,nome,cpf,telefone,raw_data")
      .eq("consultant_id", context.userId)
      .eq("origem", "rockdata")
      .order("updated_at", { ascending: false })
      .limit(100);
    if (error) throw new Error(error.message);
    const ids = (clientes ?? []).map((row) => row.id);
    const { data: calculos } = ids.length
      ? await context.supabase.from("prospect_calculos").select("id,lead_id,calculadora,entradas,resultado,created_at").in("lead_id", ids).order("created_at", { ascending: false }).limit(200)
      : { data: [] };
    const nomePorId = new Map((clientes ?? []).map((row) => [row.id, row.nome]));
    return {
      clientes: (clientes ?? []).map((row) => ({
        id: row.id, nome: row.nome, cpf: row.cpf, telefone: row.telefone,
        endereco: row.raw_data && typeof row.raw_data === "object" && !Array.isArray(row.raw_data)
          ? String((row.raw_data as Record<string, unknown>).endereco ?? "") || null : null,
      })),
      calculos: (calculos ?? []).map((row) => ({
        id: row.id, leadId: row.lead_id, clienteNome: nomePorId.get(row.lead_id) ?? "Cliente",
        calculadora: row.calculadora as CalculoCarteira["calculadora"],
        entradas: row.entradas as Record<string, unknown>, resultado: row.resultado as Record<string, unknown>, criadoEm: row.created_at,
      })),
    };
  });