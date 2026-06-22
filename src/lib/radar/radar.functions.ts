// Server functions for "Radar Diário Oficial":
// - analisarDiarioAI: AI reads Diário Oficial text and extracts promotions/movements.
// - criarArquivo / salvarRegistros: persist an imported file and its extracted records.
// - getArquivos / getRegistros / getDashboard: read views.
// - atualizarRegistro: review actions (approve/ignore/edit/mark duplicate).
// - getArquivoUrl: signed URL to open the original file.
// - deletarArquivo / reprocessarArquivo: admin operations.

import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

async function assertAdmin(supabase: any, userId: string) {
  const { data, error } = await supabase.rpc("has_role", { _user_id: userId, _role: "admin" });
  if (error) throw new Error(error.message);
  if (!data) throw new Error("Acesso restrito a administradores.");
}

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type RegistroAI = {
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

// Seções do Diário Oficial priorizadas para busca de movimentações funcionais.
export const SECOES_RADAR = [
  "Eventos Funcionais",
  "Atos e despachos do Governador",
  "Gabinete Civil",
  "SEPLAG",
  "Polícia Militar",
  "Corpo de Bombeiros",
  "Polícia Civil",
  "Secretaria de Educação",
  "Secretaria de Saúde",
] as const;

export type DoArquivo = {
  id: string;
  nome_arquivo: string;
  tipo_arquivo: string;
  data_upload: string;
  data_publicacao: string | null;
  numero_edicao: string | null;
  orgao_detectado: string | null;
  caminho_arquivo: string | null;
  status_processamento: string;
  total_registros_extraidos: number;
  total_aprovados: number;
  total_erros: number;
  uploaded_by: string | null;
};

export type DoRegistro = {
  id: string;
  arquivo_id: string;
  nome_servidor: string;
  matricula: string | null;
  cpf_parcial: string | null;
  cargo: string | null;
  orgao: string | null;
  tipo_movimentacao: string | null;
  data_publicacao: string | null;
  data_ato: string | null;
  pagina: string | null;
  classe_anterior: string | null;
  classe_nova: string | null;
  nivel_anterior: string | null;
  nivel_novo: string | null;
  referencia_anterior: string | null;
  referencia_nova: string | null;
  numero_ato: string | null;
  trecho_original: string | null;
  confianca_ia: string | null;
  categoria: string | null;
  potencial_financeiro: string | null;
  motivo_classificacao: string | null;
  status_revisao: string;
  status_abordagem: string;
  contatado_em: string | null;
  contatado_por: string | null;
  consultora_responsavel: string | null;
  duplicado_possivel: boolean;
  created_at: string;
};

// ---------------------------------------------------------------------------
// AI extraction
// ---------------------------------------------------------------------------

const SYSTEM_PROMPT = `Você é um analista especializado em Diários Oficiais brasileiros. Seu objetivo é separar SERVIDORES PÚBLICOS (pessoas físicas) com MOVIMENTAÇÃO FUNCIONAL REAL de meras citações de nomes. A meta final é encontrar pessoas com possível melhora salarial.

PRIORIZE trechos que indiquem alteração funcional real, como:
- promoção na carreira, promovido(a) ao posto/cargo
- promoção por merecimento, promoção por antiguidade
- progressão funcional, concessão/deferimento de progressão
- enquadramento, reenquadramento, reposicionamento
- mudança de classe, nível, referência ou padrão; elevação de padrão
- nomeação para cargo SUPERIOR ao anterior
- aposentadoria com promoção
- publicação do ato de promoção

CHECAGEM DE FALSO POSITIVO — antes de classificar como promoção confirmada, pergunte internamente:
1. O texto fala de uma pessoa física (servidor)?
2. O texto indica alteração real de cargo, posto, classe, nível, padrão ou referência?
3. Existe sinal de impacto funcional ou remuneratório?
4. O trecho NÃO é sobre medalha, honraria, evento, festival, contrato, orçamento, ICMS ou licitação?
Se a resposta da pergunta 2 for "não", NÃO classifique como promoção confirmada.

NÃO considere como promoção de servidor (e use categoria/potencial corretos) quando o texto tratar de:
- promoção de eventos, promoção cultural, apoio a festivais
- medalhas, honrarias, comendas, homenagens, outorga de medalha
- licitações, contratos, índices municipais, ICMS, orçamento, crédito suplementar
- publicações de empresas ou particulares
- exonerações, demissões, licenças, férias, falecimentos, pessoas jurídicas
Exemplo de falso positivo a IGNORAR: "PROMOÇÃO E APOIO AOS FESTIVAIS CULTURAIS".
Exemplo a classificar como HONRARIA (não promoção): "Fica outorgada ao 2º Sargento BM a Medalha do Mérito".

REGRAS:
- Extraia apenas informações presentes no texto. NÃO invente dados. Deixe vazio o que não houver.
- Sempre preserve em trecho_original o trecho exato que justifica a extração.
- CPF (campo cpf_parcial) — extraia o número de CPF do servidor se presente no texto. Formatos aceitos: "CPF: 123.456.789-00", "CPF nº 123.456.789-00", "portador(a) do CPF 123.456.789-00". Retorne apenas os dígitos e pontuação (ex: "082.478.484-73"). Se não houver CPF no texto, retorne "".

CLASSIFICAÇÃO (campo categoria) — escolha uma:
"Promoção confirmada", "Progressão funcional", "Enquadramento", "Mudança de cargo", "Nomeação", "Possível promoção, precisa revisar", "Processo relacionado, precisa revisar", "Promoção publicada anteriormente, precisa localizar ato original", "Honraria, sem promoção funcional confirmada", "Informação insuficiente".
- Quando citar apenas nome/processo/despacho sem confirmar a promoção: "Processo relacionado, precisa revisar".
- Quando disser "considerando a publicação do ato de promoção": "Promoção publicada anteriormente, precisa localizar ato original".
- Quando for medalha/honraria: "Honraria, sem promoção funcional confirmada".

POTENCIAL FINANCEIRO (campo potencial_financeiro) — escolha uma:
- "Alto": promoção funcional confirmada, mudança de posto/classe, progressão ou aumento remuneratório claro.
- "Médio": despacho ou processo relacionado a promoção, aposentadoria, revisão funcional ou alteração de carreira.
- "Baixo": nomeação, medalha, honraria, publicação sem impacto salarial claro.
- "Ignorar": contratos, empresas, municípios, orçamento, ICMS, festivais, licitações e assuntos sem servidor pessoa física.

MOTIVO (campo motivo_classificacao) — uma frase curta explicando por que classificou assim. Ex.: "Texto informa publicação de ato de promoção"; "Texto trata apenas de medalha/honraria"; "Texto cita promoção cultural, não servidor"; "Texto cita processo administrativo, mas não confirma alteração funcional".

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

function str(v: unknown): string {
  return typeof v === "string" ? v.trim() : "";
}

function extractCpf(trecho: string): string {
  const m = trecho.match(/CPF\s*(?:n[oº°]?\s*\.?\s*|:\s*)?(\d{3}\.?\d{3}\.?\d{3}-?\d{2})/i);
  return m ? m[1] : "";
}

export const analisarDiarioAI = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) =>
    z
      .object({
        text: z.string().min(1).max(2_000_000),
        data_publicacao: z.string().optional(),
        orgao: z.string().optional(),
        secoes: z.array(z.string().max(120)).max(30).optional(),
      })
      .parse(data),
  )
  .handler(async ({ data }): Promise<{ registros: RegistroAI[] }> => {
    const apiKey = process.env.LOVABLE_API_KEY;
    if (!apiKey) throw new Error("IA indisponível: LOVABLE_API_KEY ausente.");

    const { generateText } = await import("ai");
    const { createLovableAiGatewayProvider } = await import("@/lib/ai-gateway.server");
    const { parseRegistros } = await import("./diario-extraction.server");
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

    const secoes = (data.secoes ?? []).filter(Boolean);
    const secoesHint = secoes.length
      ? `\n\nPRIORIZE as seguintes seções do Diário Oficial (nesta ordem) e ignore conteúdo de orçamento, contratos, ICMS, licitações e particulares:\n${secoes.map((s, i) => `${i + 1}. ${s}`).join("\n")}`
      : "";

    const chunks = chunkText(data.text, 24_000).slice(0, 25);
    const out: RegistroAI[] = [];

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
          const trecho = str(r.trecho_original);
          out.push({
            nome_servidor: nome,
            matricula: str(r.matricula),
            cpf_parcial: str(r.cpf_parcial) || extractCpf(trecho),
            cargo: str(r.cargo),
            orgao: str(r.orgao) || str(data.orgao),
            tipo_movimentacao: str(r.tipo_movimentacao) || "Possível promoção, precisa revisar",
            data_publicacao: str(data.data_publicacao),
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
        console.error("[analisarDiarioAI] chunk falhou:", msg);
      }
    }

    return { registros: out };
  });

// ---------------------------------------------------------------------------
// Persistence
// ---------------------------------------------------------------------------

function toDateOrNull(v: string | undefined | null): string | null {
  const s = (v ?? "").trim();
  return /^\d{4}-\d{2}-\d{2}$/.test(s) ? s : null;
}

export const criarArquivo = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) =>
    z
      .object({
        nome_arquivo: z.string().trim().min(1).max(300),
        tipo_arquivo: z.string().trim().min(1).max(20),
        data_publicacao: z.string().optional(),
        numero_edicao: z.string().trim().max(100).optional(),
        orgao_detectado: z.string().trim().max(300).optional(),
        caminho_arquivo: z.string().trim().max(500).optional(),
        texto_extraido: z.string().max(2_000_000).optional(),
      })
      .parse(data),
  )
  .handler(async ({ context, data }): Promise<{ id: string }> => {
    const { supabase, userId } = context;
    const { data: row, error } = await supabase
      .from("do_arquivos")
      .insert({
        nome_arquivo: data.nome_arquivo,
        tipo_arquivo: data.tipo_arquivo,
        data_publicacao: toDateOrNull(data.data_publicacao),
        numero_edicao: data.numero_edicao || null,
        orgao_detectado: data.orgao_detectado || null,
        caminho_arquivo: data.caminho_arquivo || null,
        texto_extraido: data.texto_extraido || null,
        status_processamento: "processando",
        uploaded_by: userId,
      })
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    return { id: row.id as string };
  });

const registroEntry = z.object({
  nome_servidor: z.string().trim().min(1).max(300),
  matricula: z.string().trim().max(60).optional().default(""),
  cpf_parcial: z.string().trim().max(40).optional().default(""),
  cargo: z.string().trim().max(300).optional().default(""),
  orgao: z.string().trim().max(300).optional().default(""),
  tipo_movimentacao: z.string().trim().max(120).optional().default(""),
  data_publicacao: z.string().trim().max(20).optional().default(""),
  data_ato: z.string().trim().max(20).optional().default(""),
  pagina: z.string().trim().max(40).optional().default(""),
  classe_anterior: z.string().trim().max(60).optional().default(""),
  classe_nova: z.string().trim().max(60).optional().default(""),
  nivel_anterior: z.string().trim().max(60).optional().default(""),
  nivel_novo: z.string().trim().max(60).optional().default(""),
  referencia_anterior: z.string().trim().max(60).optional().default(""),
  referencia_nova: z.string().trim().max(60).optional().default(""),
  numero_ato: z.string().trim().max(120).optional().default(""),
  trecho_original: z.string().trim().max(4000).optional().default(""),
  confianca_ia: z.string().trim().max(20).optional().default(""),
  categoria: z.string().trim().max(120).optional().default(""),
  potencial_financeiro: z.string().trim().max(40).optional().default(""),
  motivo_classificacao: z.string().trim().max(400).optional().default(""),
});

export const salvarRegistros = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) =>
    z
      .object({
        arquivo_id: z.string().uuid(),
        registros: z.array(registroEntry).min(1).max(5000),
      })
      .parse(data),
  )
  .handler(async ({ context, data }): Promise<{ inserted: number; duplicados: number }> => {
    const { supabase } = context;

    // Existing records to detect possible duplicates (name + matricula + orgao + data + tipo).
    const { data: existing } = await supabase
      .from("do_registros")
      .select("nome_servidor,matricula,orgao,data_publicacao,tipo_movimentacao")
      .limit(20000);
    const keyOf = (r: any) =>
      [r.nome_servidor, r.matricula, r.orgao, r.data_publicacao, r.tipo_movimentacao]
        .map((x) => String(x ?? "").trim().toLowerCase())
        .join("|");
    const existingKeys = new Set((existing ?? []).map(keyOf));

    let duplicados = 0;
    const seen = new Set<string>();
    const rows = data.registros.map((r) => {
      const norm = {
        nome_servidor: r.nome_servidor,
        matricula: r.matricula || null,
        orgao: r.orgao || null,
        data_publicacao: toDateOrNull(r.data_publicacao),
        tipo_movimentacao: r.tipo_movimentacao || null,
      };
      const key = keyOf(norm);
      const dup = existingKeys.has(key) || seen.has(key);
      if (dup) duplicados += 1;
      seen.add(key);
      return {
        arquivo_id: data.arquivo_id,
        nome_servidor: r.nome_servidor,
        matricula: r.matricula || null,
        cpf_parcial: r.cpf_parcial || null,
        cargo: r.cargo || null,
        orgao: r.orgao || null,
        tipo_movimentacao: r.tipo_movimentacao || null,
        data_publicacao: toDateOrNull(r.data_publicacao),
        data_ato: toDateOrNull(r.data_ato),
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

    const { error } = await supabase.from("do_registros").insert(rows as any);
    if (error) throw new Error(error.message);

    await supabase
      .from("do_arquivos")
      .update({
        status_processamento: "concluido",
        total_registros_extraidos: rows.length,
      })
      .eq("id", data.arquivo_id);

    // A distribuição automática (rodízio) acontece no banco via trigger
    // BEFORE INSERT (atribuir_consultora_automatico) a cada registro inserido.

    return { inserted: rows.length, duplicados };
  });

// ---------------------------------------------------------------------------
// Reads
// ---------------------------------------------------------------------------

export const getArquivos = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<DoArquivo[]> => {
    const { data, error } = await context.supabase
      .from("do_arquivos")
      .select(
        "id,nome_arquivo,tipo_arquivo,data_upload,data_publicacao,numero_edicao,orgao_detectado,caminho_arquivo,status_processamento,total_registros_extraidos,total_aprovados,total_erros,uploaded_by",
      )
      .order("data_upload", { ascending: false })
      .limit(2000);
    if (error) throw new Error(error.message);
    return (data ?? []) as DoArquivo[];
  });

export const getRegistros = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<DoRegistro[]> => {
    const { data, error } = await context.supabase
      .from("do_registros")
      .select("*")
      .order("data_publicacao", { ascending: false, nullsFirst: false })
      .order("created_at", { ascending: false })
      .limit(10000);
    if (error) throw new Error(error.message);
    return (data ?? []) as DoRegistro[];
  });

// Leads do Radar atribuídos a uma consultora específica (a consultora logada).
// Usado na tela /prospeccao/promovidos para que cada consultora veja apenas os
// seus próprios leads distribuídos automaticamente pelo rodízio.
export const getMeusLeadsRadar = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => z.object({ consultora: z.string().trim().min(1).max(120) }).parse(data))
  .handler(async ({ context, data }): Promise<DoRegistro[]> => {
    const { data: rows, error } = await context.supabase
      .from("do_registros")
      .select("*")
      .eq("consultora_responsavel", data.consultora)
      .order("data_publicacao", { ascending: false, nullsFirst: false })
      .order("created_at", { ascending: false })
      .limit(5000);
    if (error) throw new Error(error.message);
    return (rows ?? []) as DoRegistro[];
  });

export const atualizarRegistro = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) =>
    z
      .object({
        id: z.string().uuid(),
        patch: z
          .object({
            status_revisao: z.string().trim().max(40).optional(),
            duplicado_possivel: z.boolean().optional(),
            nome_servidor: z.string().trim().min(1).max(300).optional(),
            matricula: z.string().trim().max(60).optional(),
            cargo: z.string().trim().max(300).optional(),
            orgao: z.string().trim().max(300).optional(),
            tipo_movimentacao: z.string().trim().max(120).optional(),
            categoria: z.string().trim().max(120).optional(),
            potencial_financeiro: z.string().trim().max(40).optional(),
            motivo_classificacao: z.string().trim().max(400).optional(),
            pagina: z.string().trim().max(40).optional(),
          })
          .refine((p) => Object.keys(p).length > 0, "Nada para atualizar"),
      })
      .parse(data),
  )
  .handler(async ({ context, data }): Promise<{ ok: true }> => {
    const { error } = await context.supabase
      .from("do_registros")
      .update(data.patch as any)
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// Marca a situação comercial de abordagem de um registro (servidor promovido).
export const marcarAbordagem = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) =>
    z
      .object({
        id: z.string().uuid(),
        status: z.enum(["novo", "contatado", "proposta_enviada", "convertido", "sem_interesse"]),
      })
      .parse(data),
  )
  .handler(async ({ context, data }): Promise<{ ok: true; contatado_em: string | null }> => {
    const { supabase, userId } = context;
    const patch: Record<string, unknown> = { status_abordagem: data.status };
    let contatadoEm: string | null = null;
    if (data.status === "contatado") {
      contatadoEm = new Date().toISOString();
      patch.contatado_em = contatadoEm;
      patch.contatado_por = userId;
    }
    const { error } = await supabase.from("do_registros").update(patch as any).eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true, contatado_em: contatadoEm };
  });

// ---------------------------------------------------------------------------
// Distribuição AUTOMÁTICA de leads por consultora (round-robin, sem duplicação)
// ---------------------------------------------------------------------------

const POTENCIAL_RANK: Record<string, number> = { Alto: 0, Médio: 1 };

export type Consultora = { id: string; nome: string; ativo: boolean; total_leads_atribuidos: number };

// Redistribui os leads PENDENTES (status novo + potencial alto/médio + sem
// consultora) entre as consultoras ATIVAS, em rodízio (least-loaded), usando o
// contador total_leads_atribuidos como base — espelhando a lógica do trigger.
async function distribuirRoundRobin(supabase: any): Promise<{ atribuidos: number; consultoras: number }> {
  const { data: consultoras, error: cErr } = await supabase
    .from("radar_consultoras")
    .select("id,nome,total_leads_atribuidos")
    .eq("ativo", true);
  if (cErr) throw new Error(cErr.message);

  const ativas = (consultoras ?? [])
    .map((c: any) => ({ id: String(c.id), nome: String(c.nome ?? "").trim(), total: Number(c.total_leads_atribuidos ?? 0) }))
    .filter((c: any) => c.nome);
  if (!ativas.length) return { atribuidos: 0, consultoras: 0 };

  // Leads elegíveis pendentes de distribuição.
  const { data: rows, error } = await supabase
    .from("do_registros")
    .select("id,potencial_financeiro,data_publicacao")
    .eq("status_abordagem", "novo")
    .in("potencial_financeiro", ["Alto", "Médio"])
    .is("consultora_responsavel", null)
    .limit(5000);
  if (error) throw new Error(error.message);

  const sorted = [...(rows ?? [])].sort((a: any, b: any) => {
    const ra = POTENCIAL_RANK[String(a.potencial_financeiro)] ?? 9;
    const rb = POTENCIAL_RANK[String(b.potencial_financeiro)] ?? 9;
    if (ra !== rb) return ra - rb;
    return String(b.data_publicacao ?? "").localeCompare(String(a.data_publicacao ?? ""));
  });
  if (!sorted.length) return { atribuidos: 0, consultoras: ativas.length };

  // Atribui cada lead à consultora ativa com menor total acumulado.
  const buckets = new Map<string, string[]>(); // id -> registro ids
  for (const c of ativas) buckets.set(c.id, []);
  for (const r of sorted) {
    let alvo = ativas[0];
    for (const c of ativas) if (c.total < alvo.total) alvo = c;
    buckets.get(alvo.id)!.push((r as any).id as string);
    alvo.total += 1;
  }

  let atribuidos = 0;
  for (const c of ativas) {
    const ids = buckets.get(c.id)!;
    if (!ids.length) continue;
    const { error: upErr } = await supabase
      .from("do_registros")
      .update({ consultora_responsavel: c.nome } as any)
      .in("id", ids);
    if (upErr) throw new Error(upErr.message);
    const { error: cntErr } = await supabase
      .from("radar_consultoras")
      .update({ total_leads_atribuidos: c.total } as any)
      .eq("id", c.id);
    if (cntErr) throw new Error(cntErr.message);
    atribuidos += ids.length;
  }

  return { atribuidos, consultoras: ativas.length };
}

// Redistribuição manual sob demanda dos leads pendentes (botão "Redistribuir
// pendentes"). A distribuição normal acontece automaticamente via trigger no
// banco a cada novo registro inserido.
export const distribuirLeadsAutomatico = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<{ atribuidos: number; consultoras: number }> => {
    return distribuirRoundRobin(context.supabase);
  });

// ---- Cadastro de consultoras ----

export const getConsultoras = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<Consultora[]> => {
    const { data, error } = await context.supabase
      .from("radar_consultoras")
      .select("id,nome,ativo,total_leads_atribuidos")
      .order("nome", { ascending: true });
    if (error) throw new Error(error.message);
    return (data ?? []) as Consultora[];
  });

export const adicionarConsultora = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => z.object({ nome: z.string().trim().min(1).max(120) }).parse(data))
  .handler(async ({ context, data }): Promise<{ ok: true }> => {
    const { error } = await context.supabase
      .from("radar_consultoras")
      .insert({ nome: data.nome } as any);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const toggleConsultora = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => z.object({ id: z.string().uuid(), ativo: z.boolean() }).parse(data))
  .handler(async ({ context, data }): Promise<{ ok: true }> => {
    const { error } = await context.supabase
      .from("radar_consultoras")
      .update({ ativo: data.ativo } as any)
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const removerConsultora = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => z.object({ id: z.string().uuid() }).parse(data))
  .handler(async ({ context, data }): Promise<{ ok: true }> => {
    const { error } = await context.supabase
      .from("radar_consultoras")
      .delete()
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// Resumo de quantos leads cada consultora possui atribuídos.
export type DistribuicaoConsultora = { consultora: string; total: number };

export const getDistribuicaoConsultoras = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<DistribuicaoConsultora[]> => {
    const { data, error } = await context.supabase
      .from("do_registros")
      .select("consultora_responsavel")
      .not("consultora_responsavel", "is", null)
      .limit(20000);
    if (error) throw new Error(error.message);
    const m = new Map<string, number>();
    for (const row of data ?? []) {
      const c = String((row as any).consultora_responsavel ?? "").trim();
      if (!c) continue;
      m.set(c, (m.get(c) ?? 0) + 1);
    }
    return Array.from(m.entries())
      .map(([consultora, total]) => ({ consultora, total }))
      .sort((a, b) => b.total - a.total);
  });



// Cobertura mensal de 2026: quantas edições existem e quantas foram processadas.
export type CoberturaMes = { mes: number; total: number; processadas: number };

export const getCobertura2026 = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<CoberturaMes[]> => {
    const { data, error } = await context.supabase
      .from("do_arquivos")
      .select("data_publicacao,status_processamento")
      .gte("data_publicacao", "2026-01-01")
      .lte("data_publicacao", "2026-12-31")
      .limit(20000);
    if (error) throw new Error(error.message);
    const meses: CoberturaMes[] = Array.from({ length: 6 }, (_, i) => ({
      mes: i + 1,
      total: 0,
      processadas: 0,
    }));
    for (const row of data ?? []) {
      const dp = String((row as any).data_publicacao ?? "");
      const m = Number(dp.slice(5, 7));
      if (m >= 1 && m <= 6) {
        const item = meses[m - 1];
        item.total += 1;
        const st = String((row as any).status_processamento ?? "").toLowerCase();
        if (["processed", "concluido", "concluído"].includes(st)) item.processadas += 1;
      }
    }
    return meses;
  });

export const getArquivoUrl = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => z.object({ caminho: z.string().min(1) }).parse(data))
  .handler(async ({ context, data }): Promise<{ url: string }> => {
    const { data: signed, error } = await context.supabase.storage
      .from("diario-oficial")
      .createSignedUrl(data.caminho, 300);
    if (error) throw new Error(error.message);
    return { url: signed.signedUrl };
  });

export const deletarArquivo = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => z.object({ id: z.string().uuid() }).parse(data))
  .handler(async ({ context, data }): Promise<{ ok: true }> => {
    const { supabase, userId } = context;
    await assertAdmin(supabase, userId);
    const { data: arq } = await supabase
      .from("do_arquivos")
      .select("caminho_arquivo")
      .eq("id", data.id)
      .single();
    if (arq?.caminho_arquivo) {
      await supabase.storage.from("diario-oficial").remove([arq.caminho_arquivo]);
    }
    const { error } = await supabase.from("do_arquivos").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// Re-run AI over the saved text of a file and return fresh records (client re-saves).
export const reprocessarArquivo = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => z.object({ id: z.string().uuid() }).parse(data))
  .handler(async ({ context, data }): Promise<{ texto: string; data_publicacao: string; orgao: string }> => {
    const { data: arq, error } = await context.supabase
      .from("do_arquivos")
      .select("texto_extraido,data_publicacao,orgao_detectado")
      .eq("id", data.id)
      .single();
    if (error) throw new Error(error.message);
    if (!arq?.texto_extraido) throw new Error("Arquivo não possui texto salvo para reprocessar.");
    return {
      texto: arq.texto_extraido as string,
      data_publicacao: (arq.data_publicacao as string) ?? "",
      orgao: (arq.orgao_detectado as string) ?? "",
    };
  });

export type DashboardData = {
  totalArquivos: number;
  totalPessoas: number;
  promocoesConfirmadas: number;
  progressoes: number;
  pendentes: number;
  pipeline: { oportunidadesNovas: number; emContato: number; convertidos: number; semInteresse: number };
  porTipo: { tipo: string; total: number }[];
  porData: { data: string; total: number }[];
  topOrgaos: { orgao: string; total: number }[];
};

export const getDashboard = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<DashboardData> => {
    const { supabase } = context;
    const [{ count: totalArquivos }, { data: regs }] = await Promise.all([
      supabase.from("do_arquivos").select("id", { count: "exact", head: true }),
      supabase
        .from("do_registros")
        .select("categoria,tipo_movimentacao,data_publicacao,orgao,status_revisao,status_abordagem,potencial_financeiro")
        .limit(20000),
    ]);

    const rows = regs ?? [];
    const norm = (s: any) => String(s ?? "").trim();
    const promocoesConfirmadas = rows.filter((r) => norm(r.categoria) === "Promoção confirmada").length;
    const progressoes = rows.filter((r) => norm(r.categoria) === "Progressão funcional").length;
    const pendentes = rows.filter((r) => ["Novo", "Revisado"].includes(norm(r.status_revisao))).length;

    const ab = (r: any) => norm((r as any).status_abordagem) || "novo";
    const pipeline = {
      oportunidadesNovas: rows.filter((r) => ab(r) === "novo" && norm((r as any).potencial_financeiro) === "Alto").length,
      emContato: rows.filter((r) => ["contatado", "proposta_enviada"].includes(ab(r))).length,
      convertidos: rows.filter((r) => ab(r) === "convertido").length,
      semInteresse: rows.filter((r) => ab(r) === "sem_interesse").length,
    };

    const tally = (arr: any[], key: (r: any) => string) => {
      const m = new Map<string, number>();
      for (const r of arr) {
        const k = key(r);
        if (!k) continue;
        m.set(k, (m.get(k) ?? 0) + 1);
      }
      return Array.from(m.entries()).map(([k, total]) => ({ k, total }));
    };

    const porTipo = tally(rows, (r) => norm(r.categoria) || norm(r.tipo_movimentacao))
      .map((x) => ({ tipo: x.k, total: x.total }))
      .sort((a, b) => b.total - a.total);
    const porData = tally(rows, (r) => norm(r.data_publicacao))
      .map((x) => ({ data: x.k, total: x.total }))
      .sort((a, b) => a.data.localeCompare(b.data));
    const topOrgaos = tally(rows, (r) => norm(r.orgao))
      .map((x) => ({ orgao: x.k, total: x.total }))
      .sort((a, b) => b.total - a.total)
      .slice(0, 8);

    return {
      totalArquivos: totalArquivos ?? 0,
      totalPessoas: rows.length,
      promocoesConfirmadas,
      progressoes,
      pendentes,
      pipeline,
      porTipo,
      porData,
      topOrgaos,
    };
  });
