import { normalizeWhatsappNumber } from "@/lib/prospeccao/constants";

export type ParsedLead = {
  nome: string;
  telefone?: string;
  telefones?: string[];
  cpf?: string;
  cidade?: string;
  origem?: string;
  orcamento?: number;
  urgencia?: "alta" | "media" | "baixa";
};

export type RejectedRow = { line: number; nome: string; telefone: string; reason: string };

export type ImportMeta = {
  total: number;
  comWhats: number;
  invalidos: number;
  semTelefone: number;
  duplicados: number;
  phoneCol: string | null;
};

export const PHONE_ALIASES = ["telefone", "celular", "whatsapp", "cel1", "cel2", "cel", "fone", "contato", "numero", "número"];

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
    duplicados = 0;

  records.forEach((r, idx) => {
    const line = idx + 2; // header is line 1
    const keys = Object.keys(r).reduce<Record<string, string>>((a, k) => {
      a[k.toLowerCase().trim()] = k;
      return a;
    }, {});
    const get = (n: string) => (keys[n] ? String(r[keys[n]] ?? "").trim() : "");
    const nome = get("nome");
    const isEmptyRow = Object.values(r).every((v) => String(v ?? "").trim() === "");
    if (!nome) {
      if (!isEmptyRow) rejected.push({ line, nome: "", telefone: "", reason: "Nome vazio" });
      return;
    }

    const orc = get("orcamento") || get("orçamento") || get("margem") || get("renda");
    const urg = (get("urgencia") || get("urgência")).toLowerCase();

    // Collect every phone-like column on this row, plus the chosen/auto column.
    const phoneVals: string[] = [];
    const pushPhone = (v: string) => {
      const t = (v ?? "").trim();
      if (!t) return;
      // A cell may contain several numbers separated by / , ; or "e".
      for (const part of t.split(/[/,;]|\se\s/)) {
        const p = part.trim();
        if (p && !phoneVals.includes(p)) phoneVals.push(p);
      }
    };
    if (phoneCol && phoneCol !== "__auto__") pushPhone(r[phoneCol] != null ? String(r[phoneCol]) : "");
    for (const a of PHONE_ALIASES) pushPhone(get(a));
    for (const k of Object.keys(keys)) if (/cel|tel|whats|fone|contato/.test(k)) pushPhone(get(k));

    const telRaw = phoneVals[0] ?? "";
    const cpf = get("cpf");

    // In-file duplicate guard (CPF first, then first phone, then name).
    const dedupKey = cpf ? `cpf:${cpf.replace(/\D/g, "")}` : telRaw ? `tel:${telRaw.replace(/\D/g, "")}` : `nome:${nome.toLowerCase()}`;
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

    out.push({
      nome,
      telefone: telRaw || undefined,
      telefones: phoneVals.length ? phoneVals : undefined,
      cpf: cpf || undefined,
      cidade: get("cidade") || undefined,
      origem: get("origem") || "planilha",
      orcamento: orc ? Number(orc.replace(/[^\d.,-]/g, "").replace(/\./g, "").replace(",", ".")) || undefined : undefined,
      urgencia:
        urg === "alta" || urg === "media" || urg === "média" || urg === "baixa"
          ? urg === "média"
            ? "media"
            : (urg as "alta" | "media" | "baixa")
          : undefined,
    });
  });

  return {
    leads: out,
    meta: { total: out.length, comWhats, invalidos, semTelefone, duplicados, phoneCol: phoneCol === "__auto__" ? null : phoneCol },
    rejected,
  };
}

/** Even split preview: how many leads each selected consultant would receive. */
export function previewSplit(totalLeads: number, consultants: number): { each: number; rest: number } {
  if (consultants <= 0) return { each: 0, rest: 0 };
  return { each: Math.floor(totalLeads / consultants), rest: totalLeads % consultants };
}
