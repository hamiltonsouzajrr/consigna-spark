// Server functions for managing per-tab RH access.
// - getMyRhAccess: returns the current user's allowed RH tabs (admins get all).
// - listRhUsers: admin-only; lists registered users, their granted tabs and linked collaborator.
// - setRhUserAccess: admin-only; replaces the set of tabs granted to a user (+ notifies them).
// - listRhEmployees: admin-only; lists collaborators for linking.
// - linkEmployeeUser: admin-only; links/unlinks a collaborator to a user account.
// - getMyNotifications / markNotificationsRead: in-app notification bell.

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

export type RhEmployee = {
  id: string;
  full_name: string;
  job_title: string | null;
  department: string | null;
  user_id: string | null;
};

export type RhUserAccess = {
  id: string;
  email: string;
  tabs: string[];
  isAdmin: boolean;
  employee: { id: string; full_name: string } | null;
  createdAt: string | null;
  lastSignInAt: string | null;
  emailConfirmed: boolean;
  blocked: boolean;
  hasConsultora: boolean;
};


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

    const { data: emps } = await supabaseAdmin
      .from("rh_employees")
      .select("id, full_name, user_id");

    const { data: roles } = await supabaseAdmin
      .from("user_roles")
      .select("user_id, role")
      .eq("role", "admin");

    const adminSet = new Set<string>((roles ?? []).map((r: any) => r.user_id as string));

    const byUser = new Map<string, string[]>();
    for (const g of grants ?? []) {
      const list = byUser.get(g.user_id as string) ?? [];
      list.push(g.tab_key as string);
      byUser.set(g.user_id as string, list);
    }

    const empByUser = new Map<string, { id: string; full_name: string }>();
    for (const e of (emps ?? []) as any[]) {
      if (e.user_id) empByUser.set(e.user_id as string, { id: e.id, full_name: e.full_name });
    }

    return usersData.users.map((u) => ({
      id: u.id,
      email: u.email ?? "(sem e-mail)",
      tabs: byUser.get(u.id) ?? [],
      isAdmin: adminSet.has(u.id),
      employee: empByUser.get(u.id) ?? null,
    }));
  });

export const listRhEmployees = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<RhEmployee[]> => {
    const { supabase, userId } = context;
    await assertAdmin(supabase, userId);

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data, error } = await supabaseAdmin
      .from("rh_employees")
      .select("id, full_name, job_title, department, user_id")
      .order("full_name");
    if (error) throw new Error(error.message);
    return (data ?? []) as any as RhEmployee[];
  });

export const linkEmployeeUser = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) =>
    z
      .object({
        userId: z.string().uuid(),
        employeeId: z.string().uuid().nullable(),
      })
      .parse(data),
  )
  .handler(async ({ context, data }): Promise<{ ok: true }> => {
    const { supabase, userId } = context;
    await assertAdmin(supabase, userId);

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    // Clear any previous collaborator linked to this user (1:1 link).
    const { error: clearErr } = await supabaseAdmin
      .from("rh_employees")
      .update({ user_id: null } as any)
      .eq("user_id", data.userId);
    if (clearErr) throw new Error(clearErr.message);

    if (data.employeeId) {
      const { error } = await supabaseAdmin
        .from("rh_employees")
        .update({ user_id: data.userId } as any)
        .eq("id", data.employeeId);
      if (error) throw new Error(error.message);
    }

    return { ok: true };
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

    // Notify the affected user (in-app bell).
    await supabaseAdmin.from("rh_notifications").insert({
      user_id: data.userId,
      title: "Seus acessos ao RH foram atualizados",
      body:
        data.tabs.length > 0
          ? `Você tem acesso a ${data.tabs.length} ${data.tabs.length === 1 ? "aba" : "abas"} do RH.`
          : "Seu acesso às abas do RH foi removido.",
    } as any);

    return { ok: true };
  });

export type RhNotification = {
  id: string;
  title: string;
  body: string | null;
  read: boolean;
  created_at: string;
};

export const getMyNotifications = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<RhNotification[]> => {
    const { supabase, userId } = context;
    const { data, error } = await supabase
      .from("rh_notifications")
      .select("id, title, body, read, created_at")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(30);
    if (error) throw new Error(error.message);
    return (data ?? []) as any as RhNotification[];
  });

export const markNotificationsRead = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) =>
    z.object({ ids: z.array(z.string().uuid()).max(100).optional() }).parse(data ?? {}),
  )
  .handler(async ({ context, data }): Promise<{ ok: true }> => {
    const { supabase, userId } = context;
    let q = supabase.from("rh_notifications").update({ read: true } as any).eq("user_id", userId);
    if (data.ids && data.ids.length) q = q.in("id", data.ids);
    const { error } = await q;
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// ============= User management (admin-only) =============

async function setAdminRole(supabaseAdmin: any, userId: string, isAdmin: boolean) {
  if (isAdmin) {
    const { error } = await supabaseAdmin
      .from("user_roles")
      .upsert({ user_id: userId, role: "admin" }, { onConflict: "user_id,role" });
    if (error) throw new Error(error.message);
  } else {
    const { error } = await supabaseAdmin
      .from("user_roles")
      .delete()
      .eq("user_id", userId)
      .eq("role", "admin");
    if (error) throw new Error(error.message);
  }
}

export const createRhUser = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) =>
    z
      .object({
        email: z.string().trim().email().max(255),
        password: z.string().min(6).max(72),
        isAdmin: z.boolean().default(false),
      })
      .parse(data),
  )
  .handler(async ({ context, data }): Promise<{ id: string }> => {
    const { supabase, userId } = context;
    await assertAdmin(supabase, userId);

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: created, error } = await supabaseAdmin.auth.admin.createUser({
      email: data.email,
      password: data.password,
      email_confirm: true,
    });
    if (error) throw new Error(error.message);

    if (data.isAdmin) await setAdminRole(supabaseAdmin, created.user.id, true);

    return { id: created.user.id };
  });

export const updateRhUser = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) =>
    z
      .object({
        targetUserId: z.string().uuid(),
        email: z.string().trim().email().max(255).optional(),
        password: z.string().min(6).max(72).optional().or(z.literal("")),
        isAdmin: z.boolean().optional(),
      })
      .parse(data),
  )
  .handler(async ({ context, data }): Promise<{ ok: true }> => {
    const { supabase, userId } = context;
    await assertAdmin(supabase, userId);

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const attrs: Record<string, unknown> = {};
    if (data.email) attrs.email = data.email;
    if (data.password) attrs.password = data.password;
    if (Object.keys(attrs).length) {
      const { error } = await supabaseAdmin.auth.admin.updateUserById(data.targetUserId, attrs);
      if (error) throw new Error(error.message);
    }

    if (typeof data.isAdmin === "boolean") {
      await setAdminRole(supabaseAdmin, data.targetUserId, data.isAdmin);
    }

    return { ok: true };
  });

export const deleteRhUser = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) =>
    z.object({ targetUserId: z.string().uuid() }).parse(data),
  )
  .handler(async ({ context, data }): Promise<{ ok: true }> => {
    const { supabase, userId } = context;
    await assertAdmin(supabase, userId);
    if (data.targetUserId === userId) {
      throw new Error("Você não pode excluir o próprio usuário.");
    }

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    // Unlink collaborator and remove grants/roles before deleting the auth user.
    await supabaseAdmin.from("rh_employees").update({ user_id: null } as any).eq("user_id", data.targetUserId);
    await supabaseAdmin.from("rh_tab_access").delete().eq("user_id", data.targetUserId);
    await supabaseAdmin.from("user_roles").delete().eq("user_id", data.targetUserId);

    const { error } = await supabaseAdmin.auth.admin.deleteUser(data.targetUserId);
    if (error) throw new Error(error.message);

    return { ok: true };
  });
