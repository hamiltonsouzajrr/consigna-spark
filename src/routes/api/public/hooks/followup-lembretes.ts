// Gatilho automático dos lembretes de follow-up (chamado por rotina interna).
// Exige o segredo dedicado das rotinas automáticas.
import { createFileRoute } from "@tanstack/react-router";
import { autorizarCron } from "@/lib/security/cron-auth.server";

async function run(request: Request) {
  const auth = await autorizarCron(request);
  if (!auth.ok) return auth.response;

  const { dispararLembretesFollowup } = await import("@/lib/prospeccao/followups.server");
  try {
    const res = await dispararLembretesFollowup();
    return new Response(JSON.stringify({ ok: true, ...res }), {
      headers: { "content-type": "application/json", "cache-control": "no-store" },
    });
  } catch (e: any) {
    return new Response(JSON.stringify({ ok: false, error: String(e?.message ?? e) }), {
      status: 500,
      headers: { "content-type": "application/json", "cache-control": "no-store" },
    });
  }
}

export const Route = createFileRoute("/api/public/hooks/followup-lembretes")({
  server: { handlers: { GET: ({ request }) => run(request), POST: ({ request }) => run(request) } },
});
