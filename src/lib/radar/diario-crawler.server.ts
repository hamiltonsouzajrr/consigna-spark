// diarioCrawlerService — server-only.
// Acessa a API oficial do Diário Oficial Eletrônico de Alagoas, identifica
// edições publicadas, e baixa os PDFs (principal e suplementos).
//
// API descoberta no frontend do site:
//   GET /apinova/api/editions/published?page=N  -> lista paginada de edições
//   GET /apinova/api/editions/downloadPdf/{id}  -> PDF binário da edição

import { createHash } from "crypto";

export const DIARIO_BASE = "https://diario.imprensaoficial.al.gov.br";
export const DIARIO_API = `${DIARIO_BASE}/apinova/api`;
const UA =
  "Mozilla/5.0 (compatible; RadarDiarioOficial/1.0; +https://lovable.dev) AppleWebKit/537.36";

// A busca diária deve usar apenas as edições do Diário Oficial do ano de 2026.
export const ANO_ALVO = 2026;

export type EdicaoApi = {
  id: number;
  number: number;
  edition_type_name: string;
  suplement: boolean;
  publication_date: string; // ISO
};

export type EdicaoNormalizada = {
  edition_id: string;
  numero_edicao: string;
  tipo_edicao: string;
  suplemento: boolean;
  data_publicacao: string; // YYYY-MM-DD
  url_pdf: string;
  url_origem: string;
  titulo: string;
  nome_arquivo: string;
};

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

function toYmd(iso: string): string {
  // publication_date vem como 2026-06-22T03:00:00Z; usamos só a data.
  return (iso || "").slice(0, 10);
}

function normalize(e: EdicaoApi): EdicaoNormalizada {
  const data = toYmd(e.publication_date);
  const tipo = e.edition_type_name || "Diário Oficial do Estado de Alagoas";
  const nome = `DOE-AL-${data}-ed${e.number}${e.suplement ? "-suplemento" : ""}.pdf`;
  return {
    edition_id: String(e.id),
    numero_edicao: String(e.number),
    tipo_edicao: tipo,
    suplemento: !!e.suplement,
    data_publicacao: data,
    url_pdf: `${DIARIO_API}/editions/downloadPdf/${e.id}`,
    url_origem: `${DIARIO_BASE}/edicoes`,
    titulo: `${tipo}${e.suplement ? " (Suplemento)" : ""} - Edição ${e.number} - ${data}`,
    nome_arquivo: nome,
  };
}

// Busca páginas da API até cobrir o intervalo de datas desejado (inclusive).
// Retorna todas as edições com data_publicacao entre dateFrom e dateTo (YYYY-MM-DD).
export async function listarEdicoes(opts: {
  dateFrom: string;
  dateTo: string;
  maxPages?: number;
  delayMs?: number;
}): Promise<EdicaoNormalizada[]> {
  const maxPages = opts.maxPages ?? 15;
  const delayMs = opts.delayMs ?? 800;
  const out: EdicaoNormalizada[] = [];

  for (let page = 1; page <= maxPages; page++) {
    const res = await fetch(`${DIARIO_API}/editions/published?page=${page}`, {
      headers: { Accept: "application/json", "User-Agent": UA },
      signal: AbortSignal.timeout(25000),
    });
    if (!res.ok) {
      throw new Error(`Falha ao consultar edições (HTTP ${res.status}).`);
    }
    const json = (await res.json()) as { status?: string; editions?: EdicaoApi[] };
    const editions = json.editions ?? [];
    if (editions.length === 0) break;

    let oldestInPage = "9999-99-99";
    for (const e of editions) {
      const d = toYmd(e.publication_date);
      if (d < oldestInPage) oldestInPage = d;
      // A busca diária considera apenas edições do ano de 2026.
      if (!d.startsWith(`${ANO_ALVO}-`)) continue;
      if (d >= opts.dateFrom && d <= opts.dateTo) out.push(normalize(e));
    }

    // A listagem vem do mais recente para o mais antigo. Se já passamos do
    // início do intervalo, não precisamos buscar mais páginas.
    if (oldestInPage < opts.dateFrom) break;
    if (page < maxPages) await sleep(delayMs);
  }

  return out;
}

// Lista todas as edições de um mês de 2026 usando o endpoint mensal da API:
//   GET /apinova/api/editions/published/{ano}/{mes}
// Retorna a lista normalizada e ordenada por data (mais antiga primeiro).
export async function listarEdicoesPorMes(opts: {
  ano: number;
  mes: number; // 1-12
}): Promise<EdicaoNormalizada[]> {
  const mes2 = String(opts.mes).padStart(2, "0");
  const res = await fetch(`${DIARIO_API}/editions/published/${opts.ano}/${mes2}`, {
    headers: { Accept: "application/json", "User-Agent": UA },
    signal: AbortSignal.timeout(25000),
  });
  if (!res.ok) {
    throw new Error(`Falha ao consultar edições de ${mes2}/${opts.ano} (HTTP ${res.status}).`);
  }
  const json = (await res.json()) as { status?: string; editions?: EdicaoApi[] };
  const editions = json.editions ?? [];
  const out = editions
    .filter((e) => toYmd(e.publication_date).startsWith(`${opts.ano}-`))
    .map(normalize);
  out.sort((a, b) => a.data_publicacao.localeCompare(b.data_publicacao));
  return out;
}

export type DownloadResult = {
  buffer: Uint8Array;
  hash: string;
  bytes: number;
  contentType: string;
};

export async function baixarPdf(url: string): Promise<DownloadResult> {
  const res = await fetch(url, {
    headers: { "User-Agent": UA, Accept: "application/pdf,*/*" },
    signal: AbortSignal.timeout(60000),
  });
  if (!res.ok) throw new Error(`Falha ao baixar PDF (HTTP ${res.status}).`);
  const ab = await res.arrayBuffer();
  const buffer = new Uint8Array(ab);
  const hash = createHash("sha256").update(buffer).digest("hex");
  return {
    buffer,
    hash,
    bytes: buffer.byteLength,
    contentType: res.headers.get("content-type") ?? "application/pdf",
  };
}

export { sleep };
