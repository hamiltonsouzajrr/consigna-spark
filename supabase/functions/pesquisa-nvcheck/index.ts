// Edge Function: pesquisa-nvcheck
// Busca multi-critério da tela de Pesquisas. Backend usa SOMENTE o documento (CPF/CNPJ).
// Payload: { cpf?, documento?, nome?, celular?, email?, finalidade? }
// Autenticação: SOAP 1.2 direto no endpoint Nova Vida (NVCHECK), usando o token.
//   - NOVA_VIDA_API_URL: endpoint SOAP da Nova Vida (.asmx).
//   - NOVA_VIDA_API_KEY: token usado diretamente na chamada NVCHECK.

import { XMLParser } from "https://esm.sh/fast-xml-parser@4.5.0";

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

// Chamada SOAP 1.2 ao método NVCHECK.
// Envelope no namespace http://www.w3.org/2003/05/soap-envelope e
// Content-Type application/soap+xml com a action embutida (sem header SOAPAction).
async function nvCheckSoap(documento: string, apiUrl: string, token: string): Promise<string> {
  const body = `<?xml version="1.0" encoding="utf-8"?>
<soap12:Envelope xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xmlns:xsd="http://www.w3.org/2001/XMLSchema" xmlns:soap12="http://www.w3.org/2003/05/soap-envelope">
  <soap12:Body>
    <NVCHECK xmlns="http://tempuri.org/">
      <documento>${documento}</documento>
      <token>${token}</token>
    </NVCHECK>
  </soap12:Body>
</soap12:Envelope>`;

  const res = await fetch(apiUrl, {
    method: "POST",
    headers: {
      "Content-Type": 'application/soap+xml; charset=utf-8; action="http://tempuri.org/NVCHECK"',
    },
    body,
  });

  const text = await res.text();
  if (!res.ok) {
    console.error("Nova Vida SOAP error", { status: res.status, body: text.slice(0, 1000) });
    throw new NovaVidaUnavailableError();
  }

  // Resposta SOAP traz o XML da consulta dentro de <NVCHECKResult>...</NVCHECKResult>,
  // podendo vir HTML-encoded (&lt;...&gt;).
  const m = text.match(/<NVCHECKResult>([\s\S]*?)<\/NVCHECKResult>/);
  if (!m) {
    console.error("Nova Vida resposta inesperada", { body: text.slice(0, 1000) });
    throw new NovaVidaUnavailableError();
  }
  let inner = m[1].trim();
  if (inner.includes("&lt;")) {
    inner = inner
      .replace(/&lt;/g, "<")
      .replace(/&gt;/g, ">")
      .replace(/&amp;/g, "&")
      .replace(/&quot;/g, '"')
      .replace(/&apos;/g, "'");
  }
  return inner;
}

function parseConsulta(xml: string): unknown {
  const trimmed = xml.trim();
  if (!trimmed.startsWith("<")) return trimmed;
  const parser = new XMLParser({
    ignoreAttributes: true,
    trimValues: true,
    isArray: (name) => [
      "ENDERECOS",
      "TELEFONES",
      "EMAILS",
      "CONTATOSRUINS",
      "ULTIMAEMPRESALIGADA",
      "PESSOASLIGADAS",
      "SOCIEDADES",
      "PEPRELACIONADOS",
      "QSA",
    ].includes(name),
  });
  const obj = parser.parse(trimmed) as Record<string, unknown>;
  return (obj.CONSULTA as unknown) ?? obj;
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
    const xml = await nvCheckSoap(documento, apiUrl, apiKey);
    const data = parseConsulta(xml);
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
