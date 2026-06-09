// Desligamentos — base de inteligência para futuras contratações.
// Acesso restrito a administradores (RH / Gerência / Admin).

import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

async function assertAdmin(supabase: any, userId: string) {
  const { data, error } = await supabase.rpc("has_role", { _user_id: userId, _role: "admin" });
  if (error) throw new Error(error.message);
  if (!data) throw new Error("Acesso restrito a RH, Gerência e Administradores.");
}

export const TIPOS_DESLIGAMENTO = [
  "Pedido de demissão",
  "Demissão sem justa causa",
  "Demissão por justa causa",
  "Término de experiência",
  "Acordo entre as partes",
  "Abandono de emprego",
  "Outros",
] as const;

export type HistoricoEntry = { acao: string; por: string | null; em: string };

export type Desligamento = {
  id: string;
  colaborador: string;
  cargo: string | null;
  setor: string | null;
  data_admissao: string | null;
  data_desligamento: string;
  responsavel: string | null;
  tipo: string;
  motivo: string | null;
  motivo_detalhado: string;
  sinais_contratacao: string;
  alertas_futuros: string | null;
  historico: HistoricoEntry[];
  created_at: string;
  updated_at: string;
};

export type DesligamentosResult = {
  isAdmin: boolean;
  items: Desligamento[];
};

const SELECT_COLS =
  "id, colaborador, cargo, setor, data_admissao, data_desligamento, responsavel, tipo, motivo, motivo_detalhado, sinais_contratacao, alertas_futuros, historico, created_at, updated_at";

export const getDesligamentos = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<DesligamentosResult> => {
    const { supabase, userId } = context;
    const { data: isAdmin } = await supabase.rpc("has_role", { _user_id: userId, _role: "admin" });
    if (!isAdmin) return { isAdmin: false, items: [] };
    const { data, error } = await supabase
      .from("rh_desligamentos")
      .select(SELECT_COLS)
      .order("data_desligamento", { ascending: false });
    if (error) throw new Error(error.message);
    return { isAdmin: true, items: (data ?? []) as Desligamento[] };
  });

const schema = z.object({
  id: z.string().uuid().optional(),
  colaborador: z.string().min(1).max(120),
  cargo: z.string().max(120).optional().nullable(),
  setor: z.string().max(120).optional().nullable(),
  data_admissao: z.string().max(20).optional().nullable(),
  data_desligamento: z.string().min(1).max(20),
  responsavel: z.string().max(120).optional().nullable(),
  tipo: z.enum(TIPOS_DESLIGAMENTO),
  motivo: z.string().max(200).optional().nullable(),
  motivo_detalhado: z.string().min(1).max(5000),
  sinais_contratacao: z.string().min(1).max(5000),
  alertas_futuros: z.string().max(5000).optional().nullable(),
});

export const saveDesligamento = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => schema.parse(d))
  .handler(async ({ context, data }): Promise<{ ok: true }> => {
    await assertAdmin(context.supabase, context.userId);
    const { supabase, userId } = context;
    const nowIso = new Date().toISOString();

    const row = {
      colaborador: data.colaborador,
      cargo: data.cargo || null,
      setor: data.setor || null,
      data_admissao: data.data_admissao || null,
      data_desligamento: data.data_desligamento,
      responsavel: data.responsavel || null,
      tipo: data.tipo,
      motivo: data.motivo || null,
      motivo_detalhado: data.motivo_detalhado,
      sinais_contratacao: data.sinais_contratacao,
      alertas_futuros: data.alertas_futuros || null,
    };

    if (data.id) {
      const { data: prev } = await supabase
        .from("rh_desligamentos")
        .select("historico")
        .eq("id", data.id)
        .maybeSingle();
      const historico: HistoricoEntry[] = Array.isArray(prev?.historico) ? prev!.historico : [];
      historico.push({ acao: "Editado", por: userId, em: nowIso });
      const { error } = await supabase
        .from("rh_desligamentos")
        .update({ ...row, editado_por: userId, historico })
        .eq("id", data.id);
      if (error) throw new Error(error.message);
    } else {
      const historico: HistoricoEntry[] = [{ acao: "Cadastrado", por: userId, em: nowIso }];
      const { error } = await supabase
        .from("rh_desligamentos")
        .insert({ ...row, criado_por: userId, editado_por: userId, historico });
      if (error) throw new Error(error.message);
    }
    return { ok: true };
  });

export const deleteDesligamento = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ context, data }): Promise<{ ok: true }> => {
    await assertAdmin(context.supabase, context.userId);
    const { error } = await context.supabase.from("rh_desligamentos").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// IA — Aprendizados de Contratação
export const aiAprendizados = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<{ relatorio: string }> => {
    await assertAdmin(context.supabase, context.userId);
    const { supabase } = context;

    const { data, error } = await supabase
      .from("rh_desligamentos")
      .select("colaborador, cargo, setor, data_admissao, data_desligamento, tipo, motivo, motivo_detalhado, sinais_contratacao, alertas_futuros");
    if (error) throw new Error(error.message);
    if (!data || data.length === 0) {
      return { relatorio: "Ainda não há desligamentos cadastrados para análise." };
    }

    const apiKey = process.env.LOVABLE_API_KEY;
    if (!apiKey) throw new Error("LOVABLE_API_KEY não configurada.");

    const registros = data
      .map((d: any, i: number) => {
        let tempo = "";
        if (d.data_admissao && d.data_desligamento) {
          const dias = Math.round(
            (new Date(d.data_desligamento).getTime() - new Date(d.data_admissao).getTime()) / 86400000,
          );
          tempo = `${Math.max(0, Math.round((dias / 30) * 10) / 10)} meses`;
        }
        return [
          `#${i + 1} ${d.colaborador} — ${d.cargo ?? "-"} / ${d.setor ?? "-"}`,
          `Tempo de empresa: ${tempo || "-"} | Tipo: ${d.tipo}`,
          `Motivo: ${d.motivo ?? "-"} — ${d.motivo_detalhado}`,
          `Sinais na contratação: ${d.sinais_contratacao}`,
          `Alertas futuros: ${d.alertas_futuros ?? "-"}`,
        ].join("\n");
      })
      .join("\n\n");

    const prompt =
      "Você é um especialista em RH e recrutamento. Analise os registros de desligamento abaixo e gere um relatório estratégico em português (markdown) chamado 'Aprendizados de Contratação', com as seções:\n" +
      "1. Motivos mais frequentes de desligamento\n" +
      "2. Principais erros de contratação identificados\n" +
      "3. Comportamentos recorrentes em colaboradores desligados\n" +
      "4. Perfil dos colaboradores que permaneceram mais tempo\n" +
      "5. Sugestões práticas para melhorar futuras contratações e reduzir turnover\n\n" +
      "Seja objetivo, use bullet points e baseie-se apenas nos dados fornecidos.\n\n" +
      `Registros:\n${registros}`;

    const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [{ role: "user", content: prompt }],
      }),
    });

    if (res.status === 429) throw new Error("Limite de uso da IA atingido. Tente novamente em instantes.");
    if (res.status === 402) throw new Error("Créditos de IA esgotados. Adicione créditos no workspace.");
    if (!res.ok) throw new Error(`Falha na IA (${res.status}).`);

    const json = await res.json();
    const relatorio: string = json?.choices?.[0]?.message?.content ?? "Não foi possível gerar o relatório.";
    return { relatorio };
  });
