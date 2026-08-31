// Worker chamado pelo pg_cron: processa algumas edições pendentes das buscas
// por período que rodam em segundo plano. Protegido por apikey (chave anon).

import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/public/hooks/radar-diario-worker")({
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
