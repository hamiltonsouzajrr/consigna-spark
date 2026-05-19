CREATE TABLE public.safeconsig_leads (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  cpf text NOT NULL UNIQUE,
  status text NOT NULL,
  mensagem text,
  consultado_em timestamptz NOT NULL DEFAULT now(),
  consultado_por uuid
);

CREATE INDEX idx_safeconsig_leads_consultado_em ON public.safeconsig_leads (consultado_em DESC);
CREATE INDEX idx_safeconsig_leads_cpf ON public.safeconsig_leads (cpf);

ALTER TABLE public.safeconsig_leads ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can view leads"
ON public.safeconsig_leads FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "Authenticated can insert leads"
ON public.safeconsig_leads FOR INSERT
TO authenticated
WITH CHECK (true);

CREATE POLICY "Authenticated can update leads"
ON public.safeconsig_leads FOR UPDATE
TO authenticated
USING (true);
