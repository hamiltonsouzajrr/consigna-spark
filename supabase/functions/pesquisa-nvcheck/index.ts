// Edge Function: pesquisa-nvcheck
// Busca multi-critério da tela de Pesquisas. Backend usa SOMENTE NVCHECK (documento).
// Payload: { cpf?, documento?, nome?, celular?, email?, finalidade? }
// Fluxo: GerarToken (SOAP) -> NVCHECK (SOAP) -> parse XML -> JSON.
// Secrets necessários: NV_USUARIO, NV_SENHA, NV_CLIENTE (texto puro; convertidos para Base64 aqui).

import { XMLParser } from "https://esm.sh/fast-xml-parser@4.5.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const TOKEN_URL = "https://wsnv.novavidati.com.br/WSLocalizador.asmx";
const CHECK_URL = "https://wsnv.novavidati.com.br/WSLocalizador.asmx";

const b64 = (s: string) => btoa(unescape(encodeURIComponent(s)));

async function gerarToken(usuario: string, senha: string, cliente: string): Promise<string> {
  const body = `<?xml version="1.0" encoding="utf-8"?>
<soap:Envelope xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xmlns:xsd="http://www.w3.org/2001/XMLSchema" xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/">
  <soap:Body>
    <GerarToken xmlns="http://tempuri.org/">
      <usuario>${b64(usuario)}</usuario>
      <senha>${b64(senha)}</senha>
      <cliente>${b64(cliente)}</cliente>
    </GerarToken>
  </soap:Body>
</soap:Envelope>`;

  const res = await fetch(TOKEN_URL, {
    method: "POST",
    headers: {
      "Content-Type": "text/xml; charset=utf-8",
      SOAPAction: "http://tempuri.org/GerarToken",
    },
    body,
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`GerarToken ${res.status}: ${text.slice(0, 300)}`);
  const m = text.match(/<GerarTokenResult>([\s\S]*?)<\/GerarTokenResult>/);
  if (!m) throw new Error(`Token não encontrado na resposta: ${text.slice(0, 300)}`);
  const token = m[1].trim();
  const lower = token.toLowerCase();
  if (
    lower.includes("incorreto") ||
    lower.includes("sem acesso") ||
    lower.includes("quantidade configurada")
  ) {
    throw new Error(`Falha autenticação NovaVida: ${token}`);
  }
  return token;
}

async function nvCheck(documento: string, token: string): Promise<string> {
  const body = `<?xml version="1.0" encoding="utf-8"?>
<soap:Envelope xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xmlns:xsd="http://www.w3.org/2001/XMLSchema" xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/">
  <soap:Body>
    <NVCHECK xmlns="http://tempuri.org/">
      <documento>${documento}</documento>
      <token>${token}</token>
    </NVCHECK>
  </soap:Body>
</soap:Envelope>`;

  const res = await fetch(CHECK_URL, {
    method: "POST",
    headers: {
      "Content-Type": "text/xml; charset=utf-8",
      SOAPAction: "http://tempuri.org/NVCHECK",
    },
    body,
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`NVCHECK ${res.status}: ${text.slice(0, 300)}`);

  const m = text.match(/<NVCHECKResult>([\s\S]*?)<\/NVCHECKResult>/);
  if (!m) throw new Error(`Resposta inesperada: ${text.slice(0, 300)}`);
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
  if (!trimmed.startsWith("<")) {
    return { erro: trimmed };
  }
  const parser = new XMLParser({
    ignoreAttributes: false,
    parseTagValue: true,
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

  const usuario = Deno.env.get("NV_USUARIO");
  const senha = Deno.env.get("NV_SENHA");
  const cliente = Deno.env.get("NV_CLIENTE");
  if (!usuario || !senha || !cliente) {
    return new Response(
      JSON.stringify({ error: "Credenciais Nova Vida não configuradas (NV_USUARIO, NV_SENHA, NV_CLIENTE)" }),
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

  // Backend usa SOMENTE o documento (CPF/CNPJ) para a chamada NVCHECK.
  const documento = String(payload.documento ?? payload.cpf ?? "").replace(/\D/g, "");
  if (documento.length !== 11 && documento.length !== 14) {
    return new Response(JSON.stringify({ error: "Documento inválido (CPF=11 ou CNPJ=14 dígitos)" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    const token = await gerarToken(usuario, senha, cliente);
    const xml = await nvCheck(documento, token);
    const data = parseConsulta(xml);
    return new Response(JSON.stringify({ ok: true, documento, data }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(
      JSON.stringify({ ok: false, error: String(err instanceof Error ? err.message : err) }),
      { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
