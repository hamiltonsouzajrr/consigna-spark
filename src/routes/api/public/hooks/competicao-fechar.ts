import { createFileRoute } from "@tanstack/react-router";

/**
 * Closes the weekly prospecting competition. Called by pg_cron every Friday
 * at 19:00 UTC (16:00 in Maceió). Protected by the project apikey header.
 */
export const Route = createFileRoute("/api/public/hooks/competicao-fechar")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const key = request.headers.get("apikey") ?? request.headers.get("authorization")?.replace("Bearer ", "");
        const expected = process.env["SUPABASE_ANON_KEY"] ?? process.env["SUPABASE_PUBLISHABLE_KEY"];
        if (!key || !expected || key !== expected) {
          return new Response(JSON.stringify({ error: "unauthorized" }), {
            status: 401,
            headers: { "Content-Type": "application/json" },
          });
        }
        try {
          const { fecharSemana } = await import("@/lib/prospeccao/competicao-fechar.server");
          const result = await fecharSemana();
          return new Response(JSON.stringify({ success: true, ...result }), {
            headers: { "Content-Type": "application/json" },
          });
        } catch (e) {
          return new Response(JSON.stringify({ success: false, error: (e as Error).message }), {
            status: 500,
            headers: { "Content-Type": "application/json" },
          });
        }
      },
    },
  },
});
