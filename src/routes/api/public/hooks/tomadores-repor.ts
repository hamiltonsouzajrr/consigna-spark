// Rotina automática: repõe as carteiras de tomadores AL. Protegida por apikey.
import { createFileRoute } from "@tanstack/react-router";
import { autorizarCron } from "@/lib/security/cron-auth.server";
import { reporTodasCarteirasInterno } from "@/lib/prospeccao/tomadores-al.functions";

export const Route = createFileRoute("/api/public/hooks/tomadores-repor")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const auth = await autorizarCron(request);
        if (!auth.ok) return auth.response;
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
