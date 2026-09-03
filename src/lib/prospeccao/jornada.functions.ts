// Jornada de trabalho + contagem de prospecções do dia da consultora logada.
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { JORNADA_PADRAO, type Jornada } from "./jornada";

export type JornadaHoje = {
  jornada: Jornada;
  configurada: boolean;
  feitas: number;
  ligacoes: number;
  whatsapps: number;
};

const HHMM = z.string().regex(/^\d{2}:\d{2}(:\d{2})?$/);

function inicioDoDiaMaceioIso(): string {
  // 00:00 em Maceió (UTC-3) == 03:00 UTC do mesmo dia.
  const agora = new Date();
  const dia = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Maceio",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(agora);
  return `${dia}T03:00:00.000Z`;
}

export const getJornadaHoje = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<JornadaHoje> => {
    const { supabase, userId } = context;

    const { data: row } = await supabase
      .from("prospect_jornada")
      .select("inicio, fim, almoco_inicio, almoco_minutos, meta_diaria")
      .eq("user_id", userId)
      .maybeSingle();

    const jornada: Jornada = row
      ? {
          inicio: String(row.inicio).slice(0, 5),
          fim: String(row.fim).slice(0, 5),
          almoco_inicio: String(row.almoco_inicio).slice(0, 5),
          almoco_minutos: Number(row.almoco_minutos),
          meta_diaria: Number(row.meta_diaria),
        }
      : JORNADA_PADRAO;

    const desde = inicioDoDiaMaceioIso();
    const { data: eventos } = await supabase
      .from("lead_events")
      .select("kind")
      .eq("consultant_id", userId)
      .in("kind", ["ligacao", "whatsapp"])
      .gte("created_at", desde);

    const lista = eventos ?? [];
    const ligacoes = lista.filter((e) => e.kind === "ligacao").length;
    const whatsapps = lista.filter((e) => e.kind === "whatsapp").length;

    return {
      jornada,
      configurada: Boolean(row),
      feitas: ligacoes + whatsapps,
      ligacoes,
      whatsapps,
    };
  });

export const salvarJornada = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) =>
    z
      .object({
        inicio: HHMM,
        fim: HHMM,
        almoco_inicio: HHMM,
        almoco_minutos: z.number().int().min(0).max(240),
        meta_diaria: z.number().int().min(1).max(2000).optional(),
      })
      .parse(data),
  )
  .handler(async ({ context, data }): Promise<{ ok: true }> => {
    const { supabase, userId } = context;
    const { error } = await supabase.from("prospect_jornada").upsert(
      {
        user_id: userId,
        inicio: data.inicio,
        fim: data.fim,
        almoco_inicio: data.almoco_inicio,
        almoco_minutos: data.almoco_minutos,
        ...(data.meta_diaria ? { meta_diaria: data.meta_diaria } : {}),
      },
      { onConflict: "user_id" },
    );
    if (error) throw new Error(error.message);
    return { ok: true };
  });
