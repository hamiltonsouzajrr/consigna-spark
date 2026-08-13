import { createFileRoute } from "@tanstack/react-router";
import { reporTodasCarteiras } from "@/lib/prospeccao/tomadores-al.functions";

// Job diário: repõe a carteira (10 leads em aberto) de todas as consultoras
// ativas, sem depender de a consultora abrir a aba. Chamado por cron externo /
// pg_cron com o header x-cron-token = WHATSAPP_VERIFY_TOKEN.
async function run(request: Request) {
  const token = process.env["WHATSAPP_VERIFY_TOKEN"];
  const enviado = request.headers.get("x-cron-token") ?? new URL(request.url).searchParams.get("token");
  if (!token || enviado !== token) return new Response("Unauthorized", { status: 401 });

  try {
    const res = await reporTodasCarteiras();
    return Response.json({ ok: true, ...res });
  } catch (e: any) {
    return Response.json({ ok: false, error: String(e?.message ?? e) }, { status: 500 });
  }
}

export const Route = createFileRoute("/api/public/hooks/tomadores-repor")({
  server: {
    handlers: {
      GET: ({ request }) => run(request),
      POST: ({ request }) => run(request),
    },
  },
});
