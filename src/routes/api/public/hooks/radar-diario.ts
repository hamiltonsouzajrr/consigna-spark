// Endpoint chamado pelo agendamento (pg_cron) às 06:30 em dias úteis.
// Protegido por apikey (chave anon). Executa a busca diária do Diário Oficial.

import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/public/hooks/radar-diario")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const apikey = request.headers.get("apikey") ?? request.headers.get("x-api-key") ?? "";
        const expected = process.env.SUPABASE_ANON_KEY ?? process.env.SUPABASE_PUBLISHABLE_KEY ?? "";
        if (!expected || apikey !== expected) {
          return new Response(JSON.stringify({ error: "Não autorizado" }), {
            status: 401,
            headers: { "Content-Type": "application/json" },
          });
        }

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
