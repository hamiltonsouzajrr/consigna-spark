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

// Gestores de acessos podem liberar/remover abas e vincular colaboradores,
// mas não criam/excluem usuários nem promovem administradores.
async function assertAccessManager(supabase: any, userId: string) {
  const [{ data: isAdmin }, { data: isManager }] = await Promise.all([
    supabase.rpc("has_role", { _user_id: userId, _role: "admin" }),
    supabase.rpc("has_role", { _user_id: userId, _role: "gestor_acessos" }),
  ]);
  if (!isAdmin && !isManager) {
    throw new Error("Acesso restrito a administradores ou gestores de acessos.");
  }
}

async function countAdmins(supabaseAdmin: any): Promise<number> {
  const { count, error } = await supabaseAdmin
    .from("user_roles")
    .select("user_id", { count: "exact", head: true })
    .eq("role", "admin");
  if (error) throw new Error(error.message);
  return count ?? 0;
}

async function isAdminUser(supabaseAdmin: any, targetUserId: string): Promise<boolean> {
  const { data } = await supabaseAdmin
    .from("user_roles")
    .select("user_id")
    .eq("user_id", targetUserId)
    .eq("role", "admin")
    .maybeSingle();
  return !!data;
}

// Impede que a última conta de administrador seja removida, rebaixada ou bloqueada.
async function assertNotLastAdmin(supabaseAdmin: any, targetUserId: string, acao: string) {
  if (!(await isAdminUser(supabaseAdmin, targetUserId))) return;
  const total = await countAdmins(supabaseAdmin);
  if (total <= 1) {
    throw new Error(
      `Não é possível ${acao}: este é o único administrador do sistema. Promova outro administrador antes.`,
    );
  }
}

export const getMyRhAccess = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(
    async ({
      context,
    }): Promise<{ isAdmin: boolean; isAccessManager: boolean; tabs: string[] }> => {
      const { supabase, userId } = context;

      const [{ data: isAdmin }, { data: isManager }] = await Promise.all([
        supabase.rpc("has_role", { _user_id: userId, _role: "admin" }),
        supabase.rpc("has_role", { _user_id: userId, _role: "gestor_acessos" }),
      ]);

      if (isAdmin) return { isAdmin: true, isAccessManager: true, tabs: [] };

      const { data, error } = await supabase
        .from("rh_tab_access")
        .select("tab_key")
        .eq("user_id", userId);
      if (error) throw new Error(error.message);

      return {
        isAdmin: false,
        isAccessManager: !!isManager,
        tabs: (data ?? []).map((r) => r.tab_key as string),
      };
    },
  );


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

    const { data: consultoras } = await supabaseAdmin
      .from("radar_consultoras")
      .select("email");
    const consultoraEmails = new Set<string>(
      ((consultoras ?? []) as any[])
        .map((c) => (c.email ? String(c.email).toLowerCase() : null))
        .filter(Boolean) as string[],
    );

    return usersData.users.map((u) => ({
      id: u.id,
      email: u.email ?? "(sem e-mail)",
      tabs: byUser.get(u.id) ?? [],
      isAdmin: adminSet.has(u.id),
      employee: empByUser.get(u.id) ?? null,
      createdAt: u.created_at ?? null,
      lastSignInAt: (u as any).last_sign_in_at ?? null,
      emailConfirmed: !!(u as any).email_confirmed_at,
      blocked: !!(u as any).banned_until && new Date((u as any).banned_until) > new Date(),
      hasConsultora: !!u.email && consultoraEmails.has(u.email.toLowerCase()),
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
    const { supabase, userId, claims } = context;
    await assertAccessManager(supabase, userId);


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

    await logAudit(supabaseAdmin, {
      actorId: userId,
      actorEmail: (claims as any)?.email ?? null,
      targetUserId: data.userId,
      action: data.employeeId ? "vinculou_colaborador" : "desvinculou_colaborador",
    });

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
    const { supabase, userId, claims } = context;
    await assertAccessManager(supabase, userId);

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    // Guarda o estado anterior para permitir reverter pelo histórico.
    const { data: beforeRows } = await supabaseAdmin
      .from("rh_tab_access")
      .select("tab_key")
      .eq("user_id", data.userId);
    const before = ((beforeRows ?? []) as any[]).map((r) => r.tab_key as string);

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

    await logAudit(supabaseAdmin, {
      actorId: userId,
      actorEmail: (claims as any)?.email ?? null,
      targetUserId: data.userId,
      action: "atualizou_acessos",
      detail: { tabs: data.tabs, before, after: data.tabs },
    });

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
    const { supabase, userId, claims } = context;
    await assertAdmin(supabase, userId);

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: created, error } = await supabaseAdmin.auth.admin.createUser({
      email: data.email,
      password: data.password,
      email_confirm: true,
    });
    if (error) throw new Error(error.message);

    if (data.isAdmin) await setAdminRole(supabaseAdmin, created.user.id, true);

    // Mantém a base de consultoras em sincronia com os acessos criados.
    const lower = data.email.toLowerCase();
    const { data: consultora } = await supabaseAdmin
      .from("radar_consultoras")
      .select("id, ativo")
      .ilike("email", lower)
      .maybeSingle();
    if (consultora) {
      if (!(consultora as any).ativo) {
        await supabaseAdmin
          .from("radar_consultoras")
          .update({ ativo: true } as any)
          .eq("id", (consultora as any).id);
      }
    } else {
      const nome = lower
        .split("@")[0]!
        .replace(/[._-]+/g, " ")
        .replace(/\b\w/g, (c) => c.toUpperCase());
      await supabaseAdmin
        .from("radar_consultoras")
        .insert({ nome, email: lower, ativo: true } as any);
    }

    await logAudit(supabaseAdmin, {
      actorId: userId,
      actorEmail: (claims as any)?.email ?? null,
      targetUserId: created.user.id,
      targetEmail: data.email,
      action: "criou_usuario",
      detail: { admin: data.isAdmin },
    });

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
    const { supabase, userId, claims } = context;
    await assertAdmin(supabase, userId);

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    // Guardas do papel de admin: ninguém remove o próprio admin nem deixa o
    // sistema sem nenhum administrador.
    if (data.isAdmin === false) {
      if (data.targetUserId === userId) {
        throw new Error("Você não pode remover seu próprio acesso de administrador.");
      }
      await assertNotLastAdmin(supabaseAdmin, data.targetUserId, "rebaixar este administrador");
    }

    const eraAdmin =
      typeof data.isAdmin === "boolean" ? await isAdminUser(supabaseAdmin, data.targetUserId) : false;

    const attrs: Record<string, unknown> = {};
    if (data.email) attrs.email = data.email;
    if (data.password) attrs.password = data.password;
    if (Object.keys(attrs).length) {
      const { error } = await supabaseAdmin.auth.admin.updateUserById(data.targetUserId, attrs);
      if (error) throw new Error(error.message);
    }

    if (typeof data.isAdmin === "boolean") {
      await setAdminRole(supabaseAdmin, data.targetUserId, data.isAdmin);
      if (data.isAdmin !== eraAdmin) {
        await logAudit(supabaseAdmin, {
          actorId: userId,
          actorEmail: (claims as any)?.email ?? null,
          targetUserId: data.targetUserId,
          targetEmail: data.email ?? null,
          action: data.isAdmin ? "promoveu_admin" : "rebaixou_admin",
        });
      }
    }

    await logAudit(supabaseAdmin, {
      actorId: userId,
      actorEmail: (claims as any)?.email ?? null,
      targetUserId: data.targetUserId,
      targetEmail: data.email ?? null,
      action: "atualizou_usuario",
      detail: {
        email: !!data.email,
        senha: !!data.password,
        admin: typeof data.isAdmin === "boolean" ? data.isAdmin : null,
      },
    });

    return { ok: true };
  });

export const deleteRhUser = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) =>
    z.object({ targetUserId: z.string().uuid() }).parse(data),
  )
  .handler(async ({ context, data }): Promise<{ ok: true }> => {
    const { supabase, userId, claims } = context;
    await assertAdmin(supabase, userId);
    if (data.targetUserId === userId) {
      throw new Error("Você não pode excluir o próprio usuário.");
    }

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    await assertNotLastAdmin(supabaseAdmin, data.targetUserId, "excluir este usuário");

    // Unlink collaborator and remove grants/roles before deleting the auth user.
    await supabaseAdmin.from("rh_employees").update({ user_id: null } as any).eq("user_id", data.targetUserId);
    await supabaseAdmin.from("rh_tab_access").delete().eq("user_id", data.targetUserId);
    await supabaseAdmin.from("user_roles").delete().eq("user_id", data.targetUserId);

    const { error } = await supabaseAdmin.auth.admin.deleteUser(data.targetUserId);
    if (error) throw new Error(error.message);

    await logAudit(supabaseAdmin, {
      actorId: userId,
      actorEmail: (claims as any)?.email ?? null,
      targetUserId: data.targetUserId,
      action: "excluiu_usuario",
    });

    return { ok: true };
  });

// ============= Auditoria, status da conta, ações em massa e sincronização =============

async function logAudit(
  supabaseAdmin: any,
  entry: {
    actorId: string;
    actorEmail?: string | null;
    targetUserId?: string | null;
    targetEmail?: string | null;
    action: string;
    detail?: Record<string, unknown>;
  },
) {
  try {
    await supabaseAdmin.from("rh_access_audit").insert({
      actor_id: entry.actorId,
      actor_email: entry.actorEmail ?? null,
      target_user_id: entry.targetUserId ?? null,
      target_email: entry.targetEmail ?? null,
      action: entry.action,
      detail: entry.detail ?? {},
    });
  } catch {
    // auditoria nunca deve quebrar a operação principal
  }
}

export type RhAuditEntry = {
  id: string;
  actor_email: string | null;
  target_email: string | null;
  action: string;
  detail: any;
  created_at: string;
  target_user_id: string | null;
};

export const listRhAccessAudit = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) =>
    z
      .object({
        actor: z.string().trim().max(255).optional(),
        target: z.string().trim().max(255).optional(),
        action: z.string().trim().max(60).optional(),
        from: z.string().trim().max(30).optional(),
        to: z.string().trim().max(30).optional(),
        limit: z.number().int().min(10).max(500).default(100),
      })
      .parse(data ?? {}),
  )
  .handler(async ({ context, data }): Promise<RhAuditEntry[]> => {
    const { supabase, userId } = context;
    await assertAdmin(supabase, userId);

    let q = supabase
      .from("rh_access_audit")
      .select("id, actor_email, target_email, action, detail, created_at, target_user_id")
      .order("created_at", { ascending: false })
      .limit(data.limit);

    if (data.actor) q = q.ilike("actor_email", `%${data.actor}%`);
    if (data.target) q = q.ilike("target_email", `%${data.target}%`);
    if (data.action) q = q.eq("action", data.action);
    if (data.from) q = q.gte("created_at", new Date(data.from).toISOString());
    if (data.to) {
      const end = new Date(data.to);
      end.setHours(23, 59, 59, 999);
      q = q.lte("created_at", end.toISOString());
    }

    const { data: rows, error } = await q;
    if (error) throw new Error(error.message);
    return (rows ?? []) as any as RhAuditEntry[];
  });

export const setRhUserBlocked = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) =>
    z.object({ targetUserId: z.string().uuid(), blocked: z.boolean() }).parse(data),
  )
  .handler(async ({ context, data }): Promise<{ ok: true }> => {
    const { supabase, userId, claims } = context;
    await assertAdmin(supabase, userId);
    if (data.targetUserId === userId) throw new Error("Você não pode bloquear o próprio usuário.");

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    if (data.blocked) {
      await assertNotLastAdmin(supabaseAdmin, data.targetUserId, "bloquear este administrador");
    }
    const { error } = await supabaseAdmin.auth.admin.updateUserById(data.targetUserId, {
      ban_duration: data.blocked ? "876000h" : "none",
    } as any);
    if (error) throw new Error(error.message);

    await logAudit(supabaseAdmin, {
      actorId: userId,
      actorEmail: (claims as any)?.email ?? null,
      targetUserId: data.targetUserId,
      action: data.blocked ? "bloqueou_usuario" : "desbloqueou_usuario",
    });
    return { ok: true };
  });

export const generateRhRecoveryLink = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => z.object({ email: z.string().trim().email() }).parse(data))
  .handler(async ({ context, data }): Promise<{ link: string }> => {
    const { supabase, userId, claims } = context;
    await assertAdmin(supabase, userId);

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: link, error } = await supabaseAdmin.auth.admin.generateLink({
      type: "recovery",
      email: data.email,
    });
    if (error) throw new Error(error.message);

    await logAudit(supabaseAdmin, {
      actorId: userId,
      actorEmail: (claims as any)?.email ?? null,
      targetEmail: data.email,
      action: "gerou_link_de_redefinicao",
    });

    return { link: (link as any)?.properties?.action_link ?? "" };
  });

export const bulkSetRhAccess = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) =>
    z
      .object({
        userIds: z.array(z.string().uuid()).min(1).max(500),
        tabs: z.array(z.string().min(1).max(120)).max(100),
        mode: z.enum(["replace", "add", "remove"]),
      })
      .parse(data),
  )
  .handler(async ({ context, data }): Promise<{ ok: true; affected: number }> => {
    const { supabase, userId, claims } = context;
    await assertAccessManager(supabase, userId);

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    // Snapshot anterior (por usuário) para permitir reverter pelo histórico.
    const { data: beforeRows } = await supabaseAdmin
      .from("rh_tab_access")
      .select("user_id, tab_key")
      .in("user_id", data.userIds);
    const beforeMap: Record<string, string[]> = {};
    for (const uid of data.userIds) beforeMap[uid] = [];
    for (const r of (beforeRows ?? []) as any[]) {
      (beforeMap[r.user_id as string] ??= []).push(r.tab_key as string);
    }

    if (data.mode === "replace") {
      const { error: delErr } = await supabaseAdmin
        .from("rh_tab_access")
        .delete()
        .in("user_id", data.userIds);
      if (delErr) throw new Error(delErr.message);
    } else if (data.mode === "remove") {
      if (data.tabs.length) {
        const { error: delErr } = await supabaseAdmin
          .from("rh_tab_access")
          .delete()
          .in("user_id", data.userIds)
          .in("tab_key", data.tabs);
        if (delErr) throw new Error(delErr.message);
      }
    }

    if (data.mode !== "remove" && data.tabs.length) {
      const rows: { user_id: string; tab_key: string }[] = [];
      for (const uid of data.userIds) {
        for (const tab_key of data.tabs) rows.push({ user_id: uid, tab_key });
      }
      const { error: insErr } = await supabaseAdmin
        .from("rh_tab_access")
        .upsert(rows as any, { onConflict: "user_id,tab_key", ignoreDuplicates: true });
      if (insErr) throw new Error(insErr.message);
    }

    const rowsNotif = data.userIds.map((uid) => ({
      user_id: uid,
      title: "Seus acessos ao RH foram atualizados",
      body: "Um administrador ajustou as abas liberadas para você.",
    }));
    await supabaseAdmin.from("rh_notifications").insert(rowsNotif as any);

    await logAudit(supabaseAdmin, {
      actorId: userId,
      actorEmail: (claims as any)?.email ?? null,
      action: "acessos_em_massa",
      detail: {
        mode: data.mode,
        tabs: data.tabs,
        usuarios: data.userIds.length,
        before: beforeMap,
      },
    });

    return { ok: true, affected: data.userIds.length };
  });

export const copyRhAccess = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) =>
    z
      .object({
        fromUserId: z.string().uuid(),
        toUserIds: z.array(z.string().uuid()).min(1).max(500),
      })
      .parse(data),
  )
  .handler(async ({ context, data }): Promise<{ ok: true; tabs: number }> => {
    const { supabase, userId, claims } = context;
    await assertAccessManager(supabase, userId);

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: src, error } = await supabaseAdmin
      .from("rh_tab_access")
      .select("tab_key")
      .eq("user_id", data.fromUserId);
    if (error) throw new Error(error.message);

    const tabs = ((src ?? []) as any[]).map((r) => r.tab_key as string);

    const { error: delErr } = await supabaseAdmin
      .from("rh_tab_access")
      .delete()
      .in("user_id", data.toUserIds);
    if (delErr) throw new Error(delErr.message);

    if (tabs.length) {
      const rows: { user_id: string; tab_key: string }[] = [];
      for (const uid of data.toUserIds) for (const tab_key of tabs) rows.push({ user_id: uid, tab_key });
      const { error: insErr } = await supabaseAdmin.from("rh_tab_access").insert(rows as any);
      if (insErr) throw new Error(insErr.message);
    }

    await logAudit(supabaseAdmin, {
      actorId: userId,
      actorEmail: (claims as any)?.email ?? null,
      action: "copiou_acessos",
      detail: { de: data.fromUserId, para: data.toUserIds.length, tabs: tabs.length },
    });

    return { ok: true, tabs: tabs.length };
  });

export type ConsultoraSyncStatus = {
  usuariosSemConsultora: { id: string; email: string }[];
  consultorasSemUsuario: { id: string; nome: string; email: string | null; ativo: boolean }[];
  totalConsultoras: number;
  consultorasAtivas: number;
};

export const getConsultoraSyncStatus = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<ConsultoraSyncStatus> => {
    const { supabase, userId } = context;
    await assertAdmin(supabase, userId);

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: usersData, error: usersErr } = await supabaseAdmin.auth.admin.listUsers({
      page: 1,
      perPage: 1000,
    });
    if (usersErr) throw new Error(usersErr.message);

    const { data: consultoras, error } = await supabaseAdmin
      .from("radar_consultoras")
      .select("id, nome, email, ativo");
    if (error) throw new Error(error.message);

    const list = (consultoras ?? []) as any[];
    const emailsConsultoras = new Set(
      list.map((c) => (c.email ? String(c.email).toLowerCase() : "")).filter(Boolean),
    );
    const emailsUsuarios = new Set(
      usersData.users.map((u) => (u.email ? u.email.toLowerCase() : "")).filter(Boolean),
    );

    return {
      usuariosSemConsultora: usersData.users
        .filter((u) => u.email && !emailsConsultoras.has(u.email.toLowerCase()))
        .map((u) => ({ id: u.id, email: u.email! })),
      consultorasSemUsuario: list
        .filter((c) => !c.email || !emailsUsuarios.has(String(c.email).toLowerCase()))
        .map((c) => ({ id: c.id, nome: c.nome, email: c.email ?? null, ativo: !!c.ativo })),
      totalConsultoras: list.length,
      consultorasAtivas: list.filter((c) => c.ativo).length,
    };
  });

export const syncConsultoraFromUsers = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) =>
    z
      .object({ emails: z.array(z.string().trim().email()).min(1).max(500) })
      .parse(data),
  )
  .handler(async ({ context, data }): Promise<{ criadas: number; ativadas: number }> => {
    const { supabase, userId, claims } = context;
    await assertAdmin(supabase, userId);

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    let criadas = 0;
    let ativadas = 0;

    for (const email of data.emails) {
      const lower = email.toLowerCase();
      const { data: existing } = await supabaseAdmin
        .from("radar_consultoras")
        .select("id, ativo")
        .ilike("email", lower)
        .maybeSingle();

      if (existing) {
        if (!(existing as any).ativo) {
          await supabaseAdmin
            .from("radar_consultoras")
            .update({ ativo: true } as any)
            .eq("id", (existing as any).id);
          ativadas++;
        }
        continue;
      }

      const nome = lower
        .split("@")[0]!
        .replace(/[._-]+/g, " ")
        .replace(/\b\w/g, (c) => c.toUpperCase());

      const { error } = await supabaseAdmin
        .from("radar_consultoras")
        .insert({ nome, email: lower, ativo: true } as any);
      if (!error) criadas++;
    }

    await logAudit(supabaseAdmin, {
      actorId: userId,
      actorEmail: (claims as any)?.email ?? null,
      action: "sincronizou_consultoras",
      detail: { criadas, ativadas },
    });

    return { criadas, ativadas };
  });
