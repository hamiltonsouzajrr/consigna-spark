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

// Extrai o texto de um PDF. Retorna requerOcr=true quando o PDF tem pouco/nenhum
// texto extraível (provavelmente escaneado -> precisa de OCR no navegador).
export async function extrairTextoPdf(buffer: Uint8Array): Promise<ExtracaoTexto> {
  const { getDocumentProxy, extractText } = await import("unpdf");
  const pdf = await getDocumentProxy(buffer);
  const { totalPages, text } = await extractText(pdf, { mergePages: true });
  const texto = (Array.isArray(text) ? text.join("\n") : text) ?? "";
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

REGRAS:
- Extraia apenas informações presentes no texto. NÃO invente dados. Deixe vazio o que não houver.
- Sempre preserve em trecho_original o trecho exato que justifica a extração.

CLASSIFICAÇÃO (campo categoria) — escolha uma:
"Promoção confirmada", "Progressão funcional", "Enquadramento", "Reenquadramento", "Mudança de classe", "Mudança de nível", "Mudança de referência", "Nomeação", "Aposentadoria", "Reserva remunerada", "Processo relacionado, precisa revisar", "Promoção publicada anteriormente, precisa localizar ato original", "Honraria, sem promoção funcional confirmada", "Falso positivo", "Informação insuficiente".

POTENCIAL FINANCEIRO (campo potencial_financeiro) — escolha uma:
- "Alto": promoção, progressão, enquadramento, mudança de posto/classe/nível/referência com possível impacto salarial.
- "Médio": processo relacionado a ato funcional, aposentadoria, reserva remunerada ou revisão funcional.
- "Baixo": nomeação ou movimentação sem sinal claro de aumento.
- "Ignorar": medalha, honraria, evento, contrato, orçamento, ICMS, licitação ou assunto sem servidor pessoa física.

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

  const { generateText, Output } = await import("ai");
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
      const { output } = await generateText({
        model,
        output: Output.object({ schema }),
        system: SYSTEM_PROMPT,
        prompt: `Analise o texto abaixo extraído de um Diário Oficial e retorne os servidores com movimentação funcional.${secoesHint}\n\nTexto:\n${chunk}`,
      });
      for (const r of output?.registros ?? []) {
        const nome = str(r.nome_servidor);
        if (!nome) continue;
        out.push({
          nome_servidor: nome,
          matricula: str(r.matricula),
          cpf_parcial: str(r.cpf_parcial),
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
