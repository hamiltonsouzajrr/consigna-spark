// Edge Function: pesquisa-nvcheck
// Busca multi-critério da tela de Pesquisas. Backend usa SOMENTE o documento (CPF/CNPJ).
// Payload: { cpf?, documento?, nome?, celular?, email?, finalidade? }
// Fluxo: GerarToken (SOAP 1.2) -> NVCHECK (SOAP 1.2) -> parse XML -> JSON.
// Secrets necessários: NV_USUARIO, NV_SENHA, NV_CLIENTE (texto puro; convertidos p/ Base64 aqui).
//   - NOVA_VIDA_API_URL: endpoint SOAP da Nova Vida (.asmx).

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

const b64 = (s: string) => btoa(unescape(encodeURIComponent(s)));

const AUTH_ERROR_TERMS = [
  "token",
  "expirad",
  "incorreto",
  "sem acesso",
  "acesso negado",
  "nao autorizado",
  "não autorizado",
  "quantidade configurada",
];

function looksLikeAuthError(value: string): boolean {
  const lower = value.toLowerCase();
  return AUTH_ERROR_TERMS.some((t) => lower.includes(t));
}

// GerarToken (SOAP 1.2): a action vai no Content-Type, sem header SOAPAction.
async function gerarToken(
  apiUrl: string,
  usuario: string,
  senha: string,
  cliente: string,
): Promise<string> {
  const body = `<?xml version="1.0" encoding="utf-8"?>
<soap12:Envelope xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xmlns:xsd="http://www.w3.org/2001/XMLSchema" xmlns:soap12="http://www.w3.org/2003/05/soap-envelope">
  <soap12:Body>
    <GerarToken xmlns="http://tempuri.org/">
      <usuario>${b64(usuario)}</usuario>
      <senha>${b64(senha)}</senha>
      <cliente>${b64(cliente)}</cliente>
    </GerarToken>
  </soap12:Body>
</soap12:Envelope>`;

  const res = await fetch(apiUrl, {
    method: "POST",
    headers: {
      "Content-Type": 'application/soap+xml; charset=utf-8; action="http://tempuri.org/GerarToken"',
    },
    body,
  });

  const text = await res.text();
  if (!res.ok) {
    console.error("GerarToken SOAP error", { status: res.status, body: text.slice(0, 1000) });
    throw new NovaVidaUnavailableError();
  }

  // A resposta traz o token em <GerarTokenResult> dentro de <GerarTokenResponse xmlns="http://tempuri.org/">.
  const m = text.match(/<GerarTokenResult>([\s\S]*?)<\/GerarTokenResult>/);
  if (!m) {
    console.error("GerarToken: token não encontrado", { body: text.slice(0, 1000) });
    throw new NovaVidaUnavailableError();
  }
  const token = m[1].trim();
  if (!token || looksLikeAuthError(token)) {
    console.error("GerarToken: falha de autenticação", { result: token.slice(0, 300) });
    throw new NovaVidaUnavailableError();
  }
  return token;
}

// NVCHECK (SOAP 1.2): a action vai no Content-Type, sem header SOAPAction.
async function nvCheckSoap(apiUrl: string, documento: string, token: string): Promise<string> {
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
    console.error("NVCHECK SOAP error", { status: res.status, body: text.slice(0, 1000) });
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

  // Mesmo com token, a Nova Vida pode devolver mensagens curtas de erro/limite
  // (ex.: "<CONSULTA>TOKEN EXPIRADO.</CONSULTA>"). Removemos as tags e tratamos como falha.
  const textOnly = inner.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
  if (looksLikeAuthError(textOnly)) {
    console.error("Nova Vida token/auth inválido", { result: textOnly.slice(0, 300) });
    throw new NovaVidaUnavailableError();
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
  const usuario = Deno.env.get("NV_USUARIO");
  const senha = Deno.env.get("NV_SENHA");
  const cliente = Deno.env.get("NV_CLIENTE");
  if (!apiUrl || !usuario || !senha || !cliente) {
    return new Response(
      JSON.stringify({
        error:
          "Credenciais Nova Vida não configuradas (NOVA_VIDA_API_URL, NV_USUARIO, NV_SENHA, NV_CLIENTE)",
      }),
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
    const token = await gerarToken(apiUrl, usuario, senha, cliente);
    const xml = await nvCheckSoap(apiUrl, documento, token);
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
