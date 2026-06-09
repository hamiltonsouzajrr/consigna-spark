// Pesquisa de clima semanal.
// Toda segunda-feira inicia uma nova semana de questionário (anônimo p/ a consultora).
// - getClimaWeek: semana atual, perguntas, se já respondeu e (admin) respostas detalhadas.
// - submitClimaResponse: cria/atualiza a resposta da consultora para a semana corrente.

import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export type ClimaQuestion = { id: string; label: string };

// Conjunto fixo de perguntas, aplicado a cada nova semana.
export const CLIMA_QUESTIONS: ClimaQuestion[] = [
  { id: "satisfacao", label: "Como foi sua satisfação geral nesta semana?" },
  { id: "carga", label: "A carga de trabalho desta semana foi equilibrada?" },
  { id: "lideranca", label: "Você se sentiu apoiada pela liderança?" },
  { id: "ambiente", label: "Como esteve o ambiente entre a equipe?" },
  { id: "reconhecimento", label: "Você se sentiu reconhecida pelo seu trabalho?" },
];

const QUESTION_IDS = CLIMA_QUESTIONS.map((q) => q.id);

/** Segunda-feira (ISO) da semana de uma data, em "YYYY-MM-DD". */
export function weekStartOf(date = new Date()): string {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const day = d.getUTCDay(); // 0=dom ... 1=seg
  const diff = day === 0 ? -6 : 1 - day;
  d.setUTCDate(d.getUTCDate() + diff);
  return d.toISOString().slice(0, 10);
}

/** Rótulo amigável "09/06" a partir de "YYYY-MM-DD". */
export function formatWeekLabel(weekStart: string): string {
  const [y, m, d] = weekStart.split("-");
  return `${d}/${m}/${y}`;
}

export type ClimaAdminResponse = {
  id: string;
  consultora: string;
  answers: Record<string, number>;
  comment: string | null;
  created_at: string;
};

export type ClimaWeek = {
  weekStart: string;
  questions: ClimaQuestion[];
  isAdmin: boolean;
  hasAnswered: boolean;
  myAnswers: Record<string, number> | null;
  myComment: string | null;
  // Admin only:
  totalResponses: number;
  averages: Record<string, number>;
  responses: ClimaAdminResponse[];
};

export const getClimaWeek = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<ClimaWeek> => {
    const { supabase, userId } = context;
    const weekStart = weekStartOf();

    const { data: isAdmin } = await supabase.rpc("has_role", {
      _user_id: userId,
      _role: "admin",
    });

    // Resposta da própria pessoa nesta semana.
    const { data: mine } = await supabase
      .from("rh_clima_responses")
      .select("answers, comment")
      .eq("user_id", userId)
      .eq("week_start", weekStart)
      .maybeSingle();

    const base: ClimaWeek = {
      weekStart,
      questions: CLIMA_QUESTIONS,
      isAdmin: !!isAdmin,
      hasAnswered: !!mine,
      myAnswers: (mine?.answers as Record<string, number>) ?? null,
      myComment: (mine?.comment as string) ?? null,
      totalResponses: 0,
      averages: {},
      responses: [],
    };

    if (!isAdmin) return base;

    // Admin: ver todas as respostas da semana com o nome da consultora.
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: rows } = await supabaseAdmin
      .from("rh_clima_responses")
      .select("id, user_id, answers, comment, created_at")
      .eq("week_start", weekStart)
      .order("created_at", { ascending: true });

    const { data: emps } = await supabaseAdmin
      .from("rh_employees")
      .select("user_id, full_name");

    const nameByUser = new Map<string, string>();
    for (const e of (emps ?? []) as any[]) {
      if (e.user_id) nameByUser.set(e.user_id as string, e.full_name as string);
    }

    const responses: ClimaAdminResponse[] = (rows ?? []).map((r: any) => ({
      id: r.id,
      consultora: nameByUser.get(r.user_id) ?? "Consultora (sem vínculo)",
      answers: (r.answers as Record<string, number>) ?? {},
      comment: (r.comment as string) ?? null,
      created_at: r.created_at,
    }));

    const averages: Record<string, number> = {};
    for (const qid of QUESTION_IDS) {
      const vals = responses
        .map((r) => r.answers[qid])
        .filter((v) => typeof v === "number" && !Number.isNaN(v));
      averages[qid] = vals.length
        ? Math.round((vals.reduce((a, b) => a + b, 0) / vals.length) * 10) / 10
        : 0;
    }

    return {
      ...base,
      totalResponses: responses.length,
      averages,
      responses,
    };
  });

export const submitClimaResponse = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) =>
    z
      .object({
        answers: z.record(
          z.enum(QUESTION_IDS as [string, ...string[]]),
          z.number().int().min(1).max(5),
        ),
        comment: z.string().max(1000).optional(),
      })
      .parse(data),
  )
  .handler(async ({ context, data }): Promise<{ ok: true }> => {
    const { supabase, userId } = context;
    const weekStart = weekStartOf();

    const { error } = await supabase.from("rh_clima_responses").upsert(
      {
        user_id: userId,
        week_start: weekStart,
        answers: data.answers,
        comment: data.comment ?? null,
      } as any,
      { onConflict: "user_id,week_start" },
    );
    if (error) throw new Error(error.message);
    return { ok: true };
  });
