// Server functions for the WhatsApp Cloud API module.
// - listWaAccounts / addWaAccount / updateWaAccount / deleteWaAccount: manage multiple official accounts.
// - listConversations: contacts per account with last message + unread.
// - listMessages: full thread for a contact.
// - sendWaMessage: sends a text message via the Cloud API and stores it, signed with the logged-in user's name.
// - markConversationRead: resets unread counter.

import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const GRAPH_VERSION = "v21.0";

async function resolveSenderName(supabase: any, userId: string, claims: any): Promise<string> {
  const { data } = await supabase
    .from("rh_employees")
    .select("name")
    .eq("user_id", userId)
    .maybeSingle();
  if (data?.name) return data.name as string;
  return (claims?.email as string) ?? "Atendente";
}

export const listWaAccounts = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase } = context;
    const { data, error } = await supabase
      .from("wa_accounts")
      .select("id, name, phone_number_id, business_account_id, display_phone, active, created_at")
      .order("created_at", { ascending: true });
    if (error) throw new Error(error.message);
    return data ?? [];
  });

export const addWaAccount = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        name: z.string().trim().min(1).max(120),
        phone_number_id: z.string().trim().min(3).max(64),
        business_account_id: z.string().trim().max(64).optional().or(z.literal("")),
        display_phone: z.string().trim().max(40).optional().or(z.literal("")),
        access_token: z.string().trim().min(10).max(1000),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const { data: inserted, error } = await supabase
      .from("wa_accounts")
      .insert({
        name: data.name,
        phone_number_id: data.phone_number_id,
        business_account_id: data.business_account_id || null,
        display_phone: data.display_phone || null,
        access_token: data.access_token,
      })
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    return { ok: true, id: inserted?.id as string };
  });

// Validates the account credentials against the Graph API and configures the
// webhook automatically by subscribing the app to the WhatsApp Business Account.
export const verifyWaAccount = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const { data: account, error } = await supabase
      .from("wa_accounts")
      .select("id, phone_number_id, business_account_id, access_token")
      .eq("id", data.id)
      .single();
    if (error || !account) throw new Error("Conta não encontrada.");

    const result: {
      tokenValid: boolean;
      displayPhone: string | null;
      verifiedName: string | null;
      webhookConfigured: boolean;
      warnings: string[];
    } = {
      tokenValid: false,
      displayPhone: null,
      verifiedName: null,
      webhookConfigured: false,
      warnings: [],
    };

    // 1) Validate token + Phone Number ID by reading the phone number info.
    const infoRes = await fetch(
      `https://graph.facebook.com/${GRAPH_VERSION}/${account.phone_number_id}?fields=display_phone_number,verified_name`,
      { headers: { Authorization: `Bearer ${account.access_token}` } },
    );
    const info: any = await infoRes.json().catch(() => ({}));
    if (!infoRes.ok) {
      throw new Error(
        info?.error?.message ?? "Token inválido ou Phone Number ID incorreto.",
      );
    }
    result.tokenValid = true;
    result.displayPhone = info?.display_phone_number ?? null;
    result.verifiedName = info?.verified_name ?? null;

    // 2) Configure webhook: subscribe the app to the WhatsApp Business Account.
    if (account.business_account_id) {
      const subRes = await fetch(
        `https://graph.facebook.com/${GRAPH_VERSION}/${account.business_account_id}/subscribed_apps`,
        { method: "POST", headers: { Authorization: `Bearer ${account.access_token}` } },
      );
      const sub: any = await subRes.json().catch(() => ({}));
      if (subRes.ok && sub?.success) {
        result.webhookConfigured = true;
      } else {
        result.warnings.push(
          sub?.error?.message ??
            "Não foi possível assinar o app ao WABA automaticamente. Verifique as permissões do token (whatsapp_business_management).",
        );
      }
    } else {
      result.warnings.push(
        "Informe o Business Account ID para configurar o webhook automaticamente.",
      );
    }

    // Persist any info we discovered.
    const patch: { display_phone?: string } = {};
    if (result.displayPhone) patch.display_phone = result.displayPhone;
    if (Object.keys(patch).length > 0) {
      await supabase.from("wa_accounts").update(patch).eq("id", account.id);
    }

    return result;
  });


export const updateWaAccount = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        id: z.string().uuid(),
        name: z.string().trim().min(1).max(120).optional(),
        display_phone: z.string().trim().max(40).optional(),
        active: z.boolean().optional(),
        access_token: z.string().trim().min(10).max(1000).optional(),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const patch: {
      name?: string;
      display_phone?: string;
      active?: boolean;
      access_token?: string;
    } = {};
    if (data.name !== undefined) patch.name = data.name;
    if (data.display_phone !== undefined) patch.display_phone = data.display_phone;
    if (data.active !== undefined) patch.active = data.active;
    if (data.access_token !== undefined) patch.access_token = data.access_token;
    const { error } = await supabase.from("wa_accounts").update(patch).eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const deleteWaAccount = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const { error } = await supabase.from("wa_accounts").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const listConversations = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ accountId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const { data: rows, error } = await supabase
      .from("wa_contacts")
      .select("id, wa_id, name, last_message_at, unread_count")
      .eq("account_id", data.accountId)
      .order("last_message_at", { ascending: false, nullsFirst: false });
    if (error) throw new Error(error.message);
    return rows ?? [];
  });

export const listMessages = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ contactId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const { data: rows, error } = await supabase
      .from("wa_messages")
      .select("id, direction, body, sender_name, status, created_at")
      .eq("contact_id", data.contactId)
      .order("created_at", { ascending: true });
    if (error) throw new Error(error.message);
    return rows ?? [];
  });

export const markConversationRead = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ contactId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    await supabase.from("wa_contacts").update({ unread_count: 0 }).eq("id", data.contactId);
    return { ok: true };
  });

export const sendWaMessage = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        contactId: z.string().uuid(),
        text: z.string().trim().min(1).max(4096),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId, claims } = context;

    const { data: contact, error: cErr } = await supabase
      .from("wa_contacts")
      .select("id, wa_id, account_id")
      .eq("id", data.contactId)
      .single();
    if (cErr || !contact) throw new Error("Contato não encontrado.");

    const { data: account, error: aErr } = await supabase
      .from("wa_accounts")
      .select("id, phone_number_id, access_token, active")
      .eq("id", contact.account_id)
      .single();
    if (aErr || !account) throw new Error("Conta não encontrada.");
    if (!account.active) throw new Error("Esta conta está inativa.");

    const senderName = await resolveSenderName(supabase, userId, claims);

    const res = await fetch(
      `https://graph.facebook.com/${GRAPH_VERSION}/${account.phone_number_id}/messages`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${account.access_token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          messaging_product: "whatsapp",
          to: contact.wa_id,
          type: "text",
          text: { body: data.text },
        }),
      },
    );

    const json: any = await res.json().catch(() => ({}));
    if (!res.ok) {
      const msg = json?.error?.message ?? `Falha ao enviar (HTTP ${res.status}).`;
      throw new Error(msg);
    }

    const waMessageId = json?.messages?.[0]?.id ?? null;

    const { error: mErr } = await supabase.from("wa_messages").insert({
      account_id: account.id,
      contact_id: contact.id,
      direction: "out",
      body: data.text,
      wa_message_id: waMessageId,
      sender_name: senderName,
      status: "sent",
    });
    if (mErr) throw new Error(mErr.message);

    await supabase
      .from("wa_contacts")
      .update({ last_message_at: new Date().toISOString() })
      .eq("id", contact.id);

    return { ok: true, senderName };
  });
