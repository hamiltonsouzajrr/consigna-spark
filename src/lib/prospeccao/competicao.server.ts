// Server-only helpers for the weekly prospecting competition.
// Every point is written here (never from the browser) and each rule below is
// what keeps the ranking from being gamed by clicking volume.

export const PONTOS = {
  contato: 10,
  followup: 10,
  ganho: 40,
} as const;

/** Anti-burst: contacts closer than this (same consultant) do not score. */
export const CONTATO_COOLDOWN_MS = 90_000;
/** Daily ceilings per category (counted points, not clicks). */
export const TETO_DIARIO = { contato: 170, followup: 120, ganho: 120 } as const;

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

// ---------------------------------------------------------------------------
// Vendas fechadas em stand-by: nenhuma venda pontua antes da conferência do
// gerente/administrador. A consultora registra, o admin confirma ou recusa.
// ---------------------------------------------------------------------------

export type VendaOrigem = "crm" | "tomadores_al";

export type VendaPendente = {
  id: string;
  user_id: string;
  nome: string;
  origem: VendaOrigem;
  ref_tabela: string;
  ref_id: string;
  cliente_nome: string | null;
  week_start: string;
  status: "pendente" | "confirmada" | "recusada";
  pontos_creditados: number;
  motivo: string | null;
  motivo_recusa: string | null;
  revisado_em: string | null;
  created_at: string;
  valor: number | null;
};

/** Registra (ou reaproveita) a venda pendente. Nunca credita pontos. */
export async function registrarVendaPendente(
  userId: string,
  origem: VendaOrigem,
  refTabela: string,
  refId: string,
  clienteNome?: string | null,
  motivo?: string | null,
): Promise<{ pendente: boolean; jaConfirmada: boolean }> {
  const db = await admin();
  await garantirSemana();

  const { data: existentes } = await db
    .from("prospect_vendas")
    .select("id,status")
    .eq("ref_tabela", refTabela)
    .eq("ref_id", refId)
    .order("created_at", { ascending: false })
    .limit(5);

  const rows = (existentes ?? []) as { id: string; status: string }[];
  if (rows.some((r) => r.status === "confirmada")) return { pendente: false, jaConfirmada: true };
  if (rows.some((r) => r.status === "pendente")) return { pendente: true, jaConfirmada: false };

  await db.from("prospect_vendas").insert({
    user_id: userId,
    origem,
    ref_tabela: refTabela,
    ref_id: refId,
    cliente_nome: clienteNome ?? null,
    week_start: weekStart(),
    status: "pendente",
    motivo: motivo ?? "Venda fechada",
  } as any);

  return { pendente: true, jaConfirmada: false };
}

/** Cancela a pendência (lead voltou atrás) e estorna qualquer ponto já dado. */
export async function cancelarVenda(refTabela: string, refId: string, motivo: string) {
  const db = await admin();
  await db
    .from("prospect_vendas")
    .delete()
    .eq("ref_tabela", refTabela)
    .eq("ref_id", refId)
    .eq("status", "pendente");
  await db
    .from("prospect_vendas")
    .update({ status: "recusada", motivo_recusa: motivo, revisado_em: new Date().toISOString() } as any)
    .eq("ref_tabela", refTabela)
    .eq("ref_id", refId)
    .eq("status", "confirmada");
  await estornar(refTabela, refId, ["ganho"], motivo);
}

export async function listarVendas(status?: "pendente" | "confirmada" | "recusada", limit = 100): Promise<VendaPendente[]> {
  const db = await admin();
  let q = db
    .from("prospect_vendas")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(limit);
  if (status) q = q.eq("status", status);
  const { data, error } = await q;
  if (error) throw new Error(error.message);
  const rows = (data ?? []) as any[];

  const ids = [...new Set(rows.map((r) => r.user_id))];
  const nomes = new Map<string, string>();
  if (ids.length) {
    const { data: profs } = await db.from("profiles").select("user_id,nome_completo").in("user_id", ids);
    for (const p of profs ?? []) nomes.set(p.user_id, p.nome_completo);
  }

  // Nome do cliente e valor de referência da operação.
  const leadIds = rows.filter((r) => r.ref_tabela === "prospect_leads").map((r) => r.ref_id);
  const tomadorIds = rows.filter((r) => r.ref_tabela === "tomadores_al").map((r) => r.ref_id);
  const clientes = new Map<string, string>();
  const valores = new Map<string, number | null>();
  if (leadIds.length) {
    const { data: leads } = await db.from("prospect_leads").select("id,nome,orcamento").in("id", leadIds);
    for (const l of leads ?? []) {
      clientes.set(l.id, l.nome);
      valores.set(l.id, (l as any).orcamento ?? null);
    }
  }
  if (tomadorIds.length) {
    const { data: toms } = await db
      .from("tomadores_al")
      .select("id,nome,margem_disp_emprestimo")
      .in("id", tomadorIds);
    for (const t of toms ?? []) {
      clientes.set(t.id, t.nome);
      valores.set(t.id, (t as any).margem_disp_emprestimo ?? null);
    }
  }

  return rows.map((r) => ({
    ...r,
    nome: nomes.get(r.user_id) ?? "Consultora",
    cliente_nome: r.cliente_nome ?? clientes.get(r.ref_id) ?? null,
    valor: valores.get(r.ref_id) ?? null,
  })) as VendaPendente[];
}

/** Confirma a venda e só então credita os pontos de "ganho". */
export async function confirmarVenda(vendaId: string, adminUserId: string): Promise<{ pontos: number }> {
  const db = await admin();
  const { data: venda } = await db.from("prospect_vendas").select("*").eq("id", vendaId).maybeSingle();
  if (!venda) throw new Error("Venda não encontrada.");
  if (venda.status === "confirmada") return { pontos: venda.pontos_creditados ?? 0 };

  const semana = await garantirSemana();
  if (semana?.pausada) throw new Error("Competição pausada — retome antes de confirmar vendas.");

  const pontos = await creditar(
    venda.user_id,
    "ganho",
    venda.ref_tabela,
    venda.ref_id,
    venda.motivo ?? "Venda confirmada pelo gerente",
  );

  await db
    .from("prospect_vendas")
    .update({
      status: "confirmada",
      pontos_creditados: pontos,
      motivo_recusa: null,
      revisado_por: adminUserId,
      revisado_em: new Date().toISOString(),
    } as any)
    .eq("id", vendaId);

  return { pontos };
}

/** Recusa a venda; se já havia sido confirmada, estorna os pontos. */
export async function recusarVenda(vendaId: string, adminUserId: string, motivo: string) {
  const db = await admin();
  const { data: venda } = await db.from("prospect_vendas").select("*").eq("id", vendaId).maybeSingle();
  if (!venda) throw new Error("Venda não encontrada.");
  if (venda.status === "confirmada") {
    await estornar(venda.ref_tabela, venda.ref_id, ["ganho"], `venda recusada: ${motivo}`);
  }
  await db
    .from("prospect_vendas")
    .update({
      status: "recusada",
      pontos_creditados: 0,
      motivo_recusa: motivo,
      revisado_por: adminUserId,
      revisado_em: new Date().toISOString(),
    } as any)
    .eq("id", vendaId);
}
