import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const BASE = "https://alagoas.safeconsig.com.br";
const LOGIN_URL = `${BASE}/safe/login`;
const MAX_HOPS = 6;

const inputSchema = z.object({
  cpf: z
    .string()
    .transform((v) => {
      const digits = String(v ?? "").replace(/\D/g, "");
      if (digits.length === 0 || digits.length > 11) return digits;
      return digits.padStart(11, "0");
    })
    .pipe(z.string().regex(/^\d{11}$/, "CPF deve conter até 11 dígitos numéricos")),
});

type SafeConsigResult = {
  status: "sem_email" | "enviado" | "nao_cadastrado" | "desconhecido" | "erro";
  message: string;
  raw?: string;
};

// ---------- Cookie jar ----------
type Jar = Map<string, string>;

function getSetCookieList(headers: Headers): string[] {
  const anyHeaders = headers as Headers & { getSetCookie?: () => string[] };
  if (typeof anyHeaders.getSetCookie === "function") return anyHeaders.getSetCookie();
  const raw = headers.get("set-cookie");
  return raw ? raw.split(/,(?=[^;]+=[^;]+)/) : [];
}

function ingestCookies(jar: Jar, headers: Headers) {
  for (const sc of getSetCookieList(headers)) {
    const first = sc.split(";")[0]?.trim();
    if (!first) continue;
    const eq = first.indexOf("=");
    if (eq <= 0) continue;
    const name = first.slice(0, eq).trim();
    const value = first.slice(eq + 1).trim();
    // Last-write-wins; treat empty value as delete
    if (value === "" || /expires=thu, 01 jan 1970/i.test(sc)) jar.delete(name);
    else jar.set(name, value);
  }
}

function cookieHeader(jar: Jar): string {
  return [...jar.entries()].map(([k, v]) => `${k}=${v}`).join("; ");
}

// ---------- Fetch with manual redirect + cookie jar ----------
type FetchOpts = {
  jar: Jar;
  method?: string;
  headers?: Record<string, string>;
  body?: string;
  /** Stop following when destination URL matches this predicate (returns the redirect response). */
  stopOn?: (url: string) => boolean;
};

async function fetchWithJar(initialUrl: string, opts: FetchOpts): Promise<{ response: Response; finalUrl: string; hops: string[] }> {
  let url = initialUrl;
  let method = opts.method ?? "GET";
  let body: string | undefined = opts.body;
  const baseHeaders = { ...(opts.headers ?? {}) };
  const hops: string[] = [];

  for (let i = 0; i < MAX_HOPS; i++) {
    const headers: Record<string, string> = { ...baseHeaders };
    const cookie = cookieHeader(opts.jar);
    if (cookie) headers["Cookie"] = cookie;

    const res = await fetch(url, {
      method,
      headers,
      body: method === "GET" || method === "HEAD" ? undefined : body,
      redirect: "manual",
    });
    ingestCookies(opts.jar, res.headers);
    hops.push(`${res.status} ${url}`);

    const isRedirect = res.status >= 300 && res.status < 400 && res.headers.get("location");
    if (!isRedirect) return { response: res, finalUrl: url, hops };

    const loc = res.headers.get("location")!;
    const next = new URL(loc, url).toString();

    if (opts.stopOn && opts.stopOn(next)) {
      return { response: res, finalUrl: next, hops };
    }

    // 303 / (302 + non-GET) → switch to GET, drop body. Otherwise keep method.
    if (res.status === 303 || (res.status === 302 && method !== "GET" && method !== "HEAD")) {
      method = "GET";
      body = undefined;
    }
    url = next;
  }

  throw new Error(`Limite de redirects atingido (${MAX_HOPS}). Trajetória: ${hops.join(" → ")}`);
}

// ---------- Parsers ----------
function extractViewState(html: string, index = 0): string | null {
  const ajax = [...html.matchAll(/ViewState:\d+"><!\[CDATA\[(.+?)\]\]>/gs)];
  if (ajax[index]?.[1]) return ajax[index][1];
  const hidden = html.match(/name="javax\.faces\.ViewState"[^>]*value="([^"]+)"/);
  return hidden?.[1] ?? null;
}

function extractRedirectFromXml(xml: string): string | null {
  const m = xml.match(/<redirect\s+url="([^"]+)"\s*\/?>/i);
  return m?.[1] ?? null;
}

function extractMessages(xml: string): string[] {
  const re = /<span class="ui-messages-(?:error|info)-summary">([\s\S]*?)<\/span>/g;
  return [...xml.matchAll(re)].map((m) =>
    m[1].replace(/<br\s*\/?>/g, "\n").replace(/\s+/g, " ").trim()
  );
}

function classify(messages: string[]): SafeConsigResult["status"] {
  const txt = messages.join(" ").toLowerCase();
  if (!txt) return "desconhecido";
  if (txt.includes("não existe um e-mail") || txt.includes("nao existe um e-mail")) return "sem_email";
  if (txt.includes("encaminhada") || txt.includes("enviada") || txt.includes("sucesso")) return "enviado";
  if (txt.includes("não encontrado") || txt.includes("nao encontrado") || txt.includes("inexistente")) return "nao_cadastrado";
  return "desconhecido";
}

// ---------- Server function ----------
export const consultarSafeConsig = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => inputSchema.parse(data))
  .handler(async ({ data }): Promise<SafeConsigResult> => {
    const { cpf } = data;
    const ua =
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36";
    const commonHeaders = {
      "User-Agent": ua,
      "Accept-Language": "pt-BR,pt;q=0.9,en;q=0.8",
      "Accept-Encoding": "gzip, deflate, br",
      Origin: BASE,
    };

    const jar: Jar = new Map();

    try {
      // ---- Etapa 1: GET login (segue redirects manualmente, mantendo cookies) ----
      const r1 = await fetchWithJar(LOGIN_URL, {
        jar,
        method: "GET",
        headers: { ...commonHeaders, Accept: "text/html,application/xhtml+xml" },
      });
      if (!r1.response.ok) {
        return {
          status: "erro",
          message: `Falha ao abrir SafeConsig (HTTP ${r1.response.status}). Trajetória: ${r1.hops.join(" → ")}`,
        };
      }
      const html1 = await r1.response.text();
      const vs1 = extractViewState(html1);
      if (!vs1) {
        return {
          status: "erro",
          message:
            "Não foi possível ler o token da sessão (etapa 1). O portal pode ter mudado o fluxo ou exigido seleção prévia. Use 'Verificar manualmente'.",
        };
      }

      // URL final pode ter mudado (e.g. /safe/login após seguir redirects)
      const loginEndpoint = r1.finalUrl;

      // ---- Etapa 2: AJAX click "Esqueci Minha Senha" ----
      const body2 = new URLSearchParams({
        "javax.faces.partial.ajax": "true",
        "javax.faces.source": "j_idt32",
        "javax.faces.partial.execute": "j_idt32",
        "javax.faces.partial.render": "formularioDeLogin",
        j_idt32: "j_idt32",
        idForm12344: "idForm12344",
        idLogin: "",
        senhaUsuario: "",
        "javax.faces.ViewState": vs1,
      });
      const r2 = await fetchWithJar(loginEndpoint, {
        jar,
        method: "POST",
        headers: {
          ...commonHeaders,
          "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8",
          Accept: "application/xml, text/xml, */*; q=0.01",
          "Faces-Request": "partial/ajax",
          "X-Requested-With": "XMLHttpRequest",
          Referer: loginEndpoint,
        },
        body: body2.toString(),
      });
      if (!r2.response.ok) {
        return { status: "erro", message: `Falha na etapa 2 (HTTP ${r2.response.status}).` };
      }
      const xml2 = await r2.response.text();
      if (extractRedirectFromXml(xml2)) {
        return {
          status: "erro",
          message: "A SafeConsig redirecionou a sessão na etapa 2 (provável expiração). Tente novamente.",
        };
      }
      const vs2 = extractViewState(xml2);
      if (!vs2) {
        return { status: "erro", message: "Não foi possível ler o token da sessão (etapa 2)." };
      }

      // ---- Etapa 3: POST CPF ----
      const body3 = new URLSearchParams({
        "javax.faces.partial.ajax": "true",
        "javax.faces.source": "resetBotom",
        "javax.faces.partial.execute": "form1",
        "javax.faces.partial.render": "form1 mensagens mensagens11",
        resetBotom: "resetBotom",
        form1: "form1",
        j_idt41: cpf,
        "javax.faces.ViewState": vs2,
      });
      const r3 = await fetchWithJar(loginEndpoint, {
        jar,
        method: "POST",
        headers: {
          ...commonHeaders,
          "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8",
          Accept: "application/xml, text/xml, */*; q=0.01",
          "Faces-Request": "partial/ajax",
          "X-Requested-With": "XMLHttpRequest",
          Referer: loginEndpoint,
        },
        body: body3.toString(),
      });
      if (!r3.response.ok) {
        return { status: "erro", message: `Falha na etapa 3 (HTTP ${r3.response.status}).` };
      }
      const xml3 = await r3.response.text();

      if (extractRedirectFromXml(xml3)) {
        return {
          status: "erro",
          message: "A sessão na SafeConsig expirou antes do envio. Tente novamente.",
        };
      }

      const messages = extractMessages(xml3);
      const status = classify(messages);
      const message =
        messages.join("\n") ||
        "Resposta vazia da SafeConsig. Verifique o CPF e tente novamente.";

      return { status, message, raw: messages.length ? undefined : xml3.slice(0, 1200) };
    } catch (e) {
      const err = e as Error & { cause?: unknown };
      const cause =
        err.cause instanceof Error ? err.cause.message : err.cause ? String(err.cause) : "";
      console.error("[safeconsig] fetch error", { message: err.message, cause, stack: err.stack });
      const isLoop = /redirect/i.test(err.message) || /redirect/i.test(cause);
      return {
        status: "erro",
        message: isLoop
          ? "Não foi possível concluir a verificação automática (loop de redirects no portal). Use 'Verificar manualmente'."
          : `${err.message || "Erro desconhecido"}${cause ? ` (causa: ${cause})` : ""}`,
      };
    }
  });
