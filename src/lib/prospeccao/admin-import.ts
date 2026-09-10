import { normalizeWhatsappNumber } from "@/lib/prospeccao/constants";
import { isValidCpf, normalizeCpf } from "@/lib/cpf";

export type ParsedLead = {
  nome: string;
  telefone?: string;
  telefones?: string[];
  cpf?: string;
  cidade?: string;
  origem?: string;
  orcamento?: number;
  urgencia?: "alta" | "media" | "baixa";
  idade?: number;
  sexo?: string;
  raw_data?: Record<string, unknown>;
};

export type RejectedRow = { line: number; nome: string; telefone: string; reason: string };

export type ImportMeta = {
  total: number;
  comWhats: number;
  invalidos: number;
  semTelefone: number;
  duplicados: number;
  phoneCol: string | null;
  cpfInvalidos: number;
  comCidade: number;
  comIdade: number;
  comMargem: number;
};

export const PHONE_ALIASES = ["telefone", "celular", "whatsapp", "cel1", "cel2", "cel", "fone", "contato", "numero", "número"];

const CITY_ALIASES = ["cidade", "municipio", "município", "localidade", "city"];
const AGE_ALIASES = ["idade", "anos"];
const BIRTH_ALIASES = ["nascimento", "data_nascimento", "data de nascimento", "dt_nascimento", "dtnascimento"];
const SEX_ALIASES = ["sexo", "genero", "gênero"];
// Só colunas que realmente falam de margem. Renda/salário NÃO é margem.
const MARGIN_ALIASES = ["margem", "margem_disponivel", "margem disponível", "margem disponivel", "orcamento", "orçamento"];
const INCOME_ALIASES = ["renda", "salario", "salário", "remuneracao", "remuneração", "vencimento", "bruto"];

/** Auto-detect the column that holds a phone/WhatsApp number from the spreadsheet headers. */
export function detectPhoneColumn(headers: string[]): string | null {
  const lower = headers.map((h) => ({ raw: h, low: h.toLowerCase().trim() }));
  for (const a of PHONE_ALIASES) {
    const hit = lower.find((h) => h.low === a);
    if (hit) return hit.raw;
  }
  const fuzzy = lower.find((h) => h.low.includes("cel") || h.low.includes("tel") || h.low.includes("whats") || h.low.includes("fone"));
  return fuzzy?.raw ?? null;
}

/**
 * Parse a money-ish cell the way a Brazilian spreadsheet writes it, without
 * inflating the value. "1.234,56" -> 1234.56, "122.40" -> 122.4, "1.234" -> 1234.
 * Ranges such as "1.000 a 2.000" or "1000-2000" return the midpoint.
 */
export function parseNumeroBr(input: unknown): number | undefined {
  if (typeof input === "number") return Number.isFinite(input) ? input : undefined;
  const text = String(input ?? "").trim();
  if (!text) return undefined;

  // Range: two numbers separated by "a", "-", "até" or "/".
  const rangeMatch = text.match(/^([\d.,]+)\s*(?:a|até|ate|-|—|\/)\s*([\d.,]+)$/i);
  if (rangeMatch) {
    const lo = parseUmNumero(rangeMatch[1]);
    const hi = parseUmNumero(rangeMatch[2]);
    if (lo != null && hi != null) return Math.round(((lo + hi) / 2) * 100) / 100;
    return lo ?? hi ?? undefined;
  }
  return parseUmNumero(text);
}

function parseUmNumero(raw: string): number | undefined {
  let s = raw.replace(/[^\d.,-]/g, "").trim();
  if (!s) return undefined;
  const neg = s.startsWith("-");
  s = s.replace(/-/g, "");
  const lastComma = s.lastIndexOf(",");
  const lastDot = s.lastIndexOf(".");
  let decimalSep = "";
  if (lastComma >= 0 && lastDot >= 0) {
    decimalSep = lastComma > lastDot ? "," : ".";
  } else if (lastComma >= 0) {
    decimalSep = /,\d{1,2}$/.test(s) ? "," : "";
  } else if (lastDot >= 0) {
    // A single dot followed by 1-2 digits is a decimal point; ".000" is a thousands separator.
    decimalSep = s.split(".").length === 2 && /\.\d{1,2}$/.test(s) ? "." : "";
  }
  let normalized: string;
  if (decimalSep) {
    const idx = decimalSep === "," ? lastComma : lastDot;
    normalized = s.slice(0, idx).replace(/[.,]/g, "") + "." + s.slice(idx + 1).replace(/[.,]/g, "");
  } else {
    normalized = s.replace(/[.,]/g, "");
  }
  const n = Number(normalized);
  if (!Number.isFinite(n)) return undefined;
  return neg ? -n : n;
}

/** CPF as written by a spreadsheet that dropped leading zeros. */
export function normalizeCpfPlanilha(raw: string): { cpf?: string; invalido: boolean } {
  const digits = normalizeCpf(raw);
  if (!digits) return { invalido: false };
  const padded = digits.length < 11 ? digits.padStart(11, "0") : digits;
  if (padded.length === 11 && isValidCpf(padded)) return { cpf: padded, invalido: false };
  return { invalido: true };
}

/** "MARIA DA SILVA 10193" -> { nome: "MARIA DA SILVA", matricula: "10193" } */
export function limparNome(raw: string): { nome: string; matricula?: string } {
  const t = raw.trim().replace(/\s+/g, " ");
  const m = t.match(/^(.*[A-Za-zÀ-ÿ])\s+(\d{3,})$/);
  if (m) return { nome: m[1].trim(), matricula: m[2] };
  return { nome: t };
}

function idadeDeNascimento(raw: string): number | undefined {
  const t = raw.trim();
  if (!t) return undefined;
  const br = t.match(/^(\d{1,2})[/.-](\d{1,2})[/.-](\d{4})$/);
  const iso = t.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
  let d: Date | undefined;
  if (br) d = new Date(Number(br[3]), Number(br[2]) - 1, Number(br[1]));
  else if (iso) d = new Date(Number(iso[1]), Number(iso[2]) - 1, Number(iso[3]));
  if (!d || Number.isNaN(d.getTime())) return undefined;
  const now = new Date();
  let age = now.getFullYear() - d.getFullYear();
  const before = now.getMonth() < d.getMonth() || (now.getMonth() === d.getMonth() && now.getDate() < d.getDate());
  if (before) age--;
  return age >= 16 && age <= 110 ? age : undefined;
}

function normalizeSexo(raw: string): string | undefined {
  const t = raw.trim().toLowerCase();
  if (!t) return undefined;
  if (t.startsWith("m")) return "M";
  if (t.startsWith("f")) return "F";
  return undefined;
}

/** Build the parsed lead list, WhatsApp validation summary and the rejected-rows report. */
export function buildParsed(
  records: Record<string, unknown>[],
  phoneCol: string,
): { leads: ParsedLead[]; meta: ImportMeta; rejected: RejectedRow[] } {
  const out: ParsedLead[] = [];
  const rejected: RejectedRow[] = [];
  const seen = new Set<string>();
  let comWhats = 0,
    invalidos = 0,
    semTelefone = 0,
    duplicados = 0,
    cpfInvalidos = 0,
    comCidade = 0,
    comIdade = 0,
    comMargem = 0;

  records.forEach((r, idx) => {
    const line = idx + 2; // header is line 1
    const keys = Object.keys(r).reduce<Record<string, string>>((a, k) => {
      a[k.toLowerCase().trim()] = k;
      return a;
    }, {});
    const get = (n: string) => (keys[n] ? String(r[keys[n]] ?? "").trim() : "");
    const getAny = (aliases: string[]) => {
      for (const a of aliases) {
        const v = get(a);
        if (v) return v;
      }
      for (const k of Object.keys(keys)) {
        if (aliases.some((a) => k === a || k.includes(a))) {
          const v = get(k);
          if (v) return v;
        }
      }
      return "";
    };

    const nomeRaw = get("nome") || getAny(["nome", "cliente", "servidor", "name"]);
    const isEmptyRow = Object.values(r).every((v) => String(v ?? "").trim() === "");
    if (!nomeRaw) {
      if (!isEmptyRow) rejected.push({ line, nome: "", telefone: "", reason: "Nome vazio" });
      return;
    }
    const { nome, matricula: matriculaNoNome } = limparNome(nomeRaw);

    const margemRaw = getAny(MARGIN_ALIASES);
    const urg = (get("urgencia") || get("urgência")).toLowerCase();

    // Collect every phone-like column on this row, plus the chosen/auto column.
    const phoneVals: string[] = [];
    const pushPhone = (v: string) => {
      const t = (v ?? "").trim();
      if (!t) return;
      // A cell may contain several numbers separated by / , ; or "e".
      for (const part of t.split(/[/,;]|\se\s/)) {
        const p = part.trim();
        // Only keep real Brazilian numbers (10/11 digits with DDD); drops junk
        // such as "146", "S" or "0" coming from look-alike columns.
        if (!p || !normalizeWhatsappNumber(p)) continue;
        if (!phoneVals.includes(p)) phoneVals.push(p);
      }
    };
    if (phoneCol && phoneCol !== "__auto__") pushPhone(r[phoneCol] != null ? String(r[phoneCol]) : "");
    for (const a of PHONE_ALIASES) pushPhone(get(a));
    for (const k of Object.keys(keys)) if (/cel|tel|whats|fone/.test(k)) pushPhone(get(k));

    const telRaw = phoneVals[0] ?? "";
    const cpfRes = normalizeCpfPlanilha(getAny(["cpf", "documento"]));
    if (cpfRes.invalido) cpfInvalidos++;
    const cpf = cpfRes.cpf;

    // In-file duplicate guard (CPF first, then first phone, then name).
    const dedupKey = cpf ? `cpf:${cpf}` : telRaw ? `tel:${telRaw.replace(/\D/g, "")}` : `nome:${nome.toLowerCase()}`;
    if (seen.has(dedupKey)) {
      duplicados++;
      rejected.push({ line, nome, telefone: telRaw, reason: "Duplicado na planilha" });
      return;
    }
    seen.add(dedupKey);

    if (!phoneVals.length) {
      semTelefone++;
      rejected.push({ line, nome, telefone: "", reason: "Sem telefone" });
    } else if (phoneVals.some((p) => normalizeWhatsappNumber(p))) {
      comWhats++;
    } else {
      invalidos++;
      rejected.push({ line, nome, telefone: telRaw, reason: "Telefone em formato inválido" });
    }

    const cidade = getAny(CITY_ALIASES) || undefined;
    const idadeCol = getAny(AGE_ALIASES);
    const idadeNum = idadeCol ? Number(idadeCol.replace(/\D/g, "")) : NaN;
    const idade =
      Number.isFinite(idadeNum) && idadeNum >= 16 && idadeNum <= 110 ? idadeNum : idadeDeNascimento(getAny(BIRTH_ALIASES));
    const sexo = normalizeSexo(getAny(SEX_ALIASES));
    const orcamento = margemRaw ? parseNumeroBr(margemRaw) : undefined;

    if (cidade) comCidade++;
    if (idade != null) comIdade++;
    if (orcamento != null) comMargem++;

    const raw: Record<string, unknown> = { ...r };
    if (matriculaNoNome && !raw.matricula) raw.matricula = matriculaNoNome;

    out.push({
      nome,
      telefone: telRaw || undefined,
      telefones: phoneVals.length ? phoneVals : undefined,
      cpf,
      cidade,
      idade: idade ?? undefined,
      sexo,
      origem: get("origem") || "planilha",
      orcamento: orcamento != null && orcamento > 0 ? orcamento : undefined,
      urgencia:
        urg === "alta" || urg === "media" || urg === "média" || urg === "baixa"
          ? urg === "média"
            ? "media"
            : (urg as "alta" | "media" | "baixa")
          : undefined,
      raw_data: raw,
    });
  });

  return {
    leads: out,
    meta: {
      total: out.length,
      comWhats,
      invalidos,
      semTelefone,
      duplicados,
      phoneCol: phoneCol === "__auto__" ? null : phoneCol,
      cpfInvalidos,
      comCidade,
      comIdade,
      comMargem,
    },
    rejected,
  };
}

/** Even split preview: how many leads each selected consultant would receive. */
export function previewSplit(totalLeads: number, consultants: number): { each: number; rest: number } {
  if (consultants <= 0) return { each: 0, rest: 0 };
  return { each: Math.floor(totalLeads / consultants), rest: totalLeads % consultants };
}
