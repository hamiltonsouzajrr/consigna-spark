-- Contas de WhatsApp Cloud API (multi-conta)
CREATE TABLE public.wa_accounts (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name text NOT NULL,
  phone_number_id text NOT NULL UNIQUE,
  business_account_id text,
  display_phone text,
  access_token text NOT NULL,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.wa_accounts TO authenticated;
GRANT ALL ON public.wa_accounts TO service_role;
ALTER TABLE public.wa_accounts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated manage wa_accounts" ON public.wa_accounts
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Contatos (pessoas que conversam com cada conta)
CREATE TABLE public.wa_contacts (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  account_id uuid NOT NULL REFERENCES public.wa_accounts(id) ON DELETE CASCADE,
  wa_id text NOT NULL,
  name text,
  last_message_at timestamptz,
  unread_count integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (account_id, wa_id)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.wa_contacts TO authenticated;
GRANT ALL ON public.wa_contacts TO service_role;
ALTER TABLE public.wa_contacts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated manage wa_contacts" ON public.wa_contacts
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Mensagens
CREATE TABLE public.wa_messages (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  account_id uuid NOT NULL REFERENCES public.wa_accounts(id) ON DELETE CASCADE,
  contact_id uuid NOT NULL REFERENCES public.wa_contacts(id) ON DELETE CASCADE,
  direction text NOT NULL CHECK (direction IN ('in','out')),
  body text,
  wa_message_id text,
  sender_name text,
  status text NOT NULL DEFAULT 'sent',
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.wa_messages TO authenticated;
GRANT ALL ON public.wa_messages TO service_role;
ALTER TABLE public.wa_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated manage wa_messages" ON public.wa_messages
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE INDEX idx_wa_contacts_account ON public.wa_contacts(account_id, last_message_at DESC);
CREATE INDEX idx_wa_messages_contact ON public.wa_messages(contact_id, created_at);

-- trigger updated_at
CREATE TRIGGER trg_wa_accounts_updated BEFORE UPDATE ON public.wa_accounts
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER trg_wa_contacts_updated BEFORE UPDATE ON public.wa_contacts
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();