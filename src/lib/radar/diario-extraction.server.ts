// diarioExtractionService — server-only.
// Extrai texto de PDFs (compatível com o runtime serverless via unpdf) e
// aplica a IA do Lovable AI Gateway para classificar movimentações funcionais.

import { z } from "zod";

export type RegistroExtraido = {
  nome_servidor: string;
  matricula: string;
  cpf_parcial: string;
  cargo: string;
  orgao: string;
  tipo_movimentacao: string;
  data_publicacao: string;
  data_ato: string;
  pagina: string;
  classe_anterior: string;
  classe_nova: string;
  nivel_anterior: string;
  nivel_novo: string;
  referencia_anterior: string;
  referencia_nova: string;
  numero_ato: string;
  trecho_original: string;
  confianca_ia: string;
  categoria: string;
  potencial_financeiro: string;
  motivo_classificacao: string;
};

export type ExtracaoTexto = {
  texto: string;
  totalPaginas: number;
  requerOcr: boolean;
};

// Extrai o texto de UMA página respeitando o layout em colunas de jornal.
// Diários Oficiais usam 2 colunas; ler linearmente mistura o texto das duas,
// corrompendo nomes/CPFs. Aqui separamos os itens pela coordenada X (metade da
// largura da página) e reordenamos coluna esquerda -> coluna direita, cada uma
// de cima para baixo.
async function extrairTextoPaginaColunas(page: any): Promise<string> {
  const viewport = page.getViewport({ scale: 1 });
  const pageWidth = viewport.width || 600;
  const midX = pageWidth / 2;
  const content = await page.getTextContent();

  type Item = { str: string; x: number; y: number };
  const items: Item[] = [];
  for (const it of content.items as any[]) {
    const s = typeof it.str === "string" ? it.str : "";
    if (!s) continue;
    const tr = it.transform || [1, 0, 0, 1, 0, 0];
    items.push({ str: s, x: tr[4], y: tr[5] });
  }
  if (!items.length) return "";

  // Heurística: se quase tudo está de um lado só, trata como coluna única.
  const left = items.filter((i) => i.x < midX);
  const right = items.filter((i) => i.x >= midX);
  const duasColunas = left.length > items.length * 0.15 && right.length > items.length * 0.15;

  const montarColuna = (col: Item[]): string => {
    // Agrupa por linha (mesma faixa de Y) e ordena por X dentro da linha.
    const sorted = [...col].sort((a, b) => b.y - a.y || a.x - b.x);
    const linhas: string[] = [];
    let atualY: number | null = null;
    let buffer: Item[] = [];
    const flush = () => {
      if (!buffer.length) return;
      buffer.sort((a, b) => a.x - b.x);
      linhas.push(buffer.map((b) => b.str).join(" ").replace(/\s+/g, " ").trim());
      buffer = [];
    };
    for (const it of sorted) {
      if (atualY === null || Math.abs(it.y - atualY) <= 3) {
        buffer.push(it);
        atualY = atualY === null ? it.y : atualY;
      } else {
        flush();
        buffer = [it];
        atualY = it.y;
      }
    }
    flush();
    return linhas.join("\n");
  };

  if (!duasColunas) return montarColuna(items);
  return `${montarColuna(left)}\n${montarColuna(right)}`;
}

// Extrai o texto de um PDF respeitando colunas. Retorna requerOcr=true quando o
// PDF tem pouco/nenhum texto extraível (provavelmente escaneado -> precisa OCR).
export async function extrairTextoPdf(buffer: Uint8Array): Promise<ExtracaoTexto> {
  const { getDocumentProxy } = await import("unpdf");
  const pdf = await getDocumentProxy(buffer);
  const totalPages = pdf.numPages as number;
  const partes: string[] = [];
  for (let n = 1; n <= totalPages; n++) {
    try {
      const page = await pdf.getPage(n);
      const txt = await extrairTextoPaginaColunas(page);
      if (txt.trim()) partes.push(`\n===== Página ${n} =====\n${txt}`);
    } catch (e) {
      console.error(`[extrairTextoPdf] falha na página ${n}:`, String((e as any)?.message ?? e));
    }
  }
  let texto = partes.join("\n");
  // Fallback: se a leitura por coluna não rendeu texto, usa extração linear.
  if (texto.replace(/\s/g, "").length < 100) {
    try {
      const { extractText } = await import("unpdf");
      const { text } = await extractText(pdf, { mergePages: true });
      texto = (Array.isArray(text) ? text.join("\n") : text) ?? "";
    } catch {
      /* mantém o que houver */
    }
  }
  const limpo = texto.replace(/\u0000/g, "").trim();
  const requerOcr = limpo.replace(/\s/g, "").length < Math.max(200, totalPages * 40);
  return { texto: limpo, totalPaginas: totalPages, requerOcr };
}

export const SECOES_RADAR_PADRAO = [
  "Eventos Funcionais",
  "Atos e despachos do Governador",
  "Gabinete Civil",
  "SEPLAG",
  "Polícia Militar",
  "Corpo de Bombeiros",
  "Polícia Civil",
  "Secretaria de Educação",
  "Secretaria de Saúde",
];

const SYSTEM_PROMPT = `Você é um analista especializado em Diários Oficiais brasileiros. Seu objetivo é separar SERVIDORES PÚBLICOS (pessoas físicas) com MOVIMENTAÇÃO FUNCIONAL REAL de meras citações de nomes. A meta final é encontrar pessoas com possível melhora salarial.

PRIORIZE trechos que indiquem alteração funcional real, como:
- promoção na carreira, promovido(a) ao posto/cargo, promoção por merecimento, promoção por antiguidade
- progressão funcional, concessão/deferimento de progressão
- enquadramento, reenquadramento, reposicionamento
- mudança de classe, nível, referência ou padrão; elevação de padrão
- nomeação para cargo SUPERIOR ao anterior; aposentadoria com promoção; reserva remunerada; reforma
- publicação do ato de promoção

CHECAGEM DE FALSO POSITIVO — antes de classificar como promoção confirmada, pergunte internamente:
1. O texto fala de uma pessoa física (servidor)?
2. O texto indica alteração real de cargo, posto, classe, nível, padrão ou referência?
3. Existe sinal de impacto funcional ou remuneratório?
4. O trecho NÃO é sobre medalha, honraria, evento, festival, contrato, orçamento, ICMS ou licitação?
Se a resposta da pergunta 2 for "não", NÃO classifique como promoção confirmada.

NÃO considere como promoção de servidor quando o texto tratar de:
- promoção de eventos, promoção cultural, apoio a festivais
- medalhas, honrarias, comendas, homenagens, outorga de medalha
- licitações, contratos, índices municipais, ICMS, orçamento, crédito suplementar
- publicações de empresas ou particulares
Exemplo de falso positivo a IGNORAR: "PROMOÇÃO E APOIO AOS FESTIVAIS CULTURAIS".
Exemplo a classificar como HONRARIA: "Fica outorgada ao 2º Sargento BM a Medalha do Mérito".

MODELO REAL DE UM ATO DE PROMOÇÃO (use como âncora para extrair os campos):
As promoções em Diários Oficiais de AL geralmente seguem este molde:
  [NOME COMPLETO], inscrito(a) no CPF sob o n.º [CPF], matrícula n.º [MAT],
  classe [X] nível [Y], ocupante do cargo de [CARGO], lotado(a) na/no [ÓRGÃO],
  fica promovido(a)/progredido(a) para a classe [X2] nível [Y2] ...
- CIVIL: o cargo costuma permanecer o MESMO; a "mudança de cargo" é representada
  pela mudança de classe/nível/referência (ex: classe D -> E, nível 3 -> 4).
  Preencha classe_anterior/classe_nova e nivel_anterior/nivel_novo.
- MILITAR: há mudança real de posto/graduação (ex: "promovido ao posto de Coronel PM").
  Registre o posto anterior em classe_anterior e o novo em classe_nova.

REGRAS:
- Extraia apenas informações presentes no texto. NÃO invente dados. Deixe vazio o que não houver.
- Sempre preserve em trecho_original o trecho exato que justifica a extração.
- CPF (campo cpf_parcial) — extraia o CPF do servidor SEMPRE que houver, mesmo PARCIAL
  ou mascarado. Formatos aceitos, entre outros:
  "CPF: 123.456.789-00", "CPF nº 123.456.789-00", "CPF n.º 123.456.789-00",
  "inscrito no CPF sob o n.º 123.456.789-00", "portador(a) do CPF n.º 123.456.789-00",
  "portadora do CPF 123.456.789-00", e formas mascaradas como "***.456.789-**",
  "123.***.***-00" ou "12345678900". Retorne exatamente como aparece no texto
  (mantenha asteriscos/máscara). Se não houver nenhum indício de CPF, retorne "".
- MATRÍCULA (campo matricula) — extraia de "matrícula n.º ...".

CLASSIFICAÇÃO (campo categoria) — escolha uma:
"Promoção confirmada", "Progressão funcional", "Enquadramento", "Reenquadramento", "Mudança de classe", "Mudança de nível", "Mudança de referência", "Nomeação", "Aposentadoria", "Reserva remunerada", "Processo relacionado, precisa revisar", "Promoção publicada anteriormente, precisa localizar ato original", "Honraria, sem promoção funcional confirmada", "Falso positivo", "Informação insuficiente".

FILTRE FALSOS POSITIVOS que costumam ter muitos CPFs mas NÃO são promoções:
escala de plantão, escala de serviço, concessão de férias, diárias, ajuda de custo,
lista de aprovados/classificados em concurso sem nomeação. Classifique como "Falso positivo".

POTENCIAL FINANCEIRO (campo potencial_financeiro) — escolha uma:
- "Alto": promoção, progressão, enquadramento, mudança de posto/classe/nível/referência com possível impacto salarial.
- "Médio": processo relacionado a ato funcional, aposentadoria, reserva remunerada ou revisão funcional.
- "Baixo": nomeação ou movimentação sem sinal claro de aumento.
- "Ignorar": medalha, honraria, evento, contrato, orçamento, ICMS, licitação, escala/férias/diárias ou assunto sem servidor pessoa física.

MOTIVO (campo motivo_classificacao) — uma frase curta explicando a classificação.
CONFIANÇA (campo confianca_ia) — "alta", "media" ou "baixa".`;

function chunkText(text: string, maxChars: number): string[] {
  const lines = text.split("\n");
  const chunks: string[] = [];
  let cur = "";
  for (const line of lines) {
    if (cur.length + line.length + 1 > maxChars && cur) {
      chunks.push(cur);
      cur = "";
    }
    cur += line + "\n";
  }
  if (cur.trim()) chunks.push(cur);
  return chunks;
}

const str = (v: unknown) => (typeof v === "string" ? v.trim() : "");

// Fallback por regex: extrai o primeiro CPF presente no trecho, aceitando também
// CPFs parciais/mascarados (com asteriscos ou dígitos suprimidos). Preserva o
// formato original encontrado no texto.
function extractCpf(trecho: string): string {
  if (!trecho) return "";
  // 1) CPF ancorado por rótulo (CPF:, CPF nº, inscrito no CPF sob o n.º, portador do CPF...).
  const rotulado = trecho.match(
    /CPF\s*(?:sob\s+o\s+)?(?:n[.ºo°]*\s*)?[:\s]*([\d*]{2,3}[.\s]?[\d*]{3}[.\s]?[\d*]{3}[-\s]?[\d*]{2})/i,
  );
  if (rotulado) return rotulado[1].replace(/\s/g, "");
  // 2) CPF completo solto no texto (formatado).
  const solto = trecho.match(/\b(\d{3}\.\d{3}\.\d{3}-\d{2})\b/);
  if (solto) return solto[1];
  // 3) CPF mascarado solto (ex: ***.456.789-** ou 123.***.***-00).
  const mascarado = trecho.match(/\b([\d*]{3}\.[\d*]{3}\.[\d*]{3}-[\d*]{2})\b/);
  if (mascarado) return mascarado[1];
  // 4) 11 dígitos contínuos.
  const cont = trecho.match(/\b(\d{11})\b/);
  if (cont) return cont[1];
  return "";
}


// Extrai o objeto JSON da resposta da IA (texto), tolerando cercas markdown e
// texto extra ao redor. Valida com o schema e retorna { registros } ou null.
export function parseRegistros(
  text: string,
  schema: z.ZodType<{ registros: any[] }>,
): { registros: any[] } | null {
  if (!text) return null;
  let raw = text.trim();
  // Remove cercas de código ```json ... ```
  const fence = raw.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fence) raw = fence[1].trim();
  // Recorta do primeiro "{" até o último "}".
  const first = raw.indexOf("{");
  const last = raw.lastIndexOf("}");
  if (first === -1 || last === -1 || last <= first) return null;
  const candidate = raw.slice(first, last + 1);
  try {
    const obj = JSON.parse(candidate);
    const parsed = schema.safeParse(obj);
    if (parsed.success) return parsed.data;
    // Validação flexível: aceita registros parciais preenchendo o que faltar.
    if (obj && Array.isArray(obj.registros)) return { registros: obj.registros };
    return null;
  } catch {
    return null;
  }
}


// Analisa o texto extraído e retorna registros de movimentação funcional.
// Server-only (não requer usuário autenticado) — usado pelo scheduler/cron.
export async function analisarTextoServidor(input: {
  text: string;
  data_publicacao?: string;
  orgao?: string;
  secoes?: string[];
  maxChunks?: number;
}): Promise<RegistroExtraido[]> {
  const apiKey = process.env.LOVABLE_API_KEY;
  if (!apiKey) throw new Error("IA indisponível: LOVABLE_API_KEY ausente.");

  const { generateText } = await import("ai");
  const { createLovableAiGatewayProvider } = await import("@/lib/ai-gateway.server");
  const gateway = createLovableAiGatewayProvider(apiKey);
  const model = gateway("google/gemini-2.5-flash");

  const itemSchema = z.object({
    nome_servidor: z.string(),
    matricula: z.string(),
    cpf_parcial: z.string(),
    cargo: z.string(),
    orgao: z.string(),
    tipo_movimentacao: z.string(),
    data_ato: z.string(),
    pagina: z.string(),
    classe_anterior: z.string(),
    classe_nova: z.string(),
    nivel_anterior: z.string(),
    nivel_novo: z.string(),
    referencia_anterior: z.string(),
    referencia_nova: z.string(),
    numero_ato: z.string(),
    trecho_original: z.string(),
    confianca_ia: z.string(),
    categoria: z.string(),
    potencial_financeiro: z.string(),
    motivo_classificacao: z.string(),
  });
  const schema = z.object({ registros: z.array(itemSchema).max(300) });

  const secoes = (input.secoes ?? SECOES_RADAR_PADRAO).filter(Boolean);
  const secoesHint = secoes.length
    ? `\n\nPRIORIZE as seguintes seções (nesta ordem) e ignore orçamento, contratos, ICMS, licitações e particulares:\n${secoes
        .map((s, i) => `${i + 1}. ${s}`)
        .join("\n")}`
    : "";

  const chunks = chunkText(input.text, 24_000).slice(0, input.maxChunks ?? 40);
  const out: RegistroExtraido[] = [];

  for (const chunk of chunks) {
    try {
      const { text } = await generateText({
        model,
        system: SYSTEM_PROMPT,
        prompt: `Analise o texto abaixo extraído de um Diário Oficial e retorne os servidores com movimentação funcional.${secoesHint}\n\nResponda SOMENTE com JSON válido, sem markdown, no formato {"registros":[{...}]}. Se não houver nenhum servidor com movimentação, retorne {"registros":[]}.\n\nTexto:\n${chunk}`,
      });
      const output = parseRegistros(text, schema);
      for (const r of output?.registros ?? []) {
        const nome = str(r.nome_servidor);
        if (!nome) continue;
        out.push({
          nome_servidor: nome,
          matricula: str(r.matricula),
          cpf_parcial: str(r.cpf_parcial) || extractCpf(str(r.trecho_original)),
          cargo: str(r.cargo),
          orgao: str(r.orgao) || str(input.orgao),
          tipo_movimentacao: str(r.tipo_movimentacao) || "Possível promoção, precisa revisar",
          data_publicacao: str(input.data_publicacao),
          data_ato: str(r.data_ato),
          pagina: str(r.pagina),
          classe_anterior: str(r.classe_anterior),
          classe_nova: str(r.classe_nova),
          nivel_anterior: str(r.nivel_anterior),
          nivel_novo: str(r.nivel_novo),
          referencia_anterior: str(r.referencia_anterior),
          referencia_nova: str(r.referencia_nova),
          numero_ato: str(r.numero_ato),
          trecho_original: str(r.trecho_original),
          confianca_ia: str(r.confianca_ia) || "baixa",
          categoria: str(r.categoria) || "Possível promoção, precisa revisar",
          potencial_financeiro: str(r.potencial_financeiro) || "Médio",
          motivo_classificacao: str(r.motivo_classificacao),
        });
      }
    } catch (e: any) {
      const msg = String(e?.message ?? e);
      if (/429/.test(msg)) throw new Error("Limite de uso da IA atingido. Tente novamente em instantes.");
      if (/402/.test(msg)) throw new Error("Créditos de IA esgotados. Adicione créditos para continuar.");
      console.error("[analisarTextoServidor] chunk falhou:", msg);
    }
  }

  return out;
}
