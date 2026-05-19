import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const BASE = "https://alagoas.safeconsig.com.br";
const LOGIN_URL = `${BASE}/safe/login`;

const inputSchema = z.object({
  cpf: z
    .string()
    .transform((v) => v.replace(/\D/g, ""))
    .pipe(z.string().regex(/^\d{11}$/, "CPF deve conter 11 dígitos")),
});

type SafeConsigResult = {
  status: "sem_email" | "enviado" | "nao_cadastrado" | "desconhecido" | "erro";
  message: string;
  raw?: string;
};

function parseSetCookie(headers: Headers): string {
  // Web fetch returns set-cookie as comma-joined; we need to split safely.
  // Cloudflare Workers expose getSetCookie() — use when available.
  const anyHeaders = headers as Headers & { getSetCookie?: () => string[] };
  const cookies = typeof anyHeaders.getSetCookie === "function"
    ? anyHeaders.getSetCookie()
    : (headers.get("set-cookie")?.split(/,(?=[^;]+=[^;]+)/) ?? []);
  return cookies
    .map((c) => c.split(";")[0]?.trim())
    .filter(Boolean)
    .join("; ");
}

function extractViewState(html: string, index = 0): string | null {
  // Try ajax CDATA form first
  const ajax = [...html.matchAll(/ViewState:\d+"><!\[CDATA\[(.+?)\]\]>/gs)];
  if (ajax[index]?.[1]) return ajax[index][1];
  // Fallback: hidden input
  const hidden = html.match(/name="javax\.faces\.ViewState"[^>]*value="([^"]+)"/);
  return hidden?.[1] ?? null;
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
  if (txt.includes("não existe um e-mail") || txt.includes("nao existe um e-mail"))
    return "sem_email";
  if (txt.includes("encaminhada") || txt.includes("enviada") || txt.includes("sucesso"))
    return "enviado";
  if (txt.includes("não encontrado") || txt.includes("nao encontrado") || txt.includes("inexistente"))
    return "nao_cadastrado";
  return "desconhecido";
}

export const consultarSafeConsig = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => inputSchema.parse(data))
  .handler(async ({ data }): Promise<SafeConsigResult> => {
    const { cpf } = data;
    const ua =
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36";

    try {
      // Step 1: GET login page
      const r1 = await fetch(LOGIN_URL, {
        headers: { "User-Agent": ua, Accept: "text/html" },
        redirect: "follow",
      });
      if (!r1.ok) return { status: "erro", message: `Falha ao abrir SafeConsig (HTTP ${r1.status}).` };
      const html1 = await r1.text();
      const vs1 = extractViewState(html1);
      const cookies1 = parseSetCookie(r1.headers);
      if (!vs1) return { status: "erro", message: "Não foi possível ler o token da sessão (etapa 1)." };

      // Step 2: AJAX click "Esqueci Minha Senha"
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
      const r2 = await fetch(LOGIN_URL, {
        method: "POST",
        headers: {
          "User-Agent": ua,
          "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8",
          "Faces-Request": "partial/ajax",
          "X-Requested-With": "XMLHttpRequest",
          Referer: LOGIN_URL,
          Cookie: cookies1,
        },
        body: body2.toString(),
      });
      if (!r2.ok) return { status: "erro", message: `Falha na etapa 2 (HTTP ${r2.status}).` };
      const xml2 = await r2.text();
      const vs2 = extractViewState(xml2);
      const cookies2Joined = [cookies1, parseSetCookie(r2.headers)].filter(Boolean).join("; ");
      if (!vs2) return { status: "erro", message: "Não foi possível ler o token da sessão (etapa 2)." };

      // Step 3: POST CPF
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
      const r3 = await fetch(LOGIN_URL, {
        method: "POST",
        headers: {
          "User-Agent": ua,
          "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8",
          "Faces-Request": "partial/ajax",
          "X-Requested-With": "XMLHttpRequest",
          Referer: LOGIN_URL,
          Cookie: cookies2Joined,
        },
        body: body3.toString(),
      });
      if (!r3.ok) return { status: "erro", message: `Falha na etapa 3 (HTTP ${r3.status}).` };
      const xml3 = await r3.text();

      // Detect session-expired redirect
      if (xml3.includes("<redirect")) {
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

      return { status, message, raw: messages.length ? undefined : xml3.slice(0, 800) };
    } catch (e) {
      return {
        status: "erro",
        message: e instanceof Error ? e.message : "Erro desconhecido ao consultar SafeConsig.",
      };
    }
  });
