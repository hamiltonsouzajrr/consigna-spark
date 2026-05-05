// Edge Function: processar-margens
// Recebe lista de IDs de consultas pendentes do usuário autenticado, marca como
// "processando" e simula a consulta. SUBSTITUA o bloco simulateConsulta pela
// integração real com o ConsigUp (usando credenciais armazenadas como secrets).

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface Payload {
  ids?: string[];
}

async function simulateConsulta(cpf: string): Promise<{ margem: number | null; erro: string | null }> {
  // TODO: Substituir por chamada real à API/automação ConsigUp.
  // Credenciais devem vir de Deno.env.get("CONSIGUP_USER") e CONSIGUP_PASS.
  await new Promise((r) => setTimeout(r, 400));
  if (cpf.replace(/\D/g, "").length !== 11) {
    return { margem: null, erro: "CPF inválido" };
  }
  const margem = Math.round((Math.random() * 2000 + 100) * 100) / 100;
  return { margem, erro: null };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return new Response(JSON.stringify({ error: "Não autorizado" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );
    const userClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } },
    );

    const { data: userData, error: userErr } = await userClient.auth.getUser();
    if (userErr || !userData.user) {
      return new Response(JSON.stringify({ error: "Usuário inválido" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    const userId = userData.user.id;

    const { ids }: Payload = await req.json().catch(() => ({}));

    let query = supabase
      .from("consultas_margem")
      .select("id, cpf")
      .eq("user_id", userId)
      .in("status", ["pendente", "erro"]);
    if (ids && ids.length) query = query.in("id", ids);

    const { data: rows, error: selErr } = await query;
    if (selErr) throw selErr;
    if (!rows || rows.length === 0) {
      return new Response(JSON.stringify({ processed: 0 }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    await supabase
      .from("consultas_margem")
      .update({ status: "processando", erro: null })
      .in("id", rows.map((r) => r.id));

    // Processa em background para retornar rápido ao cliente
    const task = (async () => {
      for (const row of rows) {
        const { margem, erro } = await simulateConsulta(row.cpf);
        await supabase
          .from("consultas_margem")
          .update({
            margem_disponivel: margem,
            erro,
            status: erro ? "erro" : "concluido",
            processed_at: new Date().toISOString(),
          })
          .eq("id", row.id);
      }
    })();
    // @ts-ignore EdgeRuntime
    if (typeof EdgeRuntime !== "undefined") EdgeRuntime.waitUntil(task);
    else await task;

    return new Response(JSON.stringify({ enqueued: rows.length }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("processar-margens error", e);
    return new Response(JSON.stringify({ error: String(e) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
