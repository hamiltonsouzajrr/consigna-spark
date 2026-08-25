// Server-only helpers for the weekly prospecting competition.
// Every point is written here (never from the browser) and each rule below is
// what keeps the ranking from being gamed by clicking volume.

export const PONTOS = {
  contato: 10,
  qualificacao: 10,
  followup: 10,
  ganho: 25,
} as const;

/** Anti-burst: contacts closer than this (same consultant) do not score. */
export const CONTATO_COOLDOWN_MS = 90_000;
/** Qualification requires a contact at least this old on the same lead. */
export const QUALIFICACAO_MIN_APOS_CONTATO_MS = 5 * 60_000;
/** Daily ceilings per category (counted points, not clicks). */
export const TETO_DIARIO = { contato: 170, qualificacao: 170, followup: 120, ganho: 40 } as const;

export type Categoria = keyof typeof PONTOS;

/** Monday of the current competition week, in America/Maceio. */
export function weekStart(at: Date = new Date()): string {
  const local = new Date(at.toLocaleString("en-US", { timeZone: "America/Maceio" }));
  const dow = (local.getDay() + 6) % 7; // 0 = Monday
  local.setDate(local.getDate() - dow);
  const y = local.getFullYear();
  const m = String(local.getMonth() + 1).padStart(2, "0");
  const d = String(local.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

/** Friday 16:00 (Maceio, UTC-3) of the given week, as an ISO instant. */
export function closesAt(ws: string): string {
  const [y, m, d] = ws.split("-").map(Number);
  const friday = new Date(Date.UTC(y, (m ?? 1) - 1, (d ?? 1) + 4, 19, 0, 0));
  return friday.toISOString();
}

async function admin() {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin as any;
}

export async function garantirSemana(ws = weekStart()) {
  const db = await admin();
  const { data } = await db
    .from("prospect_competicao_semanas")
    .select("*")
    .eq("week_start", ws)
    .maybeSingle();
  if (data) return data;
  await db
    .from("prospect_competicao_semanas")
    .insert({ week_start: ws, closes_at: closesAt(ws) } as any);
  const { data: row } = await db
    .from("prospect_competicao_semanas")
    .select("*")
    .eq("week_start", ws)
    .maybeSingle();
  return row;
}

async function isAdminUser(db: any, userId: string) {
  const { data } = await db.rpc("has_role", { _user_id: userId, _role: "admin" });
  return Boolean(data);
}

/**
 * Credits a point. Returns the amount actually credited (0 when the rules
 * refuse it: duplicate lead/category, daily ceiling, admin user).
 */
export async function creditar(
  userId: string,
  categoria: Categoria,
  refTabela: string,
  refId: string,
  motivo?: string,
): Promise<number> {
  const db = await admin();
  await garantirSemana();
  const { data, error } = await db.rpc("registrar_ponto", {
    _user_id: userId,
    _categoria: categoria,
    _ref_tabela: refTabela,
    _ref_id: refId,
    _pontos: PONTOS[categoria],
    _motivo: motivo ?? null,
    _teto_diario: TETO_DIARIO[categoria],
  });
  if (error) return 0;
  return Number(data ?? 0);
}

export async function estornar(refTabela: string, refId: string, categorias: Categoria[] | null, motivo: string) {
  const db = await admin();
  await db.rpc("estornar_pontos", {
    _ref_tabela: refTabela,
    _ref_id: refId,
    _categorias: categorias,
    _motivo: motivo,
  });
}

/** True when the consultant's last counted contact is older than the cooldown. */
export async function cooldownLiberado(userId: string): Promise<boolean> {
  const db = await admin();
  const { data } = await db
    .from("prospect_pontos")
    .select("created_at")
    .eq("user_id", userId)
    .eq("categoria", "contato")
    .is("anulado_em", null)
    .order("created_at", { ascending: false })
    .limit(1);
  const last = data?.[0]?.created_at;
  if (!last) return true;
  return Date.now() - new Date(last).getTime() >= CONTATO_COOLDOWN_MS;
}

/** Oldest real contact event on the lead (used by the qualification rule). */
export async function primeiroContatoEm(leadId: string): Promise<Date | null> {
  const db = await admin();
  const { data } = await db
    .from("lead_events")
    .select("created_at")
    .eq("lead_id", leadId)
    .in("kind", ["ligacao", "whatsapp"])
    .order("created_at", { ascending: true })
    .limit(1);
  const at = data?.[0]?.created_at;
  return at ? new Date(at) : null;
}

export async function contatoHoje(leadId: string): Promise<boolean> {
  const db = await admin();
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  const { count } = await db
    .from("lead_events")
    .select("id", { count: "exact", head: true })
    .eq("lead_id", leadId)
    .in("kind", ["ligacao", "whatsapp"])
    .gte("created_at", start.toISOString());
  return (count ?? 0) > 0;
}

export type RankingRow = {
  user_id: string;
  nome: string;
  contatos: number;
  qualificacoes: number;
  followups: number;
  ganhos: number;
  total: number;
};

export async function ranking(ws = weekStart()): Promise<RankingRow[]> {
  const db = await admin();
  const { data, error } = await db.rpc("ranking_competicao", { _week_start: ws });
  if (error) throw new Error(error.message);
  return (data ?? []) as RankingRow[];
}

export async function assertNaoAdmin(userId: string) {
  const db = await admin();
  return isAdminUser(db, userId);
}

export { admin as adminClient, isAdminUser };
