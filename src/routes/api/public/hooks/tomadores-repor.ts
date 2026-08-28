import { createAPIFileRoute } from "@tanstack/react-start/api";
import { reporTodasCarteirasInterno } from "@/lib/prospeccao/tomadores-al.functions";

export const APIRoute = createAPIFileRoute("/api/public/hooks/tomadores-repor")({
  POST: async ({ request }) => {
    try {
      const result = await reporTodasCarteirasInterno();
      return Response.json({ ok: true, ...result });
    } catch (e: any) {
      return Response.json({ ok: false, error: e?.message ?? "unknown" }, { status: 500 });
    }
  },
});
