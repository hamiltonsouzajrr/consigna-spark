// Rotina automática: distribui os leads do Diário Oficial que ainda estão sem
// responsável entre as consultoras com conta no sistema. Protegida por apikey.

import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/public/hooks/radar-distribuir")({
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
