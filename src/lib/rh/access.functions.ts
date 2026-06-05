// Server functions for managing per-tab RH access.
// - getMyRhAccess: returns the current user's allowed RH tabs (admins get all).
// - listRhUsers: admin-only; lists registered users and their granted tabs.
// - setRhUserAccess: admin-only; replaces the set of tabs granted to a user.

import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

async function assertAdmin(supabase: any, userId: string) {
  const { data, error } = await supabase.rpc("has_role", {
    _user_id: userId,
    _role: "admin",
  });
  if (error) throw new Error(error.message);
  if (!data) throw new Error("Acesso restrito a administradores.");
}

export const getMyRhAccess = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<{ isAdmin: boolean; tabs: string[] }> => {
    const { supabase, userId } = context;

    const { data: isAdmin } = await supabase.rpc("has_role", {
      _user_id: userId,
      _role: "admin",
    });

    if (isAdmin) return { isAdmin: true, tabs: [] };

    const { data, error } = await supabase
      .from("rh_tab_access")
      .select("tab_key")
      .eq("user_id", userId);
    if (error) throw new Error(error.message);

    return { isAdmin: false, tabs: (data ?? []).map((r) => r.tab_key as string) };
  });

export type RhUserAccess = { id: string; email: string; tabs: string[] };

export const listRhUsers = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<RhUserAccess[]> => {
    const { supabase, userId } = context;
    await assertAdmin(supabase, userId);

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: usersData, error: usersErr } = await supabaseAdmin.auth.admin.listUsers({
      page: 1,
      perPage: 1000,
    });
    if (usersErr) throw new Error(usersErr.message);

    const { data: grants, error: grantsErr } = await supabaseAdmin
      .from("rh_tab_access")
      .select("user_id, tab_key");
    if (grantsErr) throw new Error(grantsErr.message);

    const byUser = new Map<string, string[]>();
    for (const g of grants ?? []) {
      const list = byUser.get(g.user_id as string) ?? [];
      list.push(g.tab_key as string);
      byUser.set(g.user_id as string, list);
    }

    return usersData.users.map((u) => ({
      id: u.id,
      email: u.email ?? "(sem e-mail)",
      tabs: byUser.get(u.id) ?? [],
    }));
  });

export const setRhUserAccess = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) =>
    z
      .object({
        userId: z.string().uuid(),
        tabs: z.array(z.string().min(1).max(120)).max(100),
      })
      .parse(data),
  )
  .handler(async ({ context, data }): Promise<{ ok: true }> => {
    const { supabase, userId } = context;
    await assertAdmin(supabase, userId);

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    // Replace the user's grants with the new set.
    const { error: delErr } = await supabaseAdmin
      .from("rh_tab_access")
      .delete()
      .eq("user_id", data.userId);
    if (delErr) throw new Error(delErr.message);

    if (data.tabs.length) {
      const rows = data.tabs.map((tab_key) => ({ user_id: data.userId, tab_key }));
      const { error: insErr } = await supabaseAdmin.from("rh_tab_access").insert(rows);
      if (insErr) throw new Error(insErr.message);
    }

    return { ok: true };
  });
