// Gatilho automático dos lembretes de follow-up (pode ser chamado por rotina
// externa/pg_cron). Somente dispara notificações internas — não retorna dados
// pessoais além das contagens agregadas.
import { createFileRoute } from "@tanstack/react-router";

async function run() {
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
  server: { handlers: { GET: () => run(), POST: () => run() } },
});
