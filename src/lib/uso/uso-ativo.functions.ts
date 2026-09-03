import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

export type UsoAtivo = {
  /** Segundos ativos acumulados hoje (fuso America/Maceio). */
  hoje: number;
  /** Segundos ativos acumulados na semana corrente. */
  semana: number;
};

const pingSchema = z.object({
  segundos: z.number().int().min(0).max(300),
});

/** Soma o tempo realmente ativo (cliques/digitação/scroll) ao contador do dia. */
export const registrarUsoAtivo = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => pingSchema.parse(data))
  .handler(async ({ context, data }): Promise<UsoAtivo> => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    if (data.segundos > 0) {
      await supabaseAdmin.rpc("registrar_uso_ativo" as never, {
        _user_id: context.userId,
        _segundos: data.segundos,
      } as never);
    }
    return lerUso(context.userId);
  });

/** Leitura do contador — usada na primeira renderização do relógio. */
export const getUsoAtivo = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<UsoAtivo> => lerUso(context.userId));

async function lerUso(userId: string): Promise<UsoAtivo> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const agora = new Date();
  const dia = agora.getUTCDay();
  const inicioSemana = new Date(agora);
  inicioSemana.setUTCDate(agora.getUTCDate() - ((dia + 6) % 7));
  const desde = inicioSemana.toISOString().slice(0, 10);
  const hojeStr = agora.toISOString().slice(0, 10);

  const { data } = await supabaseAdmin
    .from("app_uso_ativo")
    .select("ref_date, segundos")
    .eq("user_id", userId)
    .gte("ref_date", desde);

  let hoje = 0;
  let semana = 0;
  for (const r of (data ?? []) as Array<{ ref_date: string; segundos: number }>) {
    semana += Number(r.segundos ?? 0);
    if (r.ref_date === hojeStr) hoje = Number(r.segundos ?? 0);
  }
  return { hoje, semana };
}
