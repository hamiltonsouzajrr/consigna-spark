// Edge Function: nova-vida-post
// Faz POST para a API Nova Vida com o payload recebido.
// Configure os secrets NOVA_VIDA_URL e NOVA_VIDA_TOKEN antes de usar.

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

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
    return new Response(
      JSON.stringify({ error: "Falha ao contatar API Nova Vida", detail: String(err) }),
      { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
