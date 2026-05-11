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

  async request(url: string, init: RequestInit = {}, timeoutMs = 30_000): Promise<{ status: number; body: string; finalUrl: string }> {
    const headers = new Headers(init.headers);
    headers.set("User-Agent", "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36");
    headers.set("Accept-Language", "pt-BR,pt;q=0.9,en;q=0.8");
    headers.set("Origin", CONSIGUP_BASE);
    headers.set("Referer", LOGIN_URL);
    if (this.cookies.size) headers.set("Cookie", this.cookieHeader());
    if (!headers.has("Accept")) headers.set("Accept", "text/html,application/xhtml+xml");

    const ctrl = new AbortController();
    const tid = setTimeout(() => ctrl.abort(), timeoutMs);
    let res: Response;
    try {
      res = await fetch(url, { ...init, headers, redirect: "manual", signal: ctrl.signal });
    } finally {
      clearTimeout(tid);
    }
    this.absorbSetCookie(res.headers);

    // Segue redirects manualmente para preservar cookies
    if (res.status >= 300 && res.status < 400) {
      const loc = res.headers.get("location");
      if (loc) {
        const next = new URL(loc, url).toString();
        return this.request(next, { method: "GET" }, timeoutMs);
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

// Parser do formato AJAX Delta do ASP.NET: "len|type|id|content|len|type|id|content|..."
// Retorna a concatenação dos blocos de content (HTML) — útil para casar regex de margem.
function parseAjaxDelta(body: string, log: LogFn): string {
  const out: string[] = [];
  let i = 0;
  let blocks = 0;
  while (i < body.length) {
    const pipe1 = body.indexOf("|", i);
    if (pipe1 < 0) break;
    const lenStr = body.slice(i, pipe1);
    const len = parseInt(lenStr, 10);
    if (isNaN(len)) break;
    const pipe2 = body.indexOf("|", pipe1 + 1);
    if (pipe2 < 0) break;
    const type = body.slice(pipe1 + 1, pipe2);
    const pipe3 = body.indexOf("|", pipe2 + 1);
    if (pipe3 < 0) break;
    const id = body.slice(pipe2 + 1, pipe3);
    const content = body.slice(pipe3 + 1, pipe3 + 1 + len);
    blocks++;
    // Coleta blocos que tipicamente carregam HTML/markup
    if (/updatePanel|pageRedirect|hiddenField|scriptStartupBlock|asyncPostBackError/i.test(type)) {
      out.push(`[delta:${type}#${id}] ${content}`);
    }
    if (/asyncPostBackError/i.test(type)) {
      void log("error", `[ajax-delta] erro async: ${content.slice(0, 500)}`);
    }
    i = pipe3 + 1 + len + 1; // pula '|'
  }
  void log("info", `[ajax-delta] ${blocks} blocos parseados, ${out.length} relevantes`);
  return out.join("\n");
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
  // ConsigUp aceita CPF com máscara no login. Formata se vier só dígitos.
  const userFmt = /^\d{11}$/.test(user)
    ? `${user.slice(0,3)}.${user.slice(3,6)}.${user.slice(6,9)}-${user.slice(9)}`
    : user;
  form.set("txtLogin", userFmt);
  form.set("txtSenha", pass);
  form.set("btnEntrar", "Entrar");

  const res = await s.request(LOGIN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: form.toString(),
  });

  const ok = /Inicio\.aspx/i.test(res.finalUrl) || /P[áa]gina Inicial/i.test(res.body) || /Consigna[çc][õo]es/i.test(res.body);
  console.log("[login] finalUrl:", res.finalUrl, "status:", res.status, "ok:", ok, "userFmt:", userFmt);
  console.log("[login] cookies:", [...s.cookies.keys()].join(","));
  // Procura mostraPopUpAlert('Titulo','Mensagem',...)
  const popup = res.body.match(/mostraPopUpAlert\(\s*['"]([^'"]+)['"]\s*,\s*['"]([^'"]+)['"]/);
  if (popup) console.error("[login] popup:", popup[1], "-", popup[2]);
  const errMatch = res.body.match(/<span[^>]*id="[^"]*(lblMsg|lblErro|lblMensagem)[^"]*"[^>]*>([\s\S]*?)<\/span>/i);
  if (errMatch) console.error("[login] lbl:", errMatch[0].slice(0, 300));
  return ok;
}

interface OrgaoLink { id: string; eventTarget: string; codigo: string; nome: string; }

function listarOrgaosDoHtml(html: string): OrgaoLink[] {
  const re = /<a\s+id="(lnkSecretaria\d+)"[^>]*href="javascript:__doPostBack\(&#39;([^&]+)&#39;,&#39;&#39;\)"[^>]*>([\s\S]*?)<\/a>/gi;
  const out: OrgaoLink[] = [];
  let m: RegExpExecArray | null;
  while ((m = re.exec(html)) !== null) {
    const text = m[3].replace(/<[^>]+>/g, "").replace(/\s+/g, " ").trim();
    const codeM = text.match(/^(\d{2})\s+(.+)$/);
    out.push({
      id: m[1],
      eventTarget: m[2],
      codigo: codeM ? codeM[1] : "",
      nome: codeM ? codeM[2] : text,
    });
  }
  return out;
}

async function selecionarOrgao(s: Session, eventTarget: string, refererPath = "/Inicio/Inicio.aspx"): Promise<{ ok: boolean; html: string }> {
  const page = await s.request(`${CONSIGUP_BASE}${refererPath}`);
  const hidden = extractAllHidden(page.body);
  const form = new URLSearchParams();
  for (const [k, v] of Object.entries(hidden)) form.set(k, v);
  form.set("__EVENTTARGET", eventTarget);
  form.set("__EVENTARGUMENT", "");

  const res = await s.request(`${CONSIGUP_BASE}${refererPath}`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: form.toString(),
  });
  return { ok: res.status === 200, html: res.body };
}

function listarLinksSidebar(html: string): { href: string; text: string }[] {
  // Sidebar do AdminLTE: <aside class="main-sidebar"> ... <a href="...">
  const sideM = html.match(/<aside[^>]*main-sidebar[\s\S]*?<\/aside>/i);
  const scope = sideM ? sideM[0] : html;
  const out: { href: string; text: string }[] = [];
  const re = /<a\s+[^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(scope)) !== null) {
    const href = m[1];
    if (href.startsWith("javascript:") || href.startsWith("#")) continue;
    const text = m[2].replace(/<[^>]+>/g, "").replace(/\s+/g, " ").trim();
    if (!text) continue;
    out.push({ href, text });
  }
  return out;
}

// Parser do grid de resultado: <table id="MainContent_gvCons...">
// Colunas: Servidor | CPF | Matrícula | Categoria | Situação | Margem Disponível
function parseGridServidor(html: string): {
  servidor?: string; cpf?: string; matricula?: string;
  categoria?: string; situacao?: string; margem: number | null;
} {
  const tableM = html.match(/<table[^>]*id="[^"]*MainContent_(?:gv|grd)[A-Za-z]*"[^>]*>[\s\S]*?<\/table>/i);
  if (!tableM) return { margem: null };
  const rows = [...tableM[0].matchAll(/<tr[^>]*>([\s\S]*?)<\/tr>/gi)];
  for (const row of rows) {
    // Pula cabeçalhos (têm <th>)
    if (/<th\b/i.test(row[1])) continue;
    const cells = [...row[1].matchAll(/<td[^>]*>([\s\S]*?)<\/td>/gi)]
      .map((m) => m[1]
        .replace(/<[^>]+>/g, " ")
        .replace(/&nbsp;/g, " ")
        .replace(/&amp;/g, "&")
        .replace(/\s+/g, " ")
        .trim());
    if (cells.length >= 6) {
      // Margem normalmente é a última coluna numérica
      const margem = parseBRL(cells[5]) ?? parseBRL(cells[cells.length - 1]);
      return {
        servidor: cells[0] || undefined,
        cpf: cells[1] || undefined,
        matricula: cells[2] || undefined,
        categoria: cells[3] || undefined,
        situacao: cells[4] || undefined,
        margem,
      };
    }
  }
  return { margem: null };
}

interface ConsultaServicoResult {
  margem: number | null;
  servidor?: string;
  matricula?: string;
  categoria?: string;
  situacao?: string;
  motivo: string;
}

// Consulta UM serviço (1=Empréstimo, 2=Cartão Crédito, 3=Cartão Benefício)
async function consultarServico(
  s: Session, cpf: string, consultaPath: string, servicoId: string, log: LogFn,
  preloaded?: { url: string; body: string },
): Promise<ConsultaServicoResult> {
  const CONSULTA_URL = consultaPath.startsWith("http") ? consultaPath : `${CONSIGUP_BASE}${consultaPath.startsWith("/") ? "" : "/"}${consultaPath}`;
  let pageBody: string;
  if (preloaded && preloaded.url === CONSULTA_URL) {
    pageBody = preloaded.body;
  } else {
    await log("info", `[svc=${servicoId}] GET ${CONSULTA_URL}`);
    const page = await s.request(CONSULTA_URL);
    if (page.status !== 200) {
      await log("warn", `[consulta svc=${servicoId}] GET status ${page.status}`);
      return { margem: null, motivo: `get_status_${page.status}` };
    }
    pageBody = page.body;
  }
  const hidden = extractAllHidden(pageBody);
  const form = new URLSearchParams();
  for (const [k, v] of Object.entries(hidden)) form.set(k, v);

  // Heurística: nome do campo de CPF (input text com 'cpf' no name/id)
  const cpfMatch = pageBody.match(/<input[^>]+name="([^"]*[Cc][Pp][Ff][^"]*)"[^>]*>/);
  const cpfField = cpfMatch ? cpfMatch[1] : "ctl00$ContentPlaceHolder1$txtCPF";
  const cpfFmt = /^\d{11}$/.test(cpf)
    ? `${cpf.slice(0,3)}.${cpf.slice(3,6)}.${cpf.slice(6,9)}-${cpf.slice(9)}`
    : cpf;
  form.set(cpfField, cpfFmt);

  // Detecta o nome do dropdown de Serviço e seleciona conforme servicoId
  const dropMatch = pageBody.match(/<select[^>]+name="([^"]*[Ss]ervico[^"]*)"/);
  const dropName = dropMatch ? dropMatch[1] : "ctl00$MainContent$dropServico";
  form.set(dropName, servicoId);

  // Detecta botão Consultar
  let btnName = "";
  let btnValue = "";
  const inputBtn = pageBody.match(/<input[^>]+type="(?:submit|button)"[^>]*name="([^"]+)"[^>]*value="([^"]*Consultar[^"]*)"/i)
                || pageBody.match(/<input[^>]+type="(?:submit|button)"[^>]*value="([^"]*Consultar[^"]*)"[^>]*name="([^"]+)"/i);
  if (inputBtn) {
    const isFirst = inputBtn[0].indexOf("name=") < inputBtn[0].indexOf("value=");
    btnName = isFirst ? inputBtn[1] : inputBtn[2];
    btnValue = isFirst ? inputBtn[2] : inputBtn[1];
  }
  let linkBtnTarget = "";
  const linkBtn = pageBody.match(/<a[^>]+href="javascript:__doPostBack\(&#39;([^&]+btnConsultar[^&]*)&#39;,&#39;[^&]*&#39;\)"/i);
  if (linkBtn) linkBtnTarget = linkBtn[1];

  const eventTarget = linkBtnTarget || btnName || "ctl00$MainContent$btnConsultar";
  form.set("__EVENTTARGET", eventTarget);
  form.set("__EVENTARGUMENT", "");
  if (btnName) form.set(btnName, btnValue || "Consultar");
  else form.set("ctl00$MainContent$btnConsultar", "Consultar");
  if (!form.has("__LASTFOCUS")) form.set("__LASTFOCUS", "");

  // Detecção AJAX/UpdatePanel
  const hasScriptManager = /ScriptResource\.axd|MicrosoftAjax|WebForms\.js|Sys\.WebForms\.PageRequestManager/i.test(pageBody);
  const hasAsyncPost = /name="__ASYNCPOST"/i.test(pageBody) || hasScriptManager;
  const updatePanelMatch = pageBody.match(/<div[^>]+id="([^"]*UpdatePanel[^"]*)"/i);
  const updatePanelId = updatePanelMatch ? updatePanelMatch[1] : "";

  const headers: Record<string, string> = {
    "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8",
    Referer: CONSULTA_URL,
  };
  if (hasAsyncPost) {
    form.set("__ASYNCPOST", "true");
    headers["X-MicrosoftAjax"] = "Delta=true";
    headers["X-Requested-With"] = "XMLHttpRequest";
    headers["Accept"] = "*/*";
    if (updatePanelId) form.set("ctl00$ScriptManager1", `${updatePanelId}|${eventTarget}`);
  }

  await log("info", `[consulta svc=${servicoId}] POST drop=${dropName}=${servicoId} target=${eventTarget}`);

  const res = await s.request(CONSULTA_URL, { method: "POST", headers, body: form.toString() });

  let bodyForParse = res.body;
  if (hasAsyncPost && /^\d+\|/.test(res.body)) {
    bodyForParse = parseAjaxDelta(res.body, log);
  }
  const body = bodyForParse;
  await log("info", `[consulta svc=${servicoId}] response len=${body.length}`);

  // 1) Tenta parsear o grid de resultado (Servidor / CPF / Matrícula / Categoria / Situação / Margem)
  const grid = parseGridServidor(body);
  if (grid.margem !== null && grid.margem !== undefined) {
    await log("info", `[consulta svc=${servicoId}] OK servidor='${grid.servidor}' matr=${grid.matricula} margem=${grid.margem}`);
    return {
      margem: grid.margem,
      servidor: grid.servidor,
      matricula: grid.matricula,
      categoria: grid.categoria,
      situacao: grid.situacao,
      motivo: "ok",
    };
  }

  // 2) Categoriza motivo da falha
  let motivo = "sem_resultado";
  let detalhe = "";
  if (/n[ãa]o\s+(localizado|encontrado|cadastrado)|cpf\s+inv[áa]lido|servidor\s+inativo/i.test(body)) {
    motivo = "servidor_nao_localizado";
  } else if (/Login\.aspx|Sess[ãa]o\s+expirada/i.test(body)) {
    motivo = "sessao_expirada";
  } else if (/mostraPopUpAlert\s*\(/i.test(body)) {
    motivo = "popup_alerta";
    const m = body.match(/mostraPopUpAlert\(\s*['"]([^'"]+)['"]\s*,\s*['"]([^'"]+)['"]/);
    if (m) detalhe = `${m[1]} - ${m[2]}`.slice(0, 200);
    // Caso típico: hiddenResposta com mensagem do servidor
    const hiddenResp = body.match(/id="MainContent_hiddenResposta"\s+value="([^"]+)"/);
    if (hiddenResp && hiddenResp[1]) detalhe = (detalhe ? `${detalhe} | ` : "") + `hiddenResposta='${hiddenResp[1]}'`;
  } else {
    const lbl = body.match(/<span[^>]*id="[^"]*(lbl(?:Msg|Erro|Mensagem|Aviso))[^"]*"[^>]*>([\s\S]{0,400}?)<\/span>/i);
    if (lbl) {
      const txt = lbl[2].replace(/<[^>]+>/g, "").replace(/\s+/g, " ").trim();
      if (txt) { motivo = "mensagem_servidor"; detalhe = txt.slice(0, 200); }
    }
  }

  await log("warn", `[consulta svc=${servicoId}] sem margem motivo='${motivo}'${detalhe ? ` detalhe='${detalhe}'` : ""}`);
  return { margem: null, motivo: detalhe ? `${motivo}: ${detalhe}` : motivo };
}

// Consulta os 3 serviços (1, 2, 3) no mesmo órgão e retorna agregado
interface OrgaoConsultaResult {
  margem_emprestimo: number | null;
  margem_cartao_credito: number | null;
  margem_cartao_beneficio: number | null;
  servidor?: string; matricula?: string; categoria?: string; situacao?: string;
  motivos: Record<string, string>;
}

async function consultarMargensNoOrgao(
  s: Session, cpf: string, consultaPath: string, log: LogFn,
): Promise<OrgaoConsultaResult> {
  const out: OrgaoConsultaResult = {
    margem_emprestimo: null, margem_cartao_credito: null, margem_cartao_beneficio: null,
    motivos: {},
  };
  const servicos: { id: string; nome: string; key: "margem_emprestimo" | "margem_cartao_credito" | "margem_cartao_beneficio" }[] = [
    { id: "1", nome: "Empréstimo Consignado", key: "margem_emprestimo" },
    { id: "2", nome: "Cartão de Crédito", key: "margem_cartao_credito" },
    { id: "3", nome: "Cartão Benefício", key: "margem_cartao_beneficio" },
  ];
  // Faz UM GET da página de consulta e reusa o HTML para os 3 serviços
  const CONSULTA_URL = consultaPath.startsWith("http") ? consultaPath : `${CONSIGUP_BASE}${consultaPath.startsWith("/") ? "" : "/"}${consultaPath}`;
  let preloaded: { url: string; body: string } | undefined;
  try {
    const page = await s.request(CONSULTA_URL);
    if (page.status === 200) preloaded = { url: CONSULTA_URL, body: page.body };
    else await log("warn", `[orgao] GET página consulta status ${page.status}`);
  } catch (e) {
    await log("warn", `[orgao] GET página consulta erro: ${String(e).slice(0, 200)}`);
  }

  for (const svc of servicos) {
    try {
      const r = await consultarServico(s, cpf, consultaPath, svc.id, log, preloaded);
      out[svc.key] = r.margem;
      out.motivos[svc.id] = r.motivo;
      if (r.servidor && !out.servidor) out.servidor = r.servidor;
      if (r.matricula && !out.matricula) out.matricula = r.matricula;
      if (r.categoria && !out.categoria) out.categoria = r.categoria;
      if (r.situacao && !out.situacao) out.situacao = r.situacao;

      // Curto-circuito: se servidor não localizado neste órgão no 1º serviço,
      // não adianta consultar os outros 2 — pula órgão inteiro.
      if (svc.id === "1" && r.motivo.startsWith("servidor_nao_localizado")) {
        await log("info", `[orgao] servidor não localizado neste órgão — pulando serviços restantes`);
        out.motivos["2"] = "skipped_servidor_nao_localizado";
        out.motivos["3"] = "skipped_servidor_nao_localizado";
        break;
      }
    } catch (e) {
      out.motivos[svc.id] = `excecao: ${String(e).slice(0, 150)}`;
      await log("error", `[svc=${svc.id} ${svc.nome}] erro: ${String(e).slice(0, 300)}`);
    }
  }
  return out;
}

async function descobrirMenu(s: Session) {
  const home = await s.request(HOME_URL);
  console.log("[home] status:", home.status, "len:", home.body.length);

  // 1) Todos os <select> da página (procuramos o de órgão)
  const selects = home.body.match(/<select[\s\S]*?<\/select>/gi) || [];
  console.log("[home] total selects:", selects.length);
  selects.forEach((sel, i) => {
    const nameM = sel.match(/name="([^"]+)"/);
    const idM = sel.match(/id="([^"]+)"/);
    const opts = [...sel.matchAll(/<option[^>]*value="([^"]*)"[^>]*>([\s\S]*?)<\/option>/gi)]
      .map(m => `${m[1]}=${m[2].replace(/<[^>]+>/g,"").trim()}`);
    console.log(`[home] select#${i} name=${nameM?.[1]} id=${idM?.[1]} opts=${opts.length}:`, opts.slice(0, 12).join(" | "));
  });

  // 2) Links/âncoras com __doPostBack (menu lateral / topo)
  const postbacks = [...home.body.matchAll(/__doPostBack\(['"]([^'"]+)['"]\s*,\s*['"]([^'"]*)['"]\)/g)];
  console.log("[home] postbacks:", postbacks.length);
  postbacks.slice(0, 40).forEach((m, i) => console.log(`[home] pb#${i} target=${m[1]} arg=${m[2]}`));

  // 3) Âncoras cujo texto/href cite "órgão", "trocar", "convênio", "entidade"
  const anchors = [...home.body.matchAll(/<a\b[^>]*>([\s\S]*?)<\/a>/gi)];
  const interesting = anchors.filter(a => /[óo]rg[ãa]o|trocar|conv[êe]nio|entidade|prefeit|aracaju|smtt|funcaju/i.test(a[0]));
  console.log("[home] anchors interessantes:", interesting.length);
  interesting.slice(0, 25).forEach((a, i) =>
    console.log(`[home] a#${i}:`, a[0].replace(/\s+/g, " ").slice(0, 400))
  );

  // 4) Procurar nomes/códigos dos 8 órgãos no HTML cru
  const palavras = ["Aracaju Previd", "FUNCAJU", "SMTT", "EMSURB", "FUNDAT", "Conselhos Tutelares", "Cidade de Aracaju", "CTM"];
  for (const p of palavras) {
    const idx = home.body.indexOf(p);
    if (idx >= 0) {
      const snippet = home.body.slice(Math.max(0, idx - 200), idx + 300).replace(/\s+/g, " ");
      console.log(`[home] ctx '${p}':`, snippet);
    } else {
      console.log(`[home] ctx '${p}': NÃO ENCONTRADO`);
    }
  }

  // 5) Tentar URLs candidatas de "trocar órgão"
  const candidatos = [
    "/Inicio/TrocarOrgao.aspx",
    "/Inicio/SelecionarOrgao.aspx",
    "/Login/SelecionarOrgao.aspx",
    "/SelecionarOrgao.aspx",
    "/Inicio/EscolherEntidade.aspx",
  ];
  for (const path of candidatos) {
    const r = await s.request(`${CONSIGUP_BASE}${path}`);
    console.log(`[probe] ${path} -> status=${r.status} len=${r.body.length} finalUrl=${r.finalUrl}`);
    if (r.status === 200 && r.body.length > 500) {
      const sels = r.body.match(/<select[\s\S]*?<\/select>/gi) || [];
      sels.forEach((sel, i) => {
        const nameM = sel.match(/name="([^"]+)"/);
        const opts = [...sel.matchAll(/<option[^>]*value="([^"]*)"[^>]*>([\s\S]*?)<\/option>/gi)]
          .map(m => `${m[1]}=${m[2].replace(/<[^>]+>/g,"").trim()}`);
        console.log(`[probe ${path}] select#${i} name=${nameM?.[1]} opts:`, opts.slice(0, 12).join(" | "));
      });
    }
  }

  // 6) Header/topbar isolado
  const header = home.body.match(/<(header|div)[^>]*(topo|header|navbar|topbar)[^>]*>[\s\S]{0,4000}/i);
  if (header) console.log("[home] header-snippet:", header[0].replace(/\s+/g, " ").slice(0, 2000));
}

type LogFn = (level: "info" | "warn" | "error", msg: string) => Promise<void> | void;

interface ConsultaResultado {
  margem: number | null;
  margem_emprestimo: number | null;
  margem_cartao_credito: number | null;
  margem_cartao_beneficio: number | null;
  servidor_nome: string | null;
  matricula: string | null;
  categoria: string | null;
  situacao: string | null;
  orgao: string | null;
  erro: string | null;
}

interface ConsigUpCtx {
  s: Session;
  orgaos: OrgaoLink[];
}

async function novaSessaoConsigUp(log: LogFn, accountSlot: 1 | 2 = 1): Promise<ConsigUpCtx | { erro: string }> {
  const user = accountSlot === 2 ? Deno.env.get("CONSIGUP_USER_2") : Deno.env.get("CONSIGUP_USER");
  const pass = accountSlot === 2 ? Deno.env.get("CONSIGUP_PASS_2") : Deno.env.get("CONSIGUP_PASS");
  if (!user || !pass) return { erro: `Credenciais ConsigUp ausentes (slot ${accountSlot})` };
  const s = new Session();
  await log("info", `Login ConsigUp [slot ${accountSlot}] como ${user}`);
  const okLogin = await login(s, user, pass);
  if (!okLogin) return { erro: "Falha de login no ConsigUp" };
  const home = await s.request(HOME_URL);
  const orgaos = listarOrgaosDoHtml(home.body);
  if (orgaos.length === 0) return { erro: "Nenhum órgão encontrado no header" };
  await log("info", `Sessão pronta — ${orgaos.length} órgãos descobertos`);
  return { s, orgaos };
}

async function consultarCpfTodosOrgaos(
  cpf: string, log: LogFn, ctx: ConsigUpCtx,
): Promise<ConsultaResultado & { sessaoExpirada?: boolean }> {
  const empty: ConsultaResultado = {
    margem: null, margem_emprestimo: null, margem_cartao_credito: null, margem_cartao_beneficio: null,
    servidor_nome: null, matricula: null, categoria: null, situacao: null, orgao: null, erro: null,
  };

  const motivosOrgaos: Record<string, string> = {};
  let melhor: ConsultaResultado | null = null;
  let melhorTotal = -1;
  let sessaoExpirada = false;

  for (const o of ctx.orgaos) {
    await log("info", `=== Órgão ${o.codigo} ${o.nome} ===`);
    const sw = await selecionarOrgao(ctx.s, o.eventTarget);
    if (!sw.ok) { motivosOrgaos[o.codigo] = "falha_trocar_orgao"; continue; }

    const links = listarLinksSidebar(sw.html);
    const margemLink = links.find(l =>
      /margem|consulta.*margem|pr[ée]\s*-?\s*reservar|consultar/i.test(l.text)
      || /Margem|ConsultaMargem/i.test(l.href)
    );
    if (!margemLink) { motivosOrgaos[o.codigo] = "sem_link_margem"; continue; }

    try {
      const r = await consultarMargensNoOrgao(ctx.s, cpf, margemLink.href, log);
      const total = (r.margem_emprestimo ?? 0) + (r.margem_cartao_credito ?? 0) + (r.margem_cartao_beneficio ?? 0);
      const algumaMargem = r.margem_emprestimo !== null || r.margem_cartao_credito !== null || r.margem_cartao_beneficio !== null;
      const motivosStr = Object.entries(r.motivos).map(([k, v]) => `s${k}=${v}`).join("|");
      motivosOrgaos[o.codigo] = algumaMargem ? `ok(${total.toFixed(2)})` : motivosStr;
      await log("info", `[${o.codigo}] empréstimo=${r.margem_emprestimo} cartãoCred=${r.margem_cartao_credito} cartãoBenef=${r.margem_cartao_beneficio} total=${total.toFixed(2)}`);

      // Detecta sessão expirada para o handler re-logar
      if (Object.values(r.motivos).some((v) => /sessao_expirada/.test(v))) sessaoExpirada = true;

      if (algumaMargem && total > melhorTotal) {
        melhorTotal = total;
        melhor = {
          margem: total,
          margem_emprestimo: r.margem_emprestimo,
          margem_cartao_credito: r.margem_cartao_credito,
          margem_cartao_beneficio: r.margem_cartao_beneficio,
          servidor_nome: r.servidor ?? null,
          matricula: r.matricula ?? null,
          categoria: r.categoria ?? null,
          situacao: r.situacao ?? null,
          orgao: `${o.codigo} - ${o.nome}`,
          erro: null,
        };
      }
    } catch (e) {
      motivosOrgaos[o.codigo] = `excecao: ${String(e).slice(0, 150)}`;
      await log("error", `[${o.codigo}] erro consulta: ${String(e).slice(0, 300)}`);
    }
  }

  if (melhor) return { ...melhor, sessaoExpirada };

  const erroFinal = `Margem não localizada em nenhum órgão. ${Object.entries(motivosOrgaos).map(([k, v]) => `${k}=${v}`).join(" | ")}`;
  await log("warn", `[resumo] ${erroFinal}`);
  return { ...empty, erro: erroFinal.slice(0, 1000), sessaoExpirada };
}

// ---------- Classificador de erros ----------
function classificarErro(erro: string | null): string | null {
  if (!erro) return null;
  if (/Credenciais.*ausentes/i.test(erro)) return "credenciais_ausentes";
  if (/Falha de login/i.test(erro)) return "login_falhou";
  if (/Nenhum órgão/i.test(erro)) return "sem_orgaos";
  if (/sessao_expirada|sess[ãa]o expirou/i.test(erro)) return "sessao_expirada";
  if (/Margem não localizada/i.test(erro)) {
    // Extrai motivos por órgão: "01=sem_link_margem | 02=popup_alerta | ..."
    const partes = erro.split("|").map((p) => p.trim());
    const motivos = partes
      .map((p) => p.split("=")[1]?.trim())
      .filter((v): v is string => !!v && !/^ok\(/.test(v));
    if (motivos.length === 0) return "margem_nao_localizada";
    const allSemLink = motivos.every((m) => m === "sem_link_margem");
    if (allSemLink) return "sem_link_margem";
    if (motivos.some((m) => /popup_alerta/.test(m))) return "popup_alerta";
    if (motivos.some((m) => /sem_resultado/.test(m))) return "sem_resultado";
    if (motivos.some((m) => /falha_trocar_orgao/.test(m))) return "falha_trocar_orgao";
    if (motivos.some((m) => /excecao/.test(m))) return "excecao_consulta";
    return "margem_nao_localizada";
  }
  return "outro";
}

// ---------- Handler ----------

interface Payload {
  ids?: string[];
  parallel?: boolean;
  runId?: string;
  continueRun?: boolean;
  erroTipo?: string;
  maxAttempts?: number;
}

// Limites para evitar bater no CPU/wall-time da edge function
const MAX_WALL_MS = 60_000; // re-invoca após ~60s
const MAX_PER_INVOCATION = 25; // máximo de CPFs por invocação
const DEFAULT_MAX_ATTEMPTS = 3;
const BACKOFF_BASE_MS = 800; // backoff = base * 2^(tentativas-1), capado em 8s
const BACKOFF_MAX_MS = 8000;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  const startedAt = Date.now();

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

    const { ids, parallel, runId: continueRunId, continueRun, erroTipo, maxAttempts: maxAttemptsRaw }: Payload = await req.json().catch(() => ({}));
    const useParallel = !!parallel && !!Deno.env.get("CONSIGUP_USER_2") && !!Deno.env.get("CONSIGUP_PASS_2");
    const hasExplicitIds = !!ids && ids.length > 0;
    const hasErroTipo = !!erroTipo && erroTipo !== "all";
    const maxAttempts = Math.max(1, Math.min(10, maxAttemptsRaw ?? DEFAULT_MAX_ATTEMPTS));

    if (!continueRun) {
      const { data: activeRun } = await supabase
        .from("processar_runs")
        .select("id, status")
        .eq("user_id", userId)
        .in("status", ["running", "paused"])
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (activeRun) {
        return new Response(JSON.stringify({ runId: activeRun.id, alreadyRunning: true }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
    }

    // Antes de selecionar, limpa rows que ficaram em "processando" de invocações anteriores
    await supabase.from("consultas_margem").update({ status: "pendente" }).eq("user_id", userId).eq("status", "processando");
    if (hasExplicitIds && !continueRun) {
      await supabase.from("consultas_margem")
        .update({ status: "pendente", erro: null, erro_tipo: null })
        .eq("user_id", userId)
        .in("id", ids)
        .eq("status", "erro")
        .lt("tentativas", maxAttempts);
    }
    if (hasErroTipo && !continueRun && !hasExplicitIds) {
      // Reseta erros desse tipo (que ainda têm tentativas disponíveis) para pendente
      await supabase.from("consultas_margem")
        .update({ status: "pendente", erro: null, erro_tipo: null })
        .eq("user_id", userId)
        .eq("status", "erro")
        .eq("erro_tipo", erroTipo!)
        .lt("tentativas", maxAttempts);
    }

    let q = supabase.from("consultas_margem").select("id, cpf, tentativas").eq("user_id", userId);
    if (hasExplicitIds) q = q.in("id", ids);
    q = q.eq("status", "pendente").lt("tentativas", maxAttempts);
    q = q.order("tentativas", { ascending: true }); // processa primeiro quem tentou menos
    q = q.limit(MAX_PER_INVOCATION);
    const { data: rows, error: selErr } = await q;
    if (selErr) throw selErr;

    let runId: string;
    if (continueRun && continueRunId) {
      runId = continueRunId;
    } else {
      // Conta total real para o run
      let qCount = supabase.from("consultas_margem").select("id", { count: "exact", head: true }).eq("user_id", userId);
      if (hasExplicitIds) qCount = qCount.in("id", ids);
      else qCount = qCount.eq("status", "pendente");
      const { count } = await qCount;
      const { data: runData, error: runErr } = await supabase
        .from("processar_runs")
        .insert({ user_id: userId, status: "running", total: count ?? rows?.length ?? 0, processed: 0 })
        .select("id")
        .single();
      if (runErr) throw runErr;
      runId = runData!.id as string;
    }

    if (!rows || rows.length === 0) {
      await supabase.from("processar_runs").update({
        status: "completed", finished_at: new Date().toISOString(), updated_at: new Date().toISOString(),
      }).eq("id", runId);
      return new Response(JSON.stringify({ processed: 0, runId, done: true }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    await supabase.from("consultas_margem").update({ status: "processando", erro: null, erro_tipo: null }).in("id", rows.map((r) => r.id));

    // Contadores compartilhados — lê do DB para somar entre invocações
    const counterLock = { busy: false };
    const bumpCounter = async (isError: boolean) => {
      while (counterLock.busy) await new Promise((r) => setTimeout(r, 10));
      counterLock.busy = true;
      try {
        const { data: cur } = await supabase.from("processar_runs").select("processed, errors").eq("id", runId).maybeSingle();
        const processed = (cur?.processed ?? 0) + 1;
        const errors = (cur?.errors ?? 0) + (isError ? 1 : 0);
        await supabase.from("processar_runs").update({ processed, errors, updated_at: new Date().toISOString() }).eq("id", runId);
      } finally { counterLock.busy = false; }
    };

    // Fila compartilhada entre os workers
    const queue = [...rows];
    let stopRequested = false;
    let deadlineHit = false;

    const sysLog: LogFn = async (level, message) => {
      console.log(`[${level}] ${message}`);
    };

    const worker = async (slot: 1 | 2) => {
      let ctx: ConsigUpCtx | null = null;
      const ensureSession = async (): Promise<{ ok: true; ctx: ConsigUpCtx } | { ok: false; erro: string }> => {
        if (ctx) return { ok: true, ctx };
        const r = await novaSessaoConsigUp(sysLog, slot);
        if ("erro" in r) return { ok: false, erro: r.erro };
        ctx = r;
        return { ok: true, ctx };
      };

      while (true) {
        if (stopRequested) break;
        if (Date.now() - startedAt > MAX_WALL_MS) { deadlineHit = true; break; }
        // controle pausar/parar
        const { data: rs } = await supabase.from("processar_runs").select("status").eq("id", runId).maybeSingle();
        const runStatus = (rs?.status as string) ?? "running";
        if (runStatus === "stopped") { stopRequested = true; break; }
        if (runStatus === "paused") { await new Promise((r) => setTimeout(r, 2000)); continue; }

        const row = queue.shift() as { id: string; cpf: string; tentativas?: number } | undefined;
        if (!row) break;

        const log: LogFn = async (level, message) => {
          console.log(`[slot ${slot}][${level}] ${message}`);
          try {
            await supabase.from("processar_logs").insert({
              consulta_id: row.id, user_id: userId, level, message: `[slot ${slot}] ${message}`.slice(0, 4000),
            });
          } catch (e) { console.error("log insert err", e); }
        };

        // Backoff exponencial entre tentativas (apenas a partir da 2ª tentativa)
        const prevAttempts = row.tentativas ?? 0;
        if (prevAttempts > 0) {
          const wait = Math.min(BACKOFF_MAX_MS, BACKOFF_BASE_MS * Math.pow(2, prevAttempts - 1));
          await log("info", `Backoff de ${wait}ms antes da tentativa #${prevAttempts + 1} (CPF ${row.cpf})`);
          await new Promise((r) => setTimeout(r, wait));
        }
        await log("info", `Iniciando processamento do CPF ${row.cpf} (tentativa #${prevAttempts + 1}/${maxAttempts})`);

        const sess = await ensureSession();
        let r: ConsultaResultado & { sessaoExpirada?: boolean };
        if (!sess.ok) {
          r = {
            margem: null, margem_emprestimo: null, margem_cartao_credito: null, margem_cartao_beneficio: null,
            servidor_nome: null, matricula: null, categoria: null, situacao: null, orgao: null, erro: sess.erro,
          };
        } else {
          r = await consultarCpfTodosOrgaos(row.cpf, log, sess.ctx);
          if (r.sessaoExpirada) {
            await log("warn", "Sessão ConsigUp expirou — refazendo login");
            ctx = null;
            const sess2 = await ensureSession();
            if (sess2.ok) r = await consultarCpfTodosOrgaos(row.cpf, log, sess2.ctx);
          }
        }

        await log(r.erro ? "error" : "info", r.erro ? `Finalizado com erro: ${r.erro}` : `Finalizado. Margem total: ${r.margem} (órgão ${r.orgao})`);
        await supabase.from("consultas_margem").update({
          margem_disponivel: r.margem,
          margem_emprestimo: r.margem_emprestimo,
          margem_cartao_credito: r.margem_cartao_credito,
          margem_cartao_beneficio: r.margem_cartao_beneficio,
          servidor_nome: r.servidor_nome,
          matricula: r.matricula,
          categoria: r.categoria,
          situacao: r.situacao,
          orgao: r.orgao,
          erro: r.erro,
          erro_tipo: classificarErro(r.erro),
          tentativas: (row.tentativas ?? 0) + 1,
          status: r.erro ? "erro" : "concluido",
          processed_at: new Date().toISOString(),
        }).eq("id", row.id);

        await bumpCounter(!!r.erro);
      }
    };

    const task = (async () => {
      const workers = useParallel ? [worker(1), worker(2)] : [worker(1)];
      await Promise.all(workers);

      // Devolve qualquer linha ainda em "processando" para "pendente"
      await supabase.from("consultas_margem")
        .update({ status: "pendente" })
        .eq("user_id", userId)
        .eq("status", "processando");

      const { data: rs } = await supabase.from("processar_runs").select("status").eq("id", runId).maybeSingle();
      if (rs?.status === "stopped") {
        await supabase.from("processar_runs").update({
          status: "stopped", finished_at: new Date().toISOString(), updated_at: new Date().toISOString(),
        }).eq("id", runId);
        return;
      }

      // Se ainda há pendentes, re-invoca a função para continuar
      let qLeft = supabase.from("consultas_margem").select("id", { count: "exact", head: true })
        .eq("user_id", userId)
        .eq("status", "pendente");
      if (hasExplicitIds) qLeft = qLeft.in("id", ids);
      const { count: pendingLeft } = await qLeft;

      if ((pendingLeft ?? 0) > 0 && (deadlineHit || queue.length === 0)) {
        // Re-invoca a si mesmo (fire-and-forget) para continuar o run
        const url = `${Deno.env.get("SUPABASE_URL")}/functions/v1/processar-margens`;
        try {
          await fetch(url, {
            method: "POST",
            headers: { "Content-Type": "application/json", Authorization: authHeader },
            body: JSON.stringify({ ids, parallel, runId, continueRun: true, erroTipo, maxAttempts }),
          });
        } catch (e) {
          console.error("re-invoke failed", e);
        }
      } else {
        await supabase.from("processar_runs").update({
          status: "completed", finished_at: new Date().toISOString(), updated_at: new Date().toISOString(),
        }).eq("id", runId);
      }
    })();

    // @ts-ignore EdgeRuntime
    if (typeof EdgeRuntime !== "undefined") EdgeRuntime.waitUntil(task);
    else await task;

    return new Response(JSON.stringify({ enqueued: rows.length, runId, parallel: useParallel, continued: !!continueRun }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e) {
    console.error("processar-margens error", e);
    return new Response(JSON.stringify({ error: String(e) }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
