// Server functions (autenticadas) do painel "Busca Diária do Diário Oficial".
// Ações administrativas chamam os serviços server-only via import dinâmico.

import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

async function assertAdmin(supabase: any, userId: string) {
  const { data, error } = await supabase.rpc("has_role", { _user_id: userId, _role: "admin" });
  if (error) throw new Error(error.message);
  if (!data) throw new Error("Acesso restrito a administradores.");
}

function hojeMaceio(): string {
  return new Date().toLocaleDateString("en-CA", { timeZone: "America/Maceio" });
}
function diasAtras(n: number): string {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() - n);
  return d.toLocaleDateString("en-CA", { timeZone: "America/Maceio" });
}

export type Fonte = {
  id: string;
  data_consulta: string;
  data_publicacao: string | null;
  numero_edicao: string | null;
  tipo_edicao: string | null;
  titulo: string | null;
  suplemento: boolean;
  url_pdf: string | null;
  caminho_arquivo: string | null;
  status_download: string;
  status_processamento: string;
  total_paginas: number;
  total_registros_extraidos: number;
  requer_ocr: boolean;
  erro_processamento: string | null;
  arquivo_id: string | null;
  criado_em: string;
};

export type Alerta = {
  id: string;
  tipo: string;
  titulo: string;
  mensagem: string | null;
  severidade: string;
  fonte_id: string | null;
  lido: boolean;
  criado_em: string;
};

export type LogAutomacao = {
  id: string;
  executado_em: string;
  gatilho: string;
  url_consultada: string | null;
  arquivos_encontrados: number;
  arquivos_baixados: number;
  registros_extraidos: number;
  duracao_ms: number;
  erros: string | null;
};

export type BuscaDiariaDashboard = {
  ultimaConsulta: string | null;
  ultimaEdicao: { titulo: string | null; data: string | null } | null;
  pdfsHoje: number;
  aguardandoProcessamento: number;
  registrosHoje: number;
  promocoesConfirmadas: number;
  pendentesRevisao: number;
  falsosPositivos: number;
  alertasNaoLidos: number;
};

export const getBuscaDiariaDashboard = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<BuscaDiariaDashboard> => {
    const { supabase } = context;
    const hoje = hojeMaceio();

    const [{ data: fontes }, { data: regs }, { data: ultLog }, { count: alertas }] = await Promise.all([
      supabase
        .from("fontes_diario_oficial")
        .select("titulo,data_publicacao,status_processamento,criado_em")
        .order("criado_em", { ascending: false })
        .limit(2000),
      supabase
        .from("do_registros")
        .select("categoria,status_revisao,created_at")
        .limit(20000),
      supabase
        .from("diario_automacao_logs")
        .select("executado_em")
        .order("executado_em", { ascending: false })
        .limit(1),
      supabase.from("diario_alertas").select("id", { count: "exact", head: true }).eq("lido", false),
    ]);

    const f = fontes ?? [];
    const r = regs ?? [];
    const norm = (s: any) => String(s ?? "").trim();

    return {
      ultimaConsulta: ultLog?.[0]?.executado_em ?? null,
      ultimaEdicao: f[0] ? { titulo: f[0].titulo, data: f[0].data_publicacao } : null,
      pdfsHoje: f.filter((x) => norm(x.criado_em).slice(0, 10) === hoje).length,
      aguardandoProcessamento: f.filter((x) => ["pendente", "processando", "requer_ocr"].includes(norm(x.status_processamento))).length,
      registrosHoje: r.filter((x) => norm(x.created_at).slice(0, 10) === hoje).length,
      promocoesConfirmadas: r.filter((x) => norm(x.categoria) === "Promoção confirmada").length,
      pendentesRevisao: r.filter((x) => ["Novo", "Revisado"].includes(norm(x.status_revisao))).length,
      falsosPositivos: r.filter((x) => norm(x.categoria) === "Falso positivo" || norm(x.categoria) === "Honraria, sem promoção funcional confirmada").length,
      alertasNaoLidos: alertas ?? 0,
    };
  });

export const getFontes = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<Fonte[]> => {
    const { data, error } = await context.supabase
      .from("fontes_diario_oficial")
      .select(
        "id,data_consulta,data_publicacao,numero_edicao,tipo_edicao,titulo,suplemento,url_pdf,caminho_arquivo,status_download,status_processamento,total_paginas,total_registros_extraidos,requer_ocr,erro_processamento,arquivo_id,criado_em",
      )
      .order("criado_em", { ascending: false })
      .limit(500);
    if (error) throw new Error(error.message);
    return (data ?? []) as Fonte[];
  });

export const getAlertas = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<Alerta[]> => {
    const { data, error } = await context.supabase
      .from("diario_alertas")
      .select("id,tipo,titulo,mensagem,severidade,fonte_id,lido,criado_em")
      .order("criado_em", { ascending: false })
      .limit(100);
    if (error) throw new Error(error.message);
    return (data ?? []) as Alerta[];
  });

export const getLogsAutomacao = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<LogAutomacao[]> => {
    const { data, error } = await context.supabase
      .from("diario_automacao_logs")
      .select("id,executado_em,gatilho,url_consultada,arquivos_encontrados,arquivos_baixados,registros_extraidos,duracao_ms,erros")
      .order("executado_em", { ascending: false })
      .limit(50);
    if (error) throw new Error(error.message);
    return (data ?? []) as LogAutomacao[];
  });

export const marcarAlertaLido = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => z.object({ id: z.string().uuid().optional(), todos: z.boolean().optional() }).parse(data))
  .handler(async ({ context, data }): Promise<{ ok: true }> => {
    let q = context.supabase.from("diario_alertas").update({ lido: true });
    q = data.todos ? q.eq("lido", false) : q.eq("id", data.id ?? "");
    const { error } = await q;
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const getFontePdfUrl = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => z.object({ caminho: z.string().min(1) }).parse(data))
  .handler(async ({ context, data }): Promise<{ url: string }> => {
    const { data: signed, error } = await context.supabase.storage
      .from("diario-oficial")
      .createSignedUrl(data.caminho, 300);
    if (error) throw new Error(error.message);
    return { url: signed.signedUrl };
  });

// ---- Ações administrativas (executam o pipeline) ----

export type ResultadoBuscaDTO = {
  arquivos_encontrados: number;
  arquivos_baixados: number;
  registros_extraidos: number;
  duracao_ms: number;
  duplicados: number;
  requer_ocr: number;
  erros: string[];
  fontes: { id: string; nome: string; status: string; registros: number }[];
};

export const rodarBuscaAgora = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<ResultadoBuscaDTO> => {
    await assertAdmin(context.supabase, context.userId);
    const { executarBusca } = await import("./diario-scheduler.server");
    const hoje = hojeMaceio();
    return executarBusca({ dateFrom: hoje, dateTo: hoje, gatilho: "manual" });
  });

export const buscarPorData = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => z.object({ data: z.string().regex(/^\d{4}-\d{2}-\d{2}$/) }).parse(data))
  .handler(async ({ context, data }): Promise<ResultadoBuscaDTO> => {
    await assertAdmin(context.supabase, context.userId);
    const { executarBusca } = await import("./diario-scheduler.server");
    return executarBusca({ dateFrom: data.data, dateTo: data.data, gatilho: "data" });
  });

export const buscarIntervaloDias = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => z.object({ dias: z.union([z.literal(7), z.literal(30)]) }).parse(data))
  .handler(async ({ context, data }): Promise<ResultadoBuscaDTO> => {
    await assertAdmin(context.supabase, context.userId);
    const { executarBusca } = await import("./diario-scheduler.server");
    return executarBusca({ dateFrom: diasAtras(data.dias), dateTo: hojeMaceio(), gatilho: "intervalo" });
  });

export const reprocessarFonteFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => z.object({ id: z.string().uuid() }).parse(data))
  .handler(async ({ context, data }): Promise<ResultadoBuscaDTO> => {
    await assertAdmin(context.supabase, context.userId);
    const { reprocessarFonte } = await import("./diario-scheduler.server");
    return reprocessarFonte(data.id);
  });

// Extrai todas as edições de um mês de 2026 (retroativo). O botão "Extrair todo
// 2026" chama esta função mês a mês (janeiro a junho), pois processar o ano
// inteiro em uma única requisição estouraria o tempo limite do servidor.
export const extrairMes2026 = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) =>
    z.object({ mes: z.number().int().min(1).max(12) }).parse(data),
  )
  .handler(async ({ context, data }): Promise<ResultadoBuscaDTO> => {
    await assertAdmin(context.supabase, context.userId);
    const { executarBuscaMes } = await import("./diario-scheduler.server");
    return executarBuscaMes(2026, data.mes);
  });

// ---- Busca por período em segundo plano (fila com progresso) ----

export type BuscaJob = {
  id: string;
  status: string;
  periodo: string | null;
  periodo_label: string | null;
  date_from: string | null;
  date_to: string | null;
  total: number;
  processed: number;
  registros: number;
  erros: number;
  current_label: string | null;
  erro_msg: string | null;
  created_at: string;
  finished_at: string | null;
};

export type PromovidoPeriodo = {
  id: string;
  nome_completo: string | null;
  nome_servidor: string;
  nome_parcial: string | null;
  cpf_parcial: string | null;
  cargo_atual: string | null;
  cargo_promovido: string | null;
  data_promocao: string | null;
  data_publicacao: string | null;
  matricula: string | null;
  orgao_lotacao: string | null;
  categoria: string | null;
  potencial_financeiro: string | null;
};

// Calcula início/fim (YYYY-MM-DD, fuso Maceió) para os períodos suportados.
function calcularPeriodo(periodo: "semana" | "mes" | "trimestre"): { dateFrom: string; dateTo: string } {
  const hojeStr = new Date().toLocaleDateString("en-CA", { timeZone: "America/Maceio" });
  const [y, m, d] = hojeStr.split("-").map(Number);
  const hoje = new Date(Date.UTC(y, m - 1, d));
  const ymd = (dt: Date) => dt.toISOString().slice(0, 10);

  if (periodo === "semana") {
    const dow = hoje.getUTCDay(); // 0=domingo
    const diffSegunda = (dow + 6) % 7; // dias desde a segunda-feira
    const inicio = new Date(hoje);
    inicio.setUTCDate(hoje.getUTCDate() - diffSegunda);
    return { dateFrom: ymd(inicio), dateTo: hojeStr };
  }
  if (periodo === "mes") {
    return { dateFrom: `${y}-${String(m).padStart(2, "0")}-01`, dateTo: hojeStr };
  }
  // trimestre
  const primeiroMesTri = Math.floor((m - 1) / 3) * 3 + 1;
  return { dateFrom: `${y}-${String(primeiroMesTri).padStart(2, "0")}-01`, dateTo: hojeStr };
}

const PERIODO_LABEL: Record<string, string> = {
  semana: "Esta semana",
  mes: "Este mês",
  trimestre: "Este trimestre",
};

// Inicia uma busca por período: enfileira as edições e devolve o job para
// acompanhamento. O processamento roda em segundo plano (fila + cron).
export const iniciarBuscaPromocoes = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) =>
    z.object({ periodo: z.enum(["semana", "mes", "trimestre"]) }).parse(data),
  )
  .handler(async ({ context, data }): Promise<{ jobId: string; total: number }> => {
    await assertAdmin(context.supabase, context.userId);
    const { dateFrom, dateTo } = calcularPeriodo(data.periodo);
    const { iniciarBuscaJob } = await import("./diario-scheduler.server");
    return iniciarBuscaJob({
      periodo: data.periodo,
      periodoLabel: PERIODO_LABEL[data.periodo],
      dateFrom,
      dateTo,
      createdBy: context.userId,
    });
  });

// Processa a próxima edição da fila do job (chamada em loop pelo cliente).
export const processarProximoDaFilaFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => z.object({ jobId: z.string().uuid() }).parse(data))
  .handler(async ({ context, data }) => {
    await assertAdmin(context.supabase, context.userId);
    const { processarProximoDaFila } = await import("./diario-scheduler.server");
    return processarProximoDaFila(data.jobId);
  });

// Lê o job por id (para atualizar a barra de progresso).
export const getBuscaJob = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => z.object({ jobId: z.string().uuid() }).parse(data))
  .handler(async ({ context, data }): Promise<BuscaJob | null> => {
    const { data: row, error } = await context.supabase
      .from("diario_busca_jobs")
      .select("id,status,periodo,periodo_label,date_from,date_to,total,processed,registros,erros,current_label,erro_msg,created_at,finished_at")
      .eq("id", data.jobId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    return (row ?? null) as BuscaJob | null;
  });

// Job mais recente em andamento (para retomar a barra ao voltar à tela).
export const getJobAtivo = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<BuscaJob | null> => {
    const { data, error } = await context.supabase
      .from("diario_busca_jobs")
      .select("id,status,periodo,periodo_label,date_from,date_to,total,processed,registros,erros,current_label,erro_msg,created_at,finished_at")
      .in("status", ["running", "queued"])
      .order("created_at", { ascending: false })
      .limit(1);
    if (error) throw new Error(error.message);
    return (data?.[0] ?? null) as BuscaJob | null;
  });

// Resultados "promovidos recentemente" no período pesquisado, para a tabela e o CSV.
export const getPromovidosPeriodo = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) =>
    z
      .object({
        dateFrom: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
        dateTo: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
      })
      .parse(data),
  )
  .handler(async ({ context, data }): Promise<PromovidoPeriodo[]> => {
    // Mostra APENAS atos que representam promoção de fato. Categorias como
    // "Nomeação", "Aposentadoria", "Honraria", "Outro" ou concessões de
    // adicionais NÃO entram aqui, mesmo com potencial financeiro Alto.
    const categoriasPromo = [
      "Promoção confirmada",
      "Progressão funcional",
      "Reenquadramento",
      "Enquadramento",
      "Mudança de classe",
      "Mudança de nível",
      "Mudança de referência",
    ];
    const { data: rows, error } = await context.supabase
      .from("do_registros")
      .select(
        "id,nome_completo,nome_servidor,nome_parcial,cpf_parcial,cargo_atual,cargo_promovido,data_promocao,data_publicacao,matricula,orgao_lotacao,categoria,potencial_financeiro,status_revisao",
      )
      .neq("status_revisao", "Ignorado")
      .in("categoria", categoriasPromo)
      .gte("data_publicacao", data.dateFrom)
      .lte("data_publicacao", data.dateTo)
      .order("data_publicacao", { ascending: false })
      .limit(5000);
    if (error) throw new Error(error.message);
    return (rows ?? []) as PromovidoPeriodo[];
  });


