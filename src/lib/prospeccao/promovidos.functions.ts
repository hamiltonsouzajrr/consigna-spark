// Server functions for the "Recém promovidos" area inside the CRM.
// - getPromovidos: authenticated; lists promoted people (most recent first).
// - extractPromovidosAI: authenticated; AI reads PDF text and deduces promotions.
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

export type PromovidoAI = { nome: string; cpf: string; cargo: string };

// Splits long text into chunks small enough for a single AI call, breaking on
// line boundaries to avoid cutting a record in half.
function chunkText(text: string, maxChars: number): string[] {
  const lines = text.split("\n");
  const chunks: string[] = [];
  let cur = "";
  for (const line of lines) {
    if (cur.length + line.length + 1 > maxChars && cur) {
      chunks.push(cur);
      cur = "";
    }
    cur += line + "\n";
  }
  if (cur.trim()) chunks.push(cur);
  return chunks;
}

const SYSTEM_PROMPT = `Você é um analista de Diário Oficial brasileiro. Sua tarefa é identificar SOMENTE pessoas físicas que foram PROMOVIDAS ou que SUBIRAM DE CARGO no texto fornecido.

Considere como promoção qualquer uma destas situações (e variações de escrita):
- "promoção", "promovido(a)", "promover"
- "progressão funcional", "progressão por mérito", "progressão horizontal/vertical"
- "ascensão funcional", "elevação de cargo/nível", "subida de cargo"
- "reenquadramento" ou "enquadramento" para nível/classe superior
- "nomeação"/"designação" para um cargo SUPERIOR ao anterior (efetiva mudança para cargo mais alto)
- "concessão de progressão", "avanço de classe/nível/referência"

NÃO considere promoção (ignore):
- nomeações/designações para representar, compor comissão, responder por função temporária
- exonerações, demissões, aposentadorias, licenças, férias, falecimentos
- mera citação de cargo atual sem mudança
- pessoas jurídicas (empresas)

Para cada pessoa promovida, extraia: nome completo, CPF (no formato 000.000.000-00 quando houver) e o NOVO cargo/nível para o qual foi promovida. Se o CPF não aparecer, deixe vazio. Se nenhuma promoção for encontrada, retorne lista vazia.`;

// AI reads PDF text (extracted client-side) and deduces who was promoted.
export const extractPromovidosAI = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) =>
    z.object({ text: z.string().min(1).max(2_000_000) }).parse(data),
  )
  .handler(async ({ data }): Promise<{ pessoas: PromovidoAI[] }> => {
    const apiKey = process.env.LOVABLE_API_KEY;
    if (!apiKey) throw new Error("IA indisponível: LOVABLE_API_KEY ausente.");

    const { generateText, Output } = await import("ai");
    const { createLovableAiGatewayProvider } = await import("@/lib/ai-gateway.server");
    const gateway = createLovableAiGatewayProvider(apiKey);
    const model = gateway("google/gemini-2.5-flash");

    const schema = z.object({
      pessoas: z
        .array(
          z.object({
            nome: z.string(),
            cpf: z.string(),
            cargo: z.string(),
          }),
        )
        .max(500),
    });

    const chunks = chunkText(data.text, 28_000).slice(0, 20);
    const byCpf = new Map<string, PromovidoAI>();
    const noCpf: PromovidoAI[] = [];

    for (const chunk of chunks) {
      try {
        const { output } = await generateText({
          model,
          output: Output.object({ schema }),
          system: SYSTEM_PROMPT,
          prompt: `Texto do Diário Oficial:\n\n${chunk}`,
        });
        for (const p of output?.pessoas ?? []) {
          const nome = (p.nome ?? "").trim();
          if (!nome) continue;
          const cargo = (p.cargo ?? "").trim();
          const cpfDigits = (p.cpf ?? "").replace(/\D/g, "");
          const item: PromovidoAI = { nome, cpf: (p.cpf ?? "").trim(), cargo };
          if (cpfDigits.length === 11) {
            const existing = byCpf.get(cpfDigits);
            if (!existing) byCpf.set(cpfDigits, item);
            else {
              if (!existing.cargo && cargo) existing.cargo = cargo;
            }
          } else {
            noCpf.push(item);
          }
        }
      } catch (e: any) {
        const msg = String(e?.message ?? e);
        if (/429/.test(msg)) throw new Error("Limite de uso da IA atingido. Tente novamente em instantes.");
        if (/402/.test(msg)) throw new Error("Créditos de IA esgotados. Adicione créditos para continuar.");
        // Skip a failing chunk but keep going.
        console.error("[extractPromovidosAI] chunk falhou:", msg);
      }
    }

    return { pessoas: [...byCpf.values(), ...noCpf] };
  });


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
        entries: z.array(entry).min(1).max(20000),
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
