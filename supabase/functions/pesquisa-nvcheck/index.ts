// Edge Function: pesquisa-nvcheck
// Busca multi-critério da tela de Pesquisas. Backend usa SOMENTE o documento (CPF/CNPJ).
// Payload: { cpf?, documento?, nome?, celular?, email?, finalidade? }
// Autenticação: REST com Bearer token.
//   - NOVA_VIDA_API_URL: endpoint base da API Nova Vida.
//   - NOVA_VIDA_API_KEY: enviada no header Authorization (Bearer).

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const NOVA_VIDA_FRIENDLY_ERROR =
  "A consulta Nova Vida está indisponível no momento. Tente novamente em alguns instantes.";

class NovaVidaUnavailableError extends Error {
  constructor() {
    super(NOVA_VIDA_FRIENDLY_ERROR);
    this.name = "NovaVidaUnavailableError";
  }
}

async function novaVidaCheck(documento: string, apiUrl: string, apiKey: string): Promise<unknown> {
  const res = await fetch(apiUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({ documento }),
  });

  const text = await res.text();
  if (!res.ok) {
    console.error("Nova Vida API error", { status: res.status, body: text.slice(0, 1000) });
    throw new NovaVidaUnavailableError();
  }

  let json: unknown;
  try {
    json = JSON.parse(text);
  } catch {
    console.error("Nova Vida non-JSON response", { body: text.slice(0, 1000) });
    throw new NovaVidaUnavailableError();
  }

  // Normaliza: alguns endpoints encapsulam o resultado em { CONSULTA: {...} } ou { data: {...} }.
  const obj = json as Record<string, unknown>;
  return obj.CONSULTA ?? obj.data ?? obj;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const apiUrl = Deno.env.get("NOVA_VIDA_API_URL");
  const apiKey = Deno.env.get("NOVA_VIDA_API_KEY");
  if (!apiUrl || !apiKey) {
    return new Response(
      JSON.stringify({ error: "Credenciais Nova Vida não configuradas (NOVA_VIDA_API_URL, NOVA_VIDA_API_KEY)" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }

  let payload: {
    cpf?: string;
    documento?: string;
    nome?: string;
    celular?: string;
    email?: string;
    finalidade?: string;
  };
  try {
    payload = await req.json();
  } catch {
    return new Response(JSON.stringify({ error: "Body JSON inválido" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  // Backend usa SOMENTE o documento (CPF/CNPJ) para a chamada.
  const documento = String(payload.documento ?? payload.cpf ?? "").replace(/\D/g, "");
  if (documento.length !== 11 && documento.length !== 14) {
    return new Response(JSON.stringify({ error: "Documento inválido (CPF=11 ou CNPJ=14 dígitos)" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    const data = await novaVidaCheck(documento, apiUrl, apiKey);
    return new Response(JSON.stringify({ ok: true, documento, data }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    // Retorna 200 com ok:false para o cliente tratar a falha sem blank screen
    // (status >= 400 faz supabase.functions.invoke descartar o corpo JSON).
    const isNovaVidaUnavailable = err instanceof NovaVidaUnavailableError;
    return new Response(
      JSON.stringify({
        ok: false,
        error: isNovaVidaUnavailable
          ? NOVA_VIDA_FRIENDLY_ERROR
          : "Não foi possível concluir a consulta. Tente novamente em alguns instantes.",
        code: isNovaVidaUnavailable ? "NOVA_VIDA_UNAVAILABLE" : "CONSULTA_ERROR",
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
