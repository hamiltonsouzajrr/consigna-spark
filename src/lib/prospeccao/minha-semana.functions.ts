// Painel por consultora: pontos da semana, tempo ativo, ritmo diário,
// histórico de pontuação por ação e evolução das últimas semanas.
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export type DiaRitmo = {
  data: string; // YYYY-MM-DD (Maceió)
  pontos: number;
  contatos: number;
  usoSegundos: number;
};

export type ExtratoLinha = {
  id: string;
  categoria: string;
  pontos: number;
  motivo: string | null;
  ref_tabela: string;
  ref_id: string;
  created_at: string;
  anulado_em: string | null;
  cliente: string | null;
};

export type VendaStandBy = {
  id: string;
  cliente_nome: string | null;
  origem: string;
  created_at: string;
  status: string;
};

export type SemanaHistorico = {
  weekStart: string;
  pontos: number;
  contatos: number;
  followups: number;
  ganhos: number;
  usoSegundos: number;
};

export type MinhaSemana = {
  userId: string;
  nome: string;
  weekStart: string;
  isAdmin: boolean;
  totais: { pontos: number; contatos: number; followups: number; ganhos: number };
  posicao: number | null;
  participantes: number;
  usoSemanaSegundos: number;
  usoHojeSegundos: number;
  metaDiaria: number;
  contatosHoje: number;
  pontosHoje: number;
  dias: DiaRitmo[];
  extrato: ExtratoLinha[];
  vendasPendentes: VendaStandBy[];
  historico: SemanaHistorico[];
  /** Variação média de pontos entre semanas consecutivas (pode ser negativa). */
  tendenciaMediaPontos: number;
  consultoras: Array<{ user_id: string; nome: string }>;
  atualizadoEm: string;
};

const DIA_MS = 86_400_000;

/** YYYY-MM-DD no fuso de Maceió. */
function diaMaceio(at: Date): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Maceio",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(at);
}

export const getMinhaSemana = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) =>
    z
      .object({
        userId: z.string().uuid().optional(),
        weekStart: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
      })
      .parse(data ?? {}),
  )
  .handler(async ({ context, data }): Promise<MinhaSemana> => {
    const { supabase, userId } = context;

    const { data: isAdminRaw } = await supabase.rpc("has_role", { _user_id: userId, _role: "admin" });
    const isAdmin = Boolean(isAdminRaw);

    const alvo = data.userId ?? userId;
    if (alvo !== userId && !isAdmin) throw new Error("Acesso restrito ao gestor.");

    const { adminClient, weekStart } = await import("./competicao.server");
    const db: any = await adminClient();

    const ws = data.weekStart ?? weekStart();
    const hoje = diaMaceio(new Date());

    // Nome + lista de consultoras (só para o seletor do gestor).
    const { data: perfil } = await db
      .from("profiles")
      .select("nome_completo")
      .eq("user_id", alvo)
      .maybeSingle();

    let consultoras: Array<{ user_id: string; nome: string }> = [];
    if (isAdmin) {
      const { data: rows } = await db
        .from("profiles")
        .select("user_id,nome_completo")
        .order("nome_completo", { ascending: true });
      consultoras = (rows ?? []).map((r: any) => ({ user_id: r.user_id, nome: r.nome_completo }));
    }

    // Pontos da semana (extrato completo).
    const { data: pontosSemana } = await db
      .from("prospect_pontos")
      .select("id,categoria,pontos,motivo,ref_tabela,ref_id,created_at,anulado_em")
      .eq("user_id", alvo)
      .eq("week_start", ws)
      .order("created_at", { ascending: false })
      .limit(400);
    const pontos = (pontosSemana ?? []) as any[];

    const validos = pontos.filter((p) => !p.anulado_em);
    const somaCat = (cat: string) =>
      validos.filter((p) => p.categoria === cat).reduce((s, p) => s + Number(p.pontos ?? 0), 0);
    const totais = {
      pontos: validos.reduce((s, p) => s + Number(p.pontos ?? 0), 0),
      contatos: somaCat("contato"),
      followups: somaCat("followup"),
      ganhos: somaCat("ganho"),
    };

    // Nomes de cliente por referência.
    const leadIds = [...new Set(pontos.filter((p) => p.ref_tabela === "prospect_leads").map((p) => p.ref_id))];
    const tomadorIds = [...new Set(pontos.filter((p) => p.ref_tabela === "tomadores_al").map((p) => p.ref_id))];
    const taskIds = [...new Set(pontos.filter((p) => p.ref_tabela === "lead_tasks").map((p) => p.ref_id))];
    const nomes = new Map<string, string>();
    if (leadIds.length) {
      const { data: rows } = await db.from("prospect_leads").select("id,nome").in("id", leadIds);
      for (const r of rows ?? []) nomes.set(`prospect_leads:${r.id}`, r.nome);
    }
    if (tomadorIds.length) {
      const { data: rows } = await db.from("tomadores_al").select("id,nome").in("id", tomadorIds);
      for (const r of rows ?? []) nomes.set(`tomadores_al:${r.id}`, r.nome);
    }
    if (taskIds.length) {
      const { data: rows } = await db.from("lead_tasks").select("id,title").in("id", taskIds);
      for (const r of rows ?? []) nomes.set(`lead_tasks:${r.id}`, r.title);
    }

    const extrato: ExtratoLinha[] = pontos.map((p) => ({
      id: p.id,
      categoria: p.categoria,
      pontos: Number(p.pontos ?? 0),
      motivo: p.motivo ?? null,
      ref_tabela: p.ref_tabela,
      ref_id: p.ref_id,
      created_at: p.created_at,
      anulado_em: p.anulado_em ?? null,
      cliente: nomes.get(`${p.ref_tabela}:${p.ref_id}`) ?? null,
    }));

    // Tempo ativo: semana atual + últimas 8 semanas para o gráfico.
    const inicio8 = new Date(new Date(`${ws}T12:00:00Z`).getTime() - 7 * 7 * DIA_MS);
    const { data: usoRows } = await db
      .from("app_uso_ativo")
      .select("ref_date,segundos")
      .eq("user_id", alvo)
      .gte("ref_date", inicio8.toISOString().slice(0, 10));
    const usoPorDia = new Map<string, number>();
    for (const r of (usoRows ?? []) as any[]) {
      usoPorDia.set(r.ref_date, Number(r.segundos ?? 0) + (usoPorDia.get(r.ref_date) ?? 0));
    }

    // Contatos por dia (eventos de ligação/whatsapp) na semana.
    const inicioSemanaIso = `${ws}T03:00:00.000Z`;
    const { data: eventos } = await db
      .from("lead_events")
      .select("created_at,kind")
      .eq("consultant_id", alvo)
      .in("kind", ["ligacao", "whatsapp"])
      .gte("created_at", inicioSemanaIso);

    const contatosPorDia = new Map<string, number>();
    for (const e of (eventos ?? []) as any[]) {
      const d = diaMaceio(new Date(e.created_at));
      contatosPorDia.set(d, (contatosPorDia.get(d) ?? 0) + 1);
    }

    const pontosPorDia = new Map<string, number>();
    for (const p of validos) {
      const d = diaMaceio(new Date(p.created_at));
      pontosPorDia.set(d, (pontosPorDia.get(d) ?? 0) + Number(p.pontos ?? 0));
    }

    const dias: DiaRitmo[] = [];
    let usoSemanaSegundos = 0;
    for (let i = 0; i < 7; i++) {
      const d = diaMaceio(new Date(new Date(`${ws}T12:00:00Z`).getTime() + i * DIA_MS));
      if (d > hoje) break;
      const usoSegundos = usoPorDia.get(d) ?? 0;
      usoSemanaSegundos += usoSegundos;
      dias.push({
        data: d,
        pontos: pontosPorDia.get(d) ?? 0,
        contatos: contatosPorDia.get(d) ?? 0,
        usoSegundos,
      });
    }

    // Meta diária da jornada.
    const { data: jornada } = await db
      .from("prospect_jornada")
      .select("meta_diaria")
      .eq("user_id", alvo)
      .maybeSingle();

    // Posição no ranking da semana.
    let posicao: number | null = null;
    let participantes = 0;
    const { data: ranking } = await db.rpc("ranking_competicao", { _week_start: ws });
    if (Array.isArray(ranking)) {
      participantes = ranking.length;
      const idx = ranking.findIndex((r: any) => r.user_id === alvo);
      posicao = idx >= 0 ? idx + 1 : null;
    }

    // Vendas aguardando conferência.
    const { data: vendas } = await db
      .from("prospect_vendas")
      .select("id,cliente_nome,origem,created_at,status")
      .eq("user_id", alvo)
      .eq("status", "pendente")
      .order("created_at", { ascending: false })
      .limit(20);

    // Histórico das últimas 8 semanas (pontos por categoria + tempo ativo).
    const { data: pontosHist } = await db
      .from("prospect_pontos")
      .select("week_start,categoria,pontos,anulado_em")
      .eq("user_id", alvo)
      .gte("week_start", diaMaceio(inicio8))
      .is("anulado_em", null);

    const histMap = new Map<string, SemanaHistorico>();
    const semanas: string[] = [];
    for (let i = 7; i >= 0; i--) {
      const d = new Date(new Date(`${ws}T12:00:00Z`).getTime() - i * 7 * DIA_MS);
      const key = d.toISOString().slice(0, 10);
      semanas.push(key);
      histMap.set(key, { weekStart: key, pontos: 0, contatos: 0, followups: 0, ganhos: 0, usoSegundos: 0 });
    }
    for (const p of (pontosHist ?? []) as any[]) {
      const alvoSemana = histMap.get(p.week_start);
      if (!alvoSemana) continue;
      const v = Number(p.pontos ?? 0);
      alvoSemana.pontos += v;
      if (p.categoria === "contato") alvoSemana.contatos += v;
      if (p.categoria === "followup") alvoSemana.followups += v;
      if (p.categoria === "ganho") alvoSemana.ganhos += v;
    }
    for (const [dia, seg] of usoPorDia) {
      // Encaixa cada dia na semana correspondente (segunda como início).
      for (let i = semanas.length - 1; i >= 0; i--) {
        const s = semanas[i]!;
        if (dia >= s) {
          const alvoSemana = histMap.get(s);
          if (alvoSemana) alvoSemana.usoSegundos += seg;
          break;
        }
      }
    }
    const historico = semanas.map((s) => histMap.get(s)!);

    // Tendência: variação média de pontos entre semanas com atividade.
    const comAtividade = historico.filter((h) => h.pontos > 0 || h.usoSegundos > 0);
    let tendenciaMediaPontos = 0;
    if (comAtividade.length >= 2) {
      let soma = 0;
      for (let i = 1; i < comAtividade.length; i++) {
        soma += comAtividade[i]!.pontos - comAtividade[i - 1]!.pontos;
      }
      tendenciaMediaPontos = Math.round(soma / (comAtividade.length - 1));
    }

    return {
      userId: alvo,
      nome: perfil?.nome_completo ?? "Consultora",
      weekStart: ws,
      isAdmin,
      totais,
      posicao,
      participantes,
      usoSemanaSegundos,
      usoHojeSegundos: usoPorDia.get(hoje) ?? 0,
      metaDiaria: Number(jornada?.meta_diaria ?? 250),
      contatosHoje: contatosPorDia.get(hoje) ?? 0,
      pontosHoje: pontosPorDia.get(hoje) ?? 0,
      dias,
      extrato,
      vendasPendentes: (vendas ?? []) as VendaStandBy[],
      historico,
      tendenciaMediaPontos,
      consultoras,
      atualizadoEm: new Date().toISOString(),
    };
  });
