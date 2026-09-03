// Helper tipado para chamar as rotinas transacionais do banco (RPC) usadas na
// distribuição de leads. Concentra aqui o único ponto em que precisamos abrir
// mão dos tipos gerados — as rotinas internas não aparecem no schema público.
export async function callRpc<T>(
  fn: string,
  args: Record<string, unknown> = {},
): Promise<T | null> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const client = supabaseAdmin as unknown as {
    rpc: (fn: string, args: Record<string, unknown>) => Promise<{ data: unknown; error: { message: string } | null }>;
  };
  const { data, error } = await client.rpc(fn, args);
  if (error) throw new Error(error.message);
  return (data ?? null) as T | null;
}

/** Rotinas do banco que retornam uma única linha (TABLE(...)). */
export async function callRpcRow<T extends Record<string, unknown>>(
  fn: string,
  args: Record<string, unknown> = {},
): Promise<Partial<T>> {
  const data = await callRpc<T | T[]>(fn, args);
  const row = Array.isArray(data) ? data[0] : data;
  return (row ?? {}) as Partial<T>;
}
