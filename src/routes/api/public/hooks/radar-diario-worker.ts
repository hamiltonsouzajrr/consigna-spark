// Worker chamado pelo pg_cron: processa algumas edições pendentes das buscas
// por período que rodam em segundo plano. Protegido por apikey (chave anon).

import { createFileRoute } from "@tanstack/react-router";
import { autorizarCron } from "@/lib/security/cron-auth.server";

export const Route = createFileRoute("/api/public/hooks/radar-diario-worker")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const auth = await autorizarCron(request);
        if (!auth.ok) return auth.response;

        try {
          const { processarJobsPendentes } = await import("@/lib/radar/diario-scheduler.server");
          const res = await processarJobsPendentes(1);
          return Response.json({ ok: true, ...res });
        } catch (e: any) {
          console.error("[radar-diario-worker] erro:", e?.message ?? e);
          return new Response(JSON.stringify({ error: String(e?.message ?? e) }), {
            status: 500,
            headers: { "Content-Type": "application/json" },
          });
        }
      },
    },
  },
});
