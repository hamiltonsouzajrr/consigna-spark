// Edge Function: processar-margens
// Faz login no ConsigUp (ASP.NET WebForms), itera pelos 8 órgãos
// conveniados e consulta a margem disponível para cada CPF.
// Grava a MAIOR margem encontrada entre todos os órgãos.
//
// IMPORTANTE: O ConsigUp não tem API pública. Esta função faz scraping HTTP
// mantendo cookies de sessão e __VIEWSTATE/__EVENTVALIDATION entre requests.
// Os seletores podem precisar de ajuste após o primeiro run real — veja logs.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const CONSIGUP_BASE = "https://sistema.consigup.com.br";
const LOGIN_URL = `${CONSIGUP_BASE}/Login.aspx`;
const HOME_URL = `${CONSIGUP_BASE}/Inicio/Inicio.aspx`;

// Órgãos conveniados (conforme dropdown do topo do ConsigUp)
const ORGAOS = [
  { codigo: "01", nome: "Prefeitura Municipal de Aracaju" },
  { codigo: "02", nome: "Fundação Cultural Cidade de Aracaju" },
  { codigo: "03", nome: "Superintendência Mun. de Transporte e Trânsito" },
  { codigo: "04", nome: "Aracaju Previdência" },
  { codigo: "05", nome: "Conselhos Tutelares Municipais" },
  { codigo: "06", nome: "Fundação Municipal de Formação para o Trabalho" },
  { codigo: "08", nome: "Empresa Municipal de Serviços Urbanos" },
  { codigo: "10", nome: "Consórcio de Transporte Intermunicipal - CTM" },
];

// ---------- Helpers HTTP / cookies / viewstate ----------

class Session {
  cookies = new Map<string, string>();

  cookieHeader(): string {
    return [...this.cookies.entries()].map(([k, v]) => `${k}=${v}`).join("; ");
  }

  absorbSetCookie(headers: Headers) {
    // Deno fetch não expõe múltiplos Set-Cookie via .get(); usamos getSetCookie
    // @ts-ignore
    const list: string[] = typeof headers.getSetCookie === "function" ? headers.getSetCookie() : [];
    for (const sc of list) {
      const first = sc.split(";")[0];
      const eq = first.indexOf("=");
      if (eq > 0) this.cookies.set(first.slice(0, eq).trim(), first.slice(eq + 1).trim());
    }
  }

  async request(url: string, init: RequestInit = {}): Promise<{ status: number; body: string; finalUrl: string }> {
    const headers = new Headers(init.headers);
    headers.set("User-Agent", "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36");
    headers.set("Accept-Language", "pt-BR,pt;q=0.9,en;q=0.8");
    headers.set("Origin", CONSIGUP_BASE);
    headers.set("Referer", LOGIN_URL);
    if (this.cookies.size) headers.set("Cookie", this.cookieHeader());
    if (!headers.has("Accept")) headers.set("Accept", "text/html,application/xhtml+xml");

    const res = await fetch(url, { ...init, headers, redirect: "manual" });
    this.absorbSetCookie(res.headers);

    // Segue redirects manualmente para preservar cookies
    if (res.status >= 300 && res.status < 400) {
      const loc = res.headers.get("location");
      if (loc) {
        const next = new URL(loc, url).toString();
        return this.request(next, { method: "GET" });
      }
    }
    const body = await res.text();
    return { status: res.status, body, finalUrl: url };
  }
}

function extractHidden(html: string, name: string): string {
  const re = new RegExp(`<input[^>]+name="${name}"[^>]+value="([^"]*)"`, "i");
  const m = html.match(re);
  return m ? m[1] : "";
}

function extractAllHidden(html: string): Record<string, string> {
  const out: Record<string, string> = {};
  const re = /<input[^>]+type="hidden"[^>]+name="([^"]+)"[^>]+value="([^"]*)"/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(html)) !== null) out[m[1]] = m[2];
  return out;
}

function parseBRL(text: string): number | null {
  // Captura primeiro valor no formato 1.234,56 ou 1234,56
  const m = text.match(/R?\$?\s*([\d.]+,\d{2})/);
  if (!m) return null;
  const n = parseFloat(m[1].replace(/\./g, "").replace(",", "."));
  return isNaN(n) ? null : n;
}

// ---------- Fluxo ConsigUp ----------

async function login(s: Session, user: string, pass: string): Promise<boolean> {
  const page = await s.request(LOGIN_URL);
  if (page.status !== 200) {
    console.error("[login] GET status", page.status);
    return false;
  }
  const hidden = extractAllHidden(page.body);
  const form = new URLSearchParams();
  for (const [k, v] of Object.entries(hidden)) form.set(k, v);
  form.set("txtLogin", user);
  form.set("txtSenha", pass);
  // Botão de submit — nome real pode variar; tenta comuns
  form.set("btnEntrar", "Entrar");

  const res = await s.request(LOGIN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: form.toString(),
  });

  // Sucesso = redirect para Inicio.aspx OU body contém algo da home
  const ok = /Inicio\.aspx/i.test(res.finalUrl) || /P[áa]gina Inicial/i.test(res.body) || /Consigna[çc][õo]es/i.test(res.body);
  console.log("[login] finalUrl:", res.finalUrl, "status:", res.status, "ok:", ok);
  console.log("[login] cookies:", [...s.cookies.keys()].join(","));
  // Procura mensagens de erro típicas do ASP.NET / ConsigUp
  const errMatch = res.body.match(/<span[^>]*id="[^"]*(lblMsg|lblErro|lblMensagem)[^"]*"[^>]*>([\s\S]*?)<\/span>/i)
    || res.body.match(/(Usu[áa]rio[^<]{0,80}senha[^<]{0,80}inv[áa]lid[ao][^<]{0,80})/i)
    || res.body.match(/(senha[^<]{0,80}inv[áa]lid[ao][^<]{0,80})/i)
    || res.body.match(/alert\(['"]([^'"]+)['"]\)/i);
  if (errMatch) console.error("[login] mensagem:", errMatch[0].slice(0, 300));
  if (!ok) console.error("[login] snippet body 500..1500:", res.body.slice(500, 1500));
  return ok;
}

async function selecionarOrgao(s: Session, codigo: string): Promise<boolean> {
  // No ConsigUp o dropdown de órgão dispara um __doPostBack na home.
  // O nome real do control normalmente é algo como "ctl00$ddlOrgao" — precisa
  // ser confirmado no DOM. Fazemos uma tentativa genérica.
  const page = await s.request(HOME_URL);
  const hidden = extractAllHidden(page.body);
  const form = new URLSearchParams();
  for (const [k, v] of Object.entries(hidden)) form.set(k, v);

  // Heurística: descobre o name do dropdown que contém os códigos
  const ddlMatch = page.body.match(/<select[^>]+name="([^"]+)"[^>]*>[\s\S]*?<option[^>]+value="0?1"/i);
  const ddlName = ddlMatch ? ddlMatch[1] : "ctl00$ddlOrgao";

  form.set(ddlName, codigo);
  form.set("__EVENTTARGET", ddlName);
  form.set("__EVENTARGUMENT", "");

  const res = await s.request(HOME_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: form.toString(),
  });
  return res.status === 200;
}

async function consultarMargemNoOrgao(s: Session, cpf: string): Promise<number | null> {
  // TODO calibrar: caminho real da tela de consulta de margem dentro do menu
  // "Consignações". Usamos um endpoint provável; ajustar após primeiro run.
  const CONSULTA_URL = `${CONSIGUP_BASE}/Consignacoes/ConsultaMargem.aspx`;
  const page = await s.request(CONSULTA_URL);
  if (page.status !== 200) {
    console.warn("[consulta] GET", CONSULTA_URL, "status", page.status);
    return null;
  }
  const hidden = extractAllHidden(page.body);
  const form = new URLSearchParams();
  for (const [k, v] of Object.entries(hidden)) form.set(k, v);

  // Heurística: nome do campo de CPF
  const cpfMatch = page.body.match(/<input[^>]+name="([^"]*[Cc][Pp][Ff][^"]*)"/);
  const cpfField = cpfMatch ? cpfMatch[1] : "ctl00$ContentPlaceHolder1$txtCPF";
  form.set(cpfField, cpf);
  form.set("ctl00$ContentPlaceHolder1$btnConsultar", "Consultar");

  const res = await s.request(CONSULTA_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: form.toString(),
  });

  // Procura "Margem Disponível" no resultado
  const marker = res.body.match(/Margem\s+Dispon[íi]vel[\s\S]{0,200}/i);
  if (!marker) {
    console.warn("[consulta] sem 'Margem Disponível' no retorno");
    return null;
  }
  return parseBRL(marker[0]);
}

async function consultarCpfTodosOrgaos(cpf: string): Promise<{ margem: number | null; erro: string | null; detalhes: Record<string, number | null> }> {
  const user = Deno.env.get("CONSIGUP_USER");
  const pass = Deno.env.get("CONSIGUP_PASS");
  if (!user || !pass) return { margem: null, erro: "Credenciais ConsigUp ausentes", detalhes: {} };

  const s = new Session();
  const okLogin = await login(s, user, pass);
  if (!okLogin) return { margem: null, erro: "Falha de login no ConsigUp", detalhes: {} };

  const detalhes: Record<string, number | null> = {};
  let maior: number | null = null;

  for (const o of ORGAOS) {
    try {
      await selecionarOrgao(s, o.codigo);
      const m = await consultarMargemNoOrgao(s, cpf);
      detalhes[o.codigo] = m;
      if (m != null && (maior == null || m > maior)) maior = m;
    } catch (e) {
      console.error(`[orgao ${o.codigo}]`, e);
      detalhes[o.codigo] = null;
    }
  }

  if (maior == null) return { margem: null, erro: "Nenhum órgão retornou margem", detalhes };
  return { margem: maior, erro: null, detalhes };
}

// ---------- Handler ----------

interface Payload { ids?: string[] }

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return new Response(JSON.stringify({ error: "Não autorizado" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });

    const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const userClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } },
    );

    const { data: userData, error: userErr } = await userClient.auth.getUser();
    if (userErr || !userData.user) return new Response(JSON.stringify({ error: "Usuário inválido" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    const userId = userData.user.id;

    const { ids }: Payload = await req.json().catch(() => ({}));

    let q = supabase.from("consultas_margem").select("id, cpf").eq("user_id", userId).in("status", ["pendente", "erro"]);
    if (ids && ids.length) q = q.in("id", ids);
    const { data: rows, error: selErr } = await q;
    if (selErr) throw selErr;
    if (!rows || rows.length === 0) return new Response(JSON.stringify({ processed: 0 }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });

    await supabase.from("consultas_margem").update({ status: "processando", erro: null }).in("id", rows.map((r) => r.id));

    const task = (async () => {
      for (const row of rows) {
        const { margem, erro } = await consultarCpfTodosOrgaos(row.cpf);
        await supabase.from("consultas_margem").update({
          margem_disponivel: margem,
          erro,
          status: erro ? "erro" : "concluido",
          processed_at: new Date().toISOString(),
        }).eq("id", row.id);
      }
    })();

    // @ts-ignore EdgeRuntime
    if (typeof EdgeRuntime !== "undefined") EdgeRuntime.waitUntil(task);
    else await task;

    return new Response(JSON.stringify({ enqueued: rows.length }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e) {
    console.error("processar-margens error", e);
    return new Response(JSON.stringify({ error: String(e) }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
