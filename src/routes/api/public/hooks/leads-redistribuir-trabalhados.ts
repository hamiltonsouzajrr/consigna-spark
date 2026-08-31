// Rotina automática: redistribui leads de prospecção já trabalhados e
// qualificados que estão com a mesma consultora há mais de 4 dias, mesmo que
// já tenham sido abordados. Protegida por apikey.

import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/public/hooks/leads-redistribuir-trabalhados")({
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
          const { redistribuirTrabalhadosInterno } = await import("@/lib/prospeccao/trabalhados.functions");
          const res = await redistribuirTrabalhadosInterno(4);
          return Response.json({ ok: true, ...res });
        } catch (e: any) {
          console.error("[leads-redistribuir-trabalhados] erro:", e?.message ?? e);
          return new Response(JSON.stringify({ error: String(e?.message ?? e) }), {
            status: 500,
            headers: { "Content-Type": "application/json" },
          });
        }
      },
    },
  },
});
