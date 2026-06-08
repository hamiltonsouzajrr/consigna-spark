// Public webhook endpoint for WhatsApp Cloud API (Meta).
// - GET: verification handshake (hub.challenge) using WHATSAPP_VERIFY_TOKEN.
// - POST: receives inbound messages, routes by phone_number_id to the matching account,
//   upserts the contact and stores the incoming message.
import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/public/whatsapp/webhook")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const url = new URL(request.url);
        const mode = url.searchParams.get("hub.mode");
        const token = url.searchParams.get("hub.verify_token");
        const challenge = url.searchParams.get("hub.challenge");
        const verifyToken = process.env.WHATSAPP_VERIFY_TOKEN;

        if (mode === "subscribe" && verifyToken && token === verifyToken) {
          return new Response(challenge ?? "", { status: 200 });
        }
        return new Response("Forbidden", { status: 403 });
      },

      POST: async ({ request }) => {
        let payload: any;
        try {
          payload = await request.json();
        } catch {
          return new Response("Bad request", { status: 400 });
        }

        try {
          const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

          const entries = Array.isArray(payload?.entry) ? payload.entry : [];
          for (const entry of entries) {
            const changes = Array.isArray(entry?.changes) ? entry.changes : [];
            for (const change of changes) {
              const value = change?.value;
              const phoneNumberId = value?.metadata?.phone_number_id;
              if (!phoneNumberId) continue;

              const { data: account } = await supabaseAdmin
                .from("wa_accounts")
                .select("id")
                .eq("phone_number_id", phoneNumberId)
                .maybeSingle();
              if (!account) continue;

              const contactsMeta: Record<string, string> = {};
              for (const c of value?.contacts ?? []) {
                if (c?.wa_id) contactsMeta[c.wa_id] = c?.profile?.name ?? "";
              }

              const messages = Array.isArray(value?.messages) ? value.messages : [];
              for (const m of messages) {
                const waId = m?.from;
                if (!waId) continue;

                const text =
                  m?.text?.body ??
                  m?.button?.text ??
                  m?.interactive?.list_reply?.title ??
                  m?.interactive?.button_reply?.title ??
                  `[${m?.type ?? "mensagem"}]`;

                // upsert contact
                let contactId: string | null = null;
                const { data: existing } = await supabaseAdmin
                  .from("wa_contacts")
                  .select("id, unread_count")
                  .eq("account_id", account.id)
                  .eq("wa_id", waId)
                  .maybeSingle();

                const nowIso = new Date().toISOString();
                if (existing) {
                  contactId = existing.id;
                  await supabaseAdmin
                    .from("wa_contacts")
                    .update({
                      last_message_at: nowIso,
                      unread_count: (existing.unread_count ?? 0) + 1,
                      ...(contactsMeta[waId] ? { name: contactsMeta[waId] } : {}),
                    })
                    .eq("id", existing.id);
                } else {
                  const { data: inserted } = await supabaseAdmin
                    .from("wa_contacts")
                    .insert({
                      account_id: account.id,
                      wa_id: waId,
                      name: contactsMeta[waId] || null,
                      last_message_at: nowIso,
                      unread_count: 1,
                    })
                    .select("id")
                    .single();
                  contactId = inserted?.id ?? null;
                }

                if (!contactId) continue;

                await supabaseAdmin.from("wa_messages").insert({
                  account_id: account.id,
                  contact_id: contactId,
                  direction: "in",
                  body: text,
                  wa_message_id: m?.id ?? null,
                  status: "received",
                });
              }
            }
          }
        } catch (e) {
          // Always 200 so Meta doesn't retry-storm; errors are logged server-side.
          console.error("[whatsapp.webhook] error", e);
        }

        return new Response("EVENT_RECEIVED", { status: 200 });
      },
    },
  },
});
