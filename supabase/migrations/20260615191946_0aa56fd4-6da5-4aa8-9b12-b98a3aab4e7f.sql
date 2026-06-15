ALTER TABLE public.prospect_leads ADD COLUMN IF NOT EXISTS opened_at timestamptz;
CREATE INDEX IF NOT EXISTS idx_prospect_leads_opened_at ON public.prospect_leads (opened_at);