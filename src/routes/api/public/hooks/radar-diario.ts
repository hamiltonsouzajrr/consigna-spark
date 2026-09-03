// Endpoint chamado pelo agendamento (pg_cron) às 06:30 em dias úteis.
// Protegido por apikey (chave anon). Executa a busca diária do Diário Oficial.

import { createFileRoute } from "@tanstack/react-router";
import { autorizarCron } from "@/lib/security/cron-auth.server";

export const Route = createFileRoute("/api/public/hooks/radar-diario")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const auth = await autorizarCron(request);
        if (!auth.ok) return auth.response;

        try {
          const { executarBusca } = await import("@/lib/radar/diario-scheduler.server");
          const hoje = new Date().toLocaleDateString("en-CA", { timeZone: "America/Maceio" });
          const res = await executarBusca({ dateFrom: hoje, dateTo: hoje, gatilho: "cron" });
          return Response.json({ ok: true, ...res });
        } catch (e: any) {
          console.error("[radar-diario] erro:", e?.message ?? e);
          return new Response(JSON.stringify({ error: String(e?.message ?? e) }), {
            status: 500,
            headers: { "Content-Type": "application/json" },
          });
        }
      },
    },
  },
});
