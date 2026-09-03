// Rotina automática: distribui os leads do Diário Oficial que ainda estão sem
// responsável entre as consultoras com conta no sistema. Protegida por apikey.

import { createFileRoute } from "@tanstack/react-router";
import { autorizarCron } from "@/lib/security/cron-auth.server";

export const Route = createFileRoute("/api/public/hooks/radar-distribuir")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const auth = await autorizarCron(request);
        if (!auth.ok) return auth.response;
        try {
          const { distribuirPendentes } = await import("@/lib/radar/distribuicao.server");
          const res = await distribuirPendentes(1000);
          return Response.json({ ok: true, ...res });
        } catch (e: any) {
          console.error("[radar-distribuir] erro:", e?.message ?? e);
          return new Response(JSON.stringify({ error: String(e?.message ?? e) }), {
            status: 500,
            headers: { "Content-Type": "application/json" },
          });
        }
      },
    },
  },
});
