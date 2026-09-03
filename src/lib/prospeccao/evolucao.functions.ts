// Evolução da prospecção: semana vs semana e mês a mês (visão administrador).
import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export type PeriodoResumo = {
  label: string;
  inicio: string;
  contatos: number;
  followups: number;
  leadsTrabalhados: number;
};

export type EvolucaoProspeccao = {
  semanaAtual: PeriodoResumo;
  semanaAnterior: PeriodoResumo;
  meses: PeriodoResumo[];
  atualizadoEm: string;
};

const iso = (d: Date) => d.toISOString();

function inicioSemana(ref: Date): Date {
  const d = new Date(ref);
  d.setHours(0, 0, 0, 0);
  const dow = (d.getDay() + 6) % 7; // segunda = 0
  d.setDate(d.getDate() - dow);
  return d;
}

export const getEvolucaoProspeccao = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<EvolucaoProspeccao> => {
    const { supabase, userId } = context as any;
    const { assertAdmin } = await import("./prospeccao.server");
    await assertAdmin(supabase, userId);

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const db: any = supabaseAdmin;

    const agora = new Date();
    const semAtual = inicioSemana(agora);
    const semAnterior = new Date(semAtual);
    semAnterior.setDate(semAnterior.getDate() - 7);

    // Janela: 6 meses cheios (cobre também as duas semanas).
    const desde = new Date(agora.getFullYear(), agora.getMonth() - 5, 1);
    const desdeIso = iso(desde < semAnterior ? desde : semAnterior);

    const [eventos, tarefas] = await Promise.all([
      db
        .from("lead_events")
        .select("kind, lead_id, created_at")
        .in("kind", ["ligacao", "whatsapp"])
        .gte("created_at", desdeIso)
        .limit(100000),
      db
        .from("lead_tasks")
        .select("id, lead_id, created_at")
        .gte("created_at", desdeIso)
        .limit(100000),
    ]);

    const evs = (eventos?.data ?? []) as { lead_id: string; created_at: string }[];
    const tks = (tarefas?.data ?? []) as { lead_id: string; created_at: string }[];

    const resumo = (label: string, inicio: Date, fim: Date): PeriodoResumo => {
      const a = inicio.getTime();
      const b = fim.getTime();
      const leads = new Set<string>();
      let contatos = 0;
      for (const e of evs) {
        const t = new Date(e.created_at).getTime();
        if (t >= a && t < b) {
          contatos++;
          if (e.lead_id) leads.add(e.lead_id);
        }
      }
      let followups = 0;
      for (const t2 of tks) {
        const t = new Date(t2.created_at).getTime();
        if (t >= a && t < b) followups++;
      }
      return { label, inicio: iso(inicio), contatos, followups, leadsTrabalhados: leads.size };
    };

    const fimSemAtual = new Date(semAtual);
    fimSemAtual.setDate(fimSemAtual.getDate() + 7);

    const meses: PeriodoResumo[] = [];
    for (let i = 5; i >= 0; i--) {
      const ini = new Date(agora.getFullYear(), agora.getMonth() - i, 1);
      const fim = new Date(agora.getFullYear(), agora.getMonth() - i + 1, 1);
      const label = ini.toLocaleDateString("pt-BR", { month: "short", year: "2-digit" });
      meses.push(resumo(label, ini, fim));
    }

    return {
      semanaAtual: resumo("Semana atual", semAtual, fimSemAtual),
      semanaAnterior: resumo("Semana anterior", semAnterior, semAtual),
      meses,
      atualizadoEm: new Date().toISOString(),
    };
  });
