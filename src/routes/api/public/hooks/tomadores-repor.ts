// Rotina automática: repõe as carteiras de tomadores AL. Protegida por apikey.
import { createFileRoute } from "@tanstack/react-router";
import { reporTodasCarteirasInterno } from "@/lib/prospeccao/tomadores-al.functions";

export const Route = createFileRoute("/api/public/hooks/tomadores-repor")({
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
          const result = await reporTodasCarteirasInterno();
          return Response.json({ ok: true, ...result });
        } catch (e: any) {
          return Response.json({ ok: false, error: e?.message ?? "unknown" }, { status: 500 });
        }
      },
    },
  },
});
