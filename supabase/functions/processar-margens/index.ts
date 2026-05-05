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

async function consultarMargemNoOrgao(s: Session, cpf: string, consultaPath: string, log: LogFn): Promise<number | null> {
  const CONSULTA_URL = consultaPath.startsWith("http") ? consultaPath : `${CONSIGUP_BASE}${consultaPath.startsWith("/") ? "" : "/"}${consultaPath}`;
  await log("info", `GET ${CONSULTA_URL}`);
  const page = await s.request(CONSULTA_URL);
  if (page.status !== 200) {
    await log("warn", `[consulta] GET status ${page.status}`);
    return null;
  }
  const hidden = extractAllHidden(page.body);
  const form = new URLSearchParams();
  for (const [k, v] of Object.entries(hidden)) form.set(k, v);

  // Heurística: nome do campo de CPF (input text com 'cpf' no name/id)
  const cpfMatch = page.body.match(/<input[^>]+name="([^"]*[Cc][Pp][Ff][^"]*)"[^>]*>/);
  const cpfField = cpfMatch ? cpfMatch[1] : "ctl00$ContentPlaceHolder1$txtCPF";
  const cpfFmt = /^\d{11}$/.test(cpf)
    ? `${cpf.slice(0,3)}.${cpf.slice(3,6)}.${cpf.slice(6,9)}-${cpf.slice(9)}`
    : cpf;
  form.set(cpfField, cpfFmt);

  // Detecta botões: input submit, button, ou LinkButton (anchor com __doPostBack)
  // 1) input submit/button
  let btnName = "";
  let btnValue = "";
  const inputBtn = page.body.match(/<input[^>]+type="(?:submit|button)"[^>]*name="([^"]+)"[^>]*value="([^"]*(?:Consultar|Pesquisar|Buscar)[^"]*)"/i)
                || page.body.match(/<input[^>]+type="(?:submit|button)"[^>]*value="([^"]*(?:Consultar|Pesquisar|Buscar)[^"]*)"[^>]*name="([^"]+)"/i);
  if (inputBtn) {
    const isFirst = inputBtn[0].indexOf("name=") < inputBtn[0].indexOf("value=");
    btnName = isFirst ? inputBtn[1] : inputBtn[2];
    btnValue = isFirst ? inputBtn[2] : inputBtn[1];
  }
  // 2) LinkButton: <a id="..." href="javascript:__doPostBack('ctl00$...$btnConsultar','')">Consultar</a>
  let linkBtnTarget = "";
  const linkBtn = page.body.match(/<a[^>]+href="javascript:__doPostBack\(&#39;([^&]+(?:btnConsultar|btnPesquisar|btnBuscar|lnkConsultar)[^&]*)&#39;,&#39;[^&]*&#39;\)"[^>]*>\s*([^<]*(?:Consultar|Pesquisar|Buscar)[^<]*)/i);
  if (linkBtn) linkBtnTarget = linkBtn[1];

  // SEMPRE envia __EVENTTARGET + __EVENTARGUMENT para garantir o postback do WebForms.
  // Default conhecido: ctl00$MainContent$btnConsultar (confirmado nos logs anteriores).
  const eventTarget = linkBtnTarget || btnName || "ctl00$MainContent$btnConsultar";
  form.set("__EVENTTARGET", eventTarget);
  form.set("__EVENTARGUMENT", "");
  // Também envia o name=value do submit (alguns handlers checam Request.Form[btnName])
  if (btnName) {
    form.set(btnName, btnValue || "Consultar");
  } else if (!linkBtnTarget) {
    form.set("ctl00$MainContent$btnConsultar", "Consultar");
  }
  // Campos auxiliares que ASP.NET às vezes exige
  if (!form.has("__LASTFOCUS")) form.set("__LASTFOCUS", "");

  // ===== DETECÇÃO DE UpdatePanel / ScriptManager (AJAX async postback) =====
  // Sinais: ScriptResource/MicrosoftAjax/WebForms.js, <span id="...ScriptManager...">,
  // hidden __ASYNCPOST=true, ou um UpdatePanel cujo trigger seja o nosso botão.
  const hasScriptManager = /ScriptResource\.axd|MicrosoftAjax|WebForms\.js|Sys\.WebForms\.PageRequestManager/i.test(page.body);
  const hasAsyncPost = /name="__ASYNCPOST"/i.test(page.body) || hasScriptManager;
  // Procura UpdatePanel cujo ID contenha o botão como child (heurística leve)
  const updatePanelMatch = page.body.match(/<div[^>]+id="([^"]*UpdatePanel[^"]*)"/i);
  const updatePanelId = updatePanelMatch ? updatePanelMatch[1] : "";

  const headers: Record<string, string> = {
    "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8",
    Referer: CONSULTA_URL,
  };

  if (hasAsyncPost) {
    // Sinaliza ao ASP.NET que é um async postback do UpdatePanel
    form.set("__ASYNCPOST", "true");
    headers["X-MicrosoftAjax"] = "Delta=true";
    headers["X-Requested-With"] = "XMLHttpRequest";
    headers["Accept"] = "*/*";
    if (updatePanelId) {
      // Força o async postback a ser tratado por este UpdatePanel específico
      form.set("ctl00$ScriptManager1", `${updatePanelId}|${eventTarget}`);
    }
    await log("info", `[consulta] AJAX/UpdatePanel detectado (scriptMgr=${hasScriptManager} updatePanel=${updatePanelId || "n/a"}) — usando X-MicrosoftAjax=Delta=true`);
  } else {
    await log("info", `[consulta] postback síncrono (sem ScriptManager/UpdatePanel)`);
  }

  await log("info", `[consulta] POST __EVENTTARGET=${eventTarget} btnName=${btnName || "(none)"} cpfField=${cpfField}`);

  const res = await s.request(CONSULTA_URL, {
    method: "POST",
    headers,
    body: form.toString(),
  });

  // Se for resposta AJAX delta, o body começa com "<len>|<type>|..." — parseia para extrair o HTML
  let bodyForParse = res.body;
  if (hasAsyncPost && /^\d+\|/.test(res.body)) {
    await log("info", `[consulta] resposta delta AJAX recebida, parseando blocos`);
    bodyForParse = parseAjaxDelta(res.body, log);
  }
  // Substitui res.body para o resto do fluxo de parsing
  (res as any).body = bodyForParse;

  // ===== DUMP DIAGNÓSTICO DO RESPONSE =====
  await log("info", `[consulta] response len=${res.body.length}`);
  const head2k = res.body.slice(0, 2048).replace(/\s+/g, " ");
  await log("info", `[consulta] HTML[0..2048]: ${head2k}`);

  const palavrasResultado = ["Margem", "Disponível", "Disponivel", "Servidor", "Matrícula", "Matricula", "Resultado", "Erro", "Aviso", "Atenção", "Atencao"];
  for (const p of palavrasResultado) {
    const idx = res.body.toLowerCase().indexOf(p.toLowerCase());
    if (idx >= 0) {
      const snippet = res.body.slice(Math.max(0, idx - 200), idx + 400).replace(/\s+/g, " ");
      await log("info", `[consulta] ctx '${p}'@${idx}: ${snippet}`);
    }
  }

  const lblAll = [...res.body.matchAll(/<span[^>]*id="[^"]*(lbl[A-Z][A-Za-z]*|ValidationSummary)[^"]*"[^>]*>([\s\S]{0,400}?)<\/span>/gi)];
  for (const m of lblAll.slice(0, 10)) {
    const txt = m[2].replace(/<[^>]+>/g, "").replace(/\s+/g, " ").trim();
    if (txt) await log("info", `[consulta] ${m[1]}: ${txt.slice(0, 400)}`);
  }
  const popup = res.body.match(/mostraPopUpAlert\(\s*['"]([^'"]+)['"]\s*,\s*['"]([^'"]+)['"]/);
  if (popup) await log("warn", `[consulta] popup: ${popup[1]} - ${popup[2]}`);
  const mcIdx = res.body.indexOf("MainContent");
  if (mcIdx >= 0) {
    await log("info", `[consulta] MainContent@${mcIdx}: ${res.body.slice(mcIdx, mcIdx + 1800).replace(/\s+/g, " ")}`);
  }
  // ===== FIM DUMP =====

  // ===== Categorização do motivo (fallback quando não acha "Margem Disponível") =====
  const body = res.body;

  // 1) servidor não localizado / CPF inválido
  if (/n[ãa]o\s+(localizado|encontrado|cadastrado)|cpf\s+inv[áa]lido|servidor\s+inativo/i.test(body)) {
    await log("info", `[consulta] motivo: servidor não localizado/CPF inválido`);
    (consultarMargemNoOrgao as any)._lastMotivo = "servidor_nao_localizado";
    return 0;
  }

  // 2) Margem encontrada
  const marker = body.match(/Margem\s+Dispon[íi]vel[\s\S]{0,400}/i)
              || body.match(/(Margem\s+Livre|Valor\s+Dispon[íi]vel)[\s\S]{0,400}/i);
  if (marker) {
    (consultarMargemNoOrgao as any)._lastMotivo = "ok";
    return parseBRL(marker[0]);
  }

  // 3) Fallback: identificar por que NÃO veio resultado
  let motivo = "sem_resultado_desconhecido";
  let detalhe = "";

  // 3a) Sessão expirada / redirect para login
  if (/Login\.aspx|Sess[ãa]o\s+expirada|fa[çc]a\s+login|n[ãa]o\s+autorizado/i.test(body)) {
    motivo = "sessao_expirada";
  }
  // 3b) Erro do servidor ASP.NET (yellow screen)
  else if (/Server\s+Error\s+in|Runtime\s+Error|HTTP\s+Error\s+500|Exception\s+Details/i.test(body)) {
    motivo = "erro_servidor_aspnet";
    const exMatch = body.match(/Exception\s+Details:\s*([^<\n]+)/i);
    if (exMatch) detalhe = exMatch[1].trim().slice(0, 200);
  }
  // 3c) Mensagem de validação ASP.NET visível
  else if (/<span[^>]*ValidationSummary[^>]*>[\s\S]*?<li>([^<]+)<\/li>/i.test(body)) {
    motivo = "erro_validacao";
    const m = body.match(/<span[^>]*ValidationSummary[^>]*>[\s\S]*?<li>([^<]+)<\/li>/i);
    if (m) detalhe = m[1].trim().slice(0, 200);
  }
  // 3d) Popup de alerta JS
  else if (/mostraPopUpAlert\s*\(/i.test(body)) {
    motivo = "popup_alerta";
    const m = body.match(/mostraPopUpAlert\(\s*['"]([^'"]+)['"]\s*,\s*['"]([^'"]+)['"]/);
    if (m) detalhe = `${m[1]} - ${m[2]}`.slice(0, 200);
  }
  // 3e) lblMsg/lblErro/lblMensagem com texto
  else {
    const lbl = body.match(/<span[^>]*id="[^"]*(lbl(?:Msg|Erro|Mensagem|Aviso))[^"]*"[^>]*>([\s\S]{0,400}?)<\/span>/i);
    if (lbl) {
      const txt = lbl[2].replace(/<[^>]+>/g, "").replace(/\s+/g, " ").trim();
      if (txt) { motivo = "mensagem_servidor"; detalhe = txt.slice(0, 200); }
    }
  }

  // 3f) Página recarregada (mesmo formulário, sem área de resultado renderizada)
  if (motivo === "sem_resultado_desconhecido") {
    const temFormCpf = /name="[^"]*[Cc][Pp][Ff][^"]*"/.test(body) && /__VIEWSTATE/.test(body);
    const temAreaResultado = /grdResult|gvResult|grvResult|tblResult|divResult|dgResult|MainContent_(?:gv|grd|div|tbl)/i.test(body);
    if (temFormCpf && !temAreaResultado) {
      motivo = "pagina_recarregada_sem_resultado";
      detalhe = `len=${body.length}`;
    }
  }

  // 3g) Resposta vazia / curta demais
  if (body.length < 500) {
    motivo = "resposta_vazia";
    detalhe = `len=${body.length}`;
  }

  await log("warn", `[consulta] motivo='${motivo}'${detalhe ? ` detalhe='${detalhe}'` : ""} (len=${body.length})`);
  (consultarMargemNoOrgao as any)._lastMotivo = detalhe ? `${motivo}: ${detalhe}` : motivo;
  return null;
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

async function consultarCpfTodosOrgaos(cpf: string, log: LogFn): Promise<{ margem: number | null; erro: string | null; detalhes: Record<string, number | null> }> {
  const user = Deno.env.get("CONSIGUP_USER");
  const pass = Deno.env.get("CONSIGUP_PASS");
  if (!user || !pass) { await log("error", "Credenciais ConsigUp ausentes"); return { margem: null, erro: "Credenciais ConsigUp ausentes", detalhes: {} }; }

  const s = new Session();
  await log("info", `Iniciando login no ConsigUp como ${user}`);
  const okLogin = await login(s, user, pass);
  if (!okLogin) { await log("error", "Falha de login no ConsigUp"); return { margem: null, erro: "Falha de login no ConsigUp", detalhes: {} }; }
  await log("info", "Login OK, carregando home");

  const home = await s.request(HOME_URL);
  const orgaos = listarOrgaosDoHtml(home.body);
  await log("info", `Órgãos descobertos: ${orgaos.length}`);
  for (const o of orgaos) await log("info", `Órgão ${o.codigo} - ${o.nome} (target=${o.eventTarget})`);

  if (orgaos.length === 0) { await log("error", "Nenhum órgão encontrado no header"); return { margem: null, erro: "Nenhum órgão encontrado no header", detalhes: {} }; }

  const detalhes: Record<string, number | null> = {};
  let melhor: number | null = null;
  for (const o of orgaos) {
    await log("info", `=== Órgão ${o.codigo} ${o.nome} ===`);
    const sw = await selecionarOrgao(s, o.eventTarget);
    if (!sw.ok) { await log("warn", `[${o.codigo}] Falha ao trocar de órgão`); detalhes[o.codigo] = null; continue; }

    const links = listarLinksSidebar(sw.html);
    await log("info", `[${o.codigo}] Sidebar: ${links.length} links`);

    const margemLink = links.find(l =>
      /margem|consulta.*margem|pr[ée]\s*-?\s*reservar|consultar/i.test(l.text)
      || /Margem|ConsultaMargem/i.test(l.href)
    );
    if (!margemLink) {
      await log("warn", `[${o.codigo}] sem link de margem`);
      detalhes[o.codigo] = null;
      continue;
    }
    await log("info", `[${o.codigo}] usando link: ${margemLink.text} -> ${margemLink.href}`);
    try {
      const m = await consultarMargemNoOrgao(s, cpf, margemLink.href, log);
      detalhes[o.codigo] = m;
      await log("info", `[${o.codigo}] margem = ${m}`);
      if (m !== null && (melhor === null || m > melhor)) melhor = m;
    } catch (e) {
      await log("error", `[${o.codigo}] erro consulta: ${String(e).slice(0,300)}`);
      detalhes[o.codigo] = null;
    }
  }

  if (melhor === null) {
    return { margem: null, erro: "Margem não localizada em nenhum órgão", detalhes };
  }
  return { margem: melhor, erro: null, detalhes };
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
        const log: LogFn = async (level, message) => {
          console.log(`[${level}] ${message}`);
          try {
            await supabase.from("processar_logs").insert({
              consulta_id: row.id, user_id: userId, level, message: message.slice(0, 4000),
            });
          } catch (e) { console.error("log insert err", e); }
        };
        await log("info", `Iniciando processamento do CPF ${row.cpf}`);
        const { margem, erro } = await consultarCpfTodosOrgaos(row.cpf, log);
        await log(erro ? "error" : "info", erro ? `Finalizado com erro: ${erro}` : `Finalizado. Margem: ${margem}`);
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
