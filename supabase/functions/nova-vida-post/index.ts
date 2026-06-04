// Edge Function: nova-vida-post
// Faz POST para a API Nova Vida com o payload recebido.
// Configure os secrets NOVA_VIDA_URL e NOVA_VIDA_TOKEN antes de usar.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

// Verifica o JWT do usuário; retorna null se autorizado, ou uma Response 401 caso contrário.
async function requireAuth(req: Request): Promise<Response | null> {
  const authHeader = req.headers.get("Authorization");
  if (!authHeader) {
    return new Response(JSON.stringify({ error: "Não autorizado" }), {
      status: 401,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
  const userClient = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_ANON_KEY")!,
    { global: { headers: { Authorization: authHeader } } },
  );
  const { data, error } = await userClient.auth.getUser();
  if (error || !data.user) {
    return new Response(JSON.stringify({ error: "Não autorizado" }), {
      status: 401,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
  return null;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const unauthorized = await requireAuth(req);
  if (unauthorized) return unauthorized;

  const NOVA_VIDA_URL = Deno.env.get("NOVA_VIDA_URL");
  const NOVA_VIDA_TOKEN = Deno.env.get("NOVA_VIDA_TOKEN");

  if (!NOVA_VIDA_URL) {
    return new Response(
      JSON.stringify({ error: "NOVA_VIDA_URL não configurada" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }

  let payload: unknown;
  try {
    payload = await req.json();
  } catch {
    return new Response(JSON.stringify({ error: "Body JSON inválido" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      Accept: "application/json",
    };
    if (NOVA_VIDA_TOKEN) headers["Authorization"] = `Bearer ${NOVA_VIDA_TOKEN}`;

    const upstream = await fetch(NOVA_VIDA_URL, {
      method: "POST",
      headers,
      body: JSON.stringify(payload),
    });

    const text = await upstream.text();
    let data: unknown = text;
    try { data = JSON.parse(text); } catch { /* keep as text */ }

    return new Response(
      JSON.stringify({ ok: upstream.ok, status: upstream.status, data }),
      {
        status: upstream.ok ? 200 : 502,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  } catch (err) {
    console.error("[nova-vida-post] erro:", err instanceof Error ? err.message : String(err));
    return new Response(
      JSON.stringify({ error: "Serviço temporariamente indisponível" }),
      { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
