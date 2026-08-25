// Rotina semanal: varre os últimos 7 dias do Diário Oficial (em fila, para não
// estourar o tempo da requisição) e distribui o que estiver sem responsável.
// Protegida por apikey (chave anon), chamada pelo agendamento.

import { createFileRoute } from "@tanstack/react-router";

function isoDias(atras: number): string {
  const base = new Date(Date.now() - atras * 86_400_000);
  return base.toLocaleDateString("en-CA", { timeZone: "America/Maceio" });
}

export const Route = createFileRoute("/api/public/hooks/radar-semanal")({
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
          const dateTo = isoDias(0);
          const dateFrom = isoDias(7);
          const { iniciarBuscaJob } = await import("@/lib/radar/diario-scheduler.server");
          const job = await iniciarBuscaJob({
            periodo: "7d",
            periodoLabel: `Semanal ${dateFrom} a ${dateTo}`,
            dateFrom,
            dateTo,
          });

          const { distribuirPendentes } = await import("@/lib/radar/distribuicao.server");
          const dist = await distribuirPendentes(2000);

          return Response.json({ ok: true, job, distribuicao: dist, periodo: [dateFrom, dateTo] });
        } catch (e: any) {
          console.error("[radar-semanal] erro:", e?.message ?? e);
          return new Response(JSON.stringify({ error: String(e?.message ?? e) }), {
            status: 500,
            headers: { "Content-Type": "application/json" },
          });
        }
      },
    },
  },
});
