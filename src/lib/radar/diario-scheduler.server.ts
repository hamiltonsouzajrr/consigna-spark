// diarioSchedulerService — server-only.
// Orquestra a automação: consulta a API, baixa PDFs novos (evitando duplicidade),
// extrai texto, roda a IA, grava registros e mantém logs + alertas.
//
// Usa o cliente admin (service role) — chamado pelo cron e pelas server functions
// administrativas. Nunca importe este arquivo no bundle do cliente.

import { supabaseAdmin } from "@/integrations/supabase/client.server";
import {
  listarEdicoes,
  listarEdicoesPorMes,
  baixarPdf,
  sleep,
  DIARIO_BASE,
  type EdicaoNormalizada,
} from "./diario-crawler.server";
import { extrairTextoPdf, analisarTextoServidor } from "./diario-extraction.server";

const BUCKET = "diario-oficial";

type Gatilho = "cron" | "manual" | "data" | "intervalo";

export type ResultadoBusca = {
  arquivos_encontrados: number;
  arquivos_baixados: number;
  registros_extraidos: number;
  duracao_ms: number;
  duplicados: number;
  requer_ocr: number;
  erros: string[];
  fontes: { id: string; nome: string; status: string; registros: number }[];
};

async function criarAlerta(
  tipo: string,
  titulo: string,
  mensagem: string,
  severidade: "info" | "sucesso" | "alerta" | "erro",
  fonte_id?: string | null,
) {
  await supabaseAdmin.from("diario_alertas").insert({
    tipo,
    titulo,
    mensagem,
    severidade,
    fonte_id: fonte_id ?? null,
  });
}

// Insere registros extraídos em do_registros, marcando possíveis duplicados.
async function salvarRegistros(arquivoId: string, registros: any[]): Promise<{ inserted: number; duplicados: number }> {
  if (registros.length === 0) return { inserted: 0, duplicados: 0 };

  const { data: existing } = await supabaseAdmin
    .from("do_registros")
    .select("nome_servidor,matricula,orgao,data_publicacao,tipo_movimentacao")
    .limit(20000);
  const keyOf = (r: any) =>
    [r.nome_servidor, r.matricula, r.orgao, r.data_publicacao, r.tipo_movimentacao]
      .map((x) => String(x ?? "").trim().toLowerCase())
      .join("|");
  const existingKeys = new Set((existing ?? []).map(keyOf));
  const toDate = (v: string) => (/^\d{4}-\d{2}-\d{2}$/.test((v ?? "").trim()) ? v.trim() : null);

  let duplicados = 0;
  const seen = new Set<string>();
  const rows = registros.map((r) => {
    const norm = {
      nome_servidor: r.nome_servidor,
      matricula: r.matricula || null,
      orgao: r.orgao || null,
      data_publicacao: toDate(r.data_publicacao),
      tipo_movimentacao: r.tipo_movimentacao || null,
    };
    const key = keyOf(norm);
    const dup = existingKeys.has(key) || seen.has(key);
    if (dup) duplicados += 1;
    seen.add(key);
    return {
      arquivo_id: arquivoId,
      nome_servidor: r.nome_servidor,
      nome_completo: r.nome_completo || null,
      nome_parcial: r.nome_parcial || null,
      matricula: r.matricula || null,
      cpf_parcial: r.cpf_parcial || null,
      cargo: r.cargo || null,
      cargo_atual: r.cargo_atual || null,
      cargo_promovido: r.cargo_promovido || null,
      cargo_anterior: r.cargo_anterior || null,
      cargo_novo: r.cargo_novo || null,
      orgao: r.orgao || null,
      orgao_lotacao: r.orgao_lotacao || null,
      tipo_movimentacao: r.tipo_movimentacao || null,
      data_publicacao: toDate(r.data_publicacao),
      data_ato: toDate(r.data_ato),
      data_promocao: toDate(r.data_promocao),
      pagina: r.pagina || null,
      classe_anterior: r.classe_anterior || null,
      classe_nova: r.classe_nova || null,
      nivel_anterior: r.nivel_anterior || null,
      nivel_novo: r.nivel_novo || null,
      referencia_anterior: r.referencia_anterior || null,
      referencia_nova: r.referencia_nova || null,
      numero_ato: r.numero_ato || null,
      trecho_original: r.trecho_original || null,
      confianca_ia: r.confianca_ia || null,
      categoria: r.categoria || null,
      potencial_financeiro: r.potencial_financeiro || null,
      motivo_classificacao: r.motivo_classificacao || null,
      status_revisao: dup ? "Duplicado" : "Novo",
      duplicado_possivel: dup,
    };
  });

  const { error } = await supabaseAdmin.from("do_registros").insert(rows as any);
  if (error) throw new Error(error.message);
  return { inserted: rows.length, duplicados };
}

// Processa UMA edição: baixa, salva no storage, cria a fonte + do_arquivos,
// extrai texto e roda a IA. Retorna métricas. Atualiza/insere a fonte.
async function processarEdicao(
  ed: EdicaoNormalizada,
  res: ResultadoBusca,
  opts: { fonteId?: string },
) {
  // Dedup por chave única (data + numero + tipo + suplemento).
  const { data: existente } = await supabaseAdmin
    .from("fontes_diario_oficial")
    .select("id,hash_arquivo")
    .eq("data_publicacao", ed.data_publicacao)
    .eq("numero_edicao", ed.numero_edicao)
    .eq("tipo_edicao", ed.tipo_edicao)
    .eq("suplemento", ed.suplemento)
    .maybeSingle();

  if (existente && !opts.fonteId) {
    res.fontes.push({ id: existente.id, nome: ed.nome_arquivo, status: "ja_existente", registros: 0 });
    return; // não reprocessa, exceto via reprocessarFonte
  }

  let fonteId = opts.fonteId ?? existente?.id ?? null;

  // Cria/garante a linha da fonte.
  if (!fonteId) {
    const { data: nova, error } = await supabaseAdmin
      .from("fontes_diario_oficial")
      .insert({
        data_publicacao: ed.data_publicacao,
        numero_edicao: ed.numero_edicao,
        tipo_edicao: ed.tipo_edicao,
        suplemento: ed.suplemento,
        edition_id: ed.edition_id,
        titulo: ed.titulo,
        url_origem: ed.url_origem,
        url_pdf: ed.url_pdf,
        nome_arquivo: ed.nome_arquivo,
        status_download: "baixando",
        status_processamento: "pendente",
      })
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    fonteId = nova.id as string;
  } else {
    await supabaseAdmin
      .from("fontes_diario_oficial")
      .update({ status_download: "baixando", status_processamento: "pendente", erro_processamento: null })
      .eq("id", fonteId);
  }

  try {
    // Download.
    const dl = await baixarPdf(ed.url_pdf);
    res.arquivos_baixados += 1;
    const caminho = `auto/${ed.data_publicacao}/${ed.nome_arquivo}`;
    const { error: upErr } = await supabaseAdmin.storage
      .from(BUCKET)
      .upload(caminho, dl.buffer, { contentType: "application/pdf", upsert: true });
    if (upErr) throw new Error(`Upload falhou: ${upErr.message}`);

    await supabaseAdmin
      .from("fontes_diario_oficial")
      .update({ status_download: "concluido", hash_arquivo: dl.hash, caminho_arquivo: caminho, status_processamento: "processando" })
      .eq("id", fonteId);

    await criarAlerta(
      "nova_edicao",
      "Nova edição baixada",
      `${ed.titulo} (${(dl.bytes / 1024 / 1024).toFixed(1)} MB).`,
      "info",
      fonteId,
    );

    // Extração de texto.
    const ext = await extrairTextoPdf(dl.buffer);

    // Cria do_arquivos vinculado.
    const { data: arq, error: arqErr } = await supabaseAdmin
      .from("do_arquivos")
      .insert({
        nome_arquivo: ed.nome_arquivo,
        tipo_arquivo: "pdf",
        data_publicacao: ed.data_publicacao,
        numero_edicao: ed.numero_edicao,
        orgao_detectado: ed.tipo_edicao,
        caminho_arquivo: caminho,
        texto_extraido: ext.texto || null,
        status_processamento: ext.requerOcr ? "requer_ocr" : "processando",
      })
      .select("id")
      .single();
    if (arqErr) throw new Error(arqErr.message);
    const arquivoId = arq.id as string;

    if (ext.requerOcr) {
      await supabaseAdmin
        .from("fontes_diario_oficial")
        .update({
          status_processamento: "requer_ocr",
          requer_ocr: true,
          total_paginas: ext.totalPaginas,
          arquivo_id: arquivoId,
        })
        .eq("id", fonteId);
      res.requer_ocr += 1;
      await criarAlerta(
        "requer_ocr",
        "PDF sem texto extraível",
        `${ed.titulo} parece escaneado. Processe com OCR pela aba Importar.`,
        "alerta",
        fonteId,
      );
      res.fontes.push({ id: fonteId, nome: ed.nome_arquivo, status: "requer_ocr", registros: 0 });
      return;
    }

    // IA.
    const registros = await analisarTextoServidor({
      text: ext.texto,
      data_publicacao: ed.data_publicacao,
      orgao: ed.tipo_edicao,
    });
    const { inserted, duplicados } = await salvarRegistros(arquivoId, registros);
    res.registros_extraidos += inserted;
    res.duplicados += duplicados;

    await supabaseAdmin
      .from("do_arquivos")
      .update({ status_processamento: "concluido", total_registros_extraidos: inserted })
      .eq("id", arquivoId);

    await supabaseAdmin
      .from("fontes_diario_oficial")
      .update({
        status_processamento: "concluido",
        total_paginas: ext.totalPaginas,
        total_registros_extraidos: inserted,
        arquivo_id: arquivoId,
        erro_processamento: null,
      })
      .eq("id", fonteId);

    // Alertas de negócio.
    const confirmadas = registros.filter((r) => r.categoria === "Promoção confirmada").length;
    if (confirmadas > 0) {
      await criarAlerta(
        "promocao_confirmada",
        `${confirmadas} promoção(ões) confirmada(s)`,
        `Encontradas em ${ed.titulo}.`,
        "sucesso",
        fonteId,
      );
    }
    if (inserted > 10) {
      await criarAlerta(
        "muitos_registros",
        `${inserted} registros em uma edição`,
        `${ed.titulo} gerou ${inserted} possíveis movimentações.`,
        "info",
        fonteId,
      );
    }

    res.fontes.push({ id: fonteId, nome: ed.nome_arquivo, status: "concluido", registros: inserted });
  } catch (e: any) {
    const msg = String(e?.message ?? e);
    res.erros.push(`${ed.nome_arquivo}: ${msg}`);
    await supabaseAdmin
      .from("fontes_diario_oficial")
      .update({ status_download: "erro", status_processamento: "erro", erro_processamento: msg })
      .eq("id", fonteId);
    await criarAlerta("falha_download", "Falha ao processar edição", `${ed.titulo}: ${msg}`, "erro", fonteId);
    res.fontes.push({ id: fonteId!, nome: ed.nome_arquivo, status: "erro", registros: 0 });
  }
}

// Executa a busca para um intervalo de datas (inclusive).
export async function executarBusca(opts: {
  dateFrom: string;
  dateTo: string;
  gatilho?: Gatilho;
}): Promise<ResultadoBusca> {
  const inicio = Date.now();
  const res: ResultadoBusca = {
    arquivos_encontrados: 0,
    arquivos_baixados: 0,
    registros_extraidos: 0,
    duracao_ms: 0,
    duplicados: 0,
    requer_ocr: 0,
    erros: [],
    fontes: [],
  };

  let edicoes: EdicaoNormalizada[] = [];
  try {
    edicoes = await listarEdicoes({ dateFrom: opts.dateFrom, dateTo: opts.dateTo });
    res.arquivos_encontrados = edicoes.length;
  } catch (e: any) {
    const msg = String(e?.message ?? e);
    res.erros.push(`Listagem: ${msg}`);
    await criarAlerta("site_fora", "Diário Oficial indisponível", `Falha ao consultar o site: ${msg}`, "erro");
  }

  for (let i = 0; i < edicoes.length; i++) {
    await processarEdicao(edicoes[i], res, {});
    if (i < edicoes.length - 1) await sleep(1200); // boas práticas: intervalo entre downloads
  }

  res.duracao_ms = Date.now() - inicio;

  await supabaseAdmin.from("diario_automacao_logs").insert({
    gatilho: opts.gatilho ?? "manual",
    url_consultada: `${DIARIO_BASE}/edicoes`,
    arquivos_encontrados: res.arquivos_encontrados,
    arquivos_baixados: res.arquivos_baixados,
    registros_extraidos: res.registros_extraidos,
    duracao_ms: res.duracao_ms,
    erros: res.erros.length ? res.erros.join(" | ") : null,
    detalhe: { fontes: res.fontes, duplicados: res.duplicados, requer_ocr: res.requer_ocr, periodo: [opts.dateFrom, opts.dateTo] },
  });

  return res;
}

// Reprocessa uma fonte já registrada (re-download + extração + IA).
export async function reprocessarFonte(fonteId: string): Promise<ResultadoBusca> {
  const inicio = Date.now();
  const res: ResultadoBusca = {
    arquivos_encontrados: 1,
    arquivos_baixados: 0,
    registros_extraidos: 0,
    duracao_ms: 0,
    duplicados: 0,
    requer_ocr: 0,
    erros: [],
    fontes: [],
  };

  const { data: f, error } = await supabaseAdmin
    .from("fontes_diario_oficial")
    .select("*")
    .eq("id", fonteId)
    .single();
  if (error || !f) throw new Error("Fonte não encontrada.");

  const ed: EdicaoNormalizada = {
    edition_id: f.edition_id ?? "",
    numero_edicao: f.numero_edicao ?? "",
    tipo_edicao: f.tipo_edicao ?? "",
    suplemento: !!f.suplemento,
    data_publicacao: f.data_publicacao ?? "",
    url_pdf: f.url_pdf ?? "",
    url_origem: f.url_origem ?? `${DIARIO_BASE}/edicoes`,
    titulo: f.titulo ?? f.nome_arquivo ?? "Edição",
    nome_arquivo: f.nome_arquivo ?? "edicao.pdf",
  };

  await processarEdicao(ed, res, { fonteId });
  res.duracao_ms = Date.now() - inicio;

  await supabaseAdmin.from("diario_automacao_logs").insert({
    gatilho: "manual",
    url_consultada: ed.url_pdf,
    arquivos_encontrados: 1,
    arquivos_baixados: res.arquivos_baixados,
    registros_extraidos: res.registros_extraidos,
    duracao_ms: res.duracao_ms,
    erros: res.erros.length ? res.erros.join(" | ") : null,
    detalhe: { reprocessamento: fonteId, fontes: res.fontes },
  });

  return res;
}

// Extrai TODAS as edições de um mês de 2026 (retroativo). Usa o endpoint mensal
// da API. Edições já existentes são puladas (dedup), então pode ser re-executado
// com segurança para retomar de onde parou.
export async function executarBuscaMes(ano: number, mes: number): Promise<ResultadoBusca> {
  const inicio = Date.now();
  const res: ResultadoBusca = {
    arquivos_encontrados: 0,
    arquivos_baixados: 0,
    registros_extraidos: 0,
    duracao_ms: 0,
    duplicados: 0,
    requer_ocr: 0,
    erros: [],
    fontes: [],
  };

  let edicoes: EdicaoNormalizada[] = [];
  try {
    edicoes = await listarEdicoesPorMes({ ano, mes });
    res.arquivos_encontrados = edicoes.length;
  } catch (e: any) {
    const msg = String(e?.message ?? e);
    res.erros.push(`Listagem ${mes}/${ano}: ${msg}`);
    await criarAlerta("site_fora", "Diário Oficial indisponível", `Falha ao consultar ${mes}/${ano}: ${msg}`, "erro");
  }

  for (let i = 0; i < edicoes.length; i++) {
    await processarEdicao(edicoes[i], res, {});
    if (i < edicoes.length - 1) await sleep(1000);
  }

  res.duracao_ms = Date.now() - inicio;

  await supabaseAdmin.from("diario_automacao_logs").insert({
    gatilho: "intervalo",
    url_consultada: `${DIARIO_BASE}/edicoes (${String(mes).padStart(2, "0")}/${ano})`,
    arquivos_encontrados: res.arquivos_encontrados,
    arquivos_baixados: res.arquivos_baixados,
    registros_extraidos: res.registros_extraidos,
    duracao_ms: res.duracao_ms,
    erros: res.erros.length ? res.erros.join(" | ") : null,
    detalhe: { mes, ano, fontes: res.fontes, duplicados: res.duplicados, requer_ocr: res.requer_ocr },
  });

  return res;
}

// ---------------------------------------------------------------------------
// Busca em segundo plano (fila) — permite processar períodos longos (trimestre)
// edição por edição sem estourar o tempo limite, com progresso persistido.
// ---------------------------------------------------------------------------

export type JobProgresso = {
  done: boolean;
  processed: number;
  total: number;
  remaining: number;
  registros: number;
};

// Cria um job de busca: lista as edições do período (rápido, sem download) e
// enfileira cada uma para processamento posterior. Retorna o id do job.
export async function iniciarBuscaJob(opts: {
  periodo: string;
  periodoLabel: string;
  dateFrom: string;
  dateTo: string;
  createdBy?: string | null;
}): Promise<{ jobId: string; total: number }> {
  let edicoes: EdicaoNormalizada[] = [];
  edicoes = await listarEdicoes({ dateFrom: opts.dateFrom, dateTo: opts.dateTo });
  edicoes.sort((a, b) => a.data_publicacao.localeCompare(b.data_publicacao));

  const { data: job, error } = await supabaseAdmin
    .from("diario_busca_jobs")
    .insert({
      status: edicoes.length ? "running" : "done",
      periodo: opts.periodo,
      periodo_label: opts.periodoLabel,
      date_from: opts.dateFrom,
      date_to: opts.dateTo,
      total: edicoes.length,
      created_by: opts.createdBy ?? null,
      finished_at: edicoes.length ? null : new Date().toISOString(),
    } as any)
    .select("id")
    .single();
  if (error) throw new Error(error.message);
  const jobId = job.id as string;

  if (edicoes.length) {
    const rows = edicoes.map((ed, i) => ({ job_id: jobId, ordem: i, edicao: ed as any, status: "pendente" }));
    const { error: filaErr } = await supabaseAdmin.from("diario_busca_fila").insert(rows as any);
    if (filaErr) throw new Error(filaErr.message);
  }

  return { jobId, total: edicoes.length };
}

async function atualizarProgressoJob(jobId: string) {
  const { data: itens } = await supabaseAdmin
    .from("diario_busca_fila")
    .select("status,registros")
    .eq("job_id", jobId)
    .limit(5000);
  const list = itens ?? [];
  const processed = list.filter((i) => ["concluido", "erro"].includes(String(i.status))).length;
  const erros = list.filter((i) => String(i.status) === "erro").length;
  const registros = list.reduce((s, i) => s + (Number(i.registros) || 0), 0);
  const pendentes = list.filter((i) => ["pendente", "processando"].includes(String(i.status))).length;
  const finalizado = pendentes === 0 && list.length > 0;
  await supabaseAdmin
    .from("diario_busca_jobs")
    .update({
      processed,
      erros,
      registros,
      status: finalizado ? "done" : "running",
      finished_at: finalizado ? new Date().toISOString() : null,
      current_label: pendentes === 0 ? null : undefined,
    } as any)
    .eq("id", jobId);
  return { finalizado, processed, registros };
}

// Processa a PRÓXIMA edição pendente de um job. Reserva o item de forma atômica
// (claim), baixa/extrai/analisa e atualiza contadores. Chamável em loop pelo
// cliente e pelo cron; a reserva evita processamento duplicado.
export async function processarProximoDaFila(jobId: string): Promise<JobProgresso> {
  const { data: claimed } = await supabaseAdmin.rpc("claim_diario_fila_item", { _job_id: jobId });
  const item = Array.isArray(claimed) ? claimed[0] : claimed;

  if (!item || !item.id) {
    const prog = await atualizarProgressoJob(jobId);
    const { data: j } = await supabaseAdmin
      .from("diario_busca_jobs")
      .select("total,processed,registros")
      .eq("id", jobId)
      .single();
    return {
      done: true,
      processed: j?.processed ?? prog.processed,
      total: j?.total ?? 0,
      remaining: 0,
      registros: j?.registros ?? prog.registros,
    };
  }

  const ed = item.edicao as EdicaoNormalizada;
  await supabaseAdmin
    .from("diario_busca_jobs")
    .update({ current_label: ed.titulo } as any)
    .eq("id", jobId);

  const res: ResultadoBusca = {
    arquivos_encontrados: 1, arquivos_baixados: 0, registros_extraidos: 0,
    duracao_ms: 0, duplicados: 0, requer_ocr: 0, erros: [], fontes: [],
  };
  await processarEdicao(ed, res, {});

  await supabaseAdmin
    .from("diario_busca_fila")
    .update({
      status: res.erros.length ? "erro" : "concluido",
      registros: res.registros_extraidos,
      erro_msg: res.erros.length ? res.erros.join(" | ") : null,
    } as any)
    .eq("id", item.id);



  const prog = await atualizarProgressoJob(jobId);
  const { data: j } = await supabaseAdmin
    .from("diario_busca_jobs")
    .select("total,processed,registros")
    .eq("id", jobId)
    .single();
  const total = j?.total ?? 0;
  const processed = j?.processed ?? prog.processed;
  return {
    done: prog.finalizado,
    processed,
    total,
    remaining: Math.max(0, total - processed),
    registros: j?.registros ?? prog.registros,
  };
}

// Usado pelo cron: processa alguns itens pendentes de qualquer job em andamento.
export async function processarJobsPendentes(maxItens = 3): Promise<{ processados: number }> {
  const { data: jobs } = await supabaseAdmin
    .from("diario_busca_jobs")
    .select("id")
    .eq("status", "running")
    .order("created_at", { ascending: true })
    .limit(5);
  let processados = 0;
  for (const job of jobs ?? []) {
    for (let i = 0; i < maxItens; i++) {
      const prog = await processarProximoDaFila(job.id as string);
      if (prog.done) break;
      processados += 1;
      await sleep(800);
    }
  }
  return { processados };
}

