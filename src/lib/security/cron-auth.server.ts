// Autenticação das rotinas automáticas (/api/public/hooks/*).
// A chave pública do aplicativo NÃO serve como segredo: ela fica no navegador
// de qualquer pessoa. Aqui exigimos um segredo dedicado, guardado no cofre
// interno (public.cron_secret, visível apenas para as rotinas internas) ou,
// alternativamente, na variável de ambiente CRON_SECRET.

let cache: { token: string; em: number } | null = null;
const TTL_MS = 60_000;

async function tokenDoCofre(): Promise<string | null> {
  if (cache && Date.now() - cache.em < TTL_MS) return cache.token;
  try {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data } = await (supabaseAdmin as any)
      .from("cron_secret")
      .select("token")
      .limit(1)
      .maybeSingle();
    const token = (data as { token?: string } | null)?.token ?? null;
    if (token) cache = { token, em: Date.now() };
    return token;
  } catch {
    return null;
  }
}

function iguais(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

export type CronAuthResult = { ok: true } | { ok: false; response: Response };

/** Valida o header `x-cron-secret` de uma rotina automática. */
export async function autorizarCron(request: Request): Promise<CronAuthResult> {
  const enviado =
    request.headers.get("x-cron-secret") ??
    request.headers.get("x-api-key") ??
    "";

  const envSecret = process.env["CRON_SECRET"] ?? "";
  const cofre = (await tokenDoCofre()) ?? "";

  const valido =
    enviado.length >= 16 &&
    ((!!envSecret && iguais(enviado, envSecret)) || (!!cofre && iguais(enviado, cofre)));

  if (valido) return { ok: true };

  return {
    ok: false,
    response: new Response(JSON.stringify({ error: "Não autorizado" }), {
      status: 401,
      headers: { "Content-Type": "application/json", "cache-control": "no-store" },
    }),
  };
}
