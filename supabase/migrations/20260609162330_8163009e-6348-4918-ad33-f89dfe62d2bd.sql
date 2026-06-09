ALTER TABLE public.prospect_leads ADD COLUMN IF NOT EXISTS import_batch text;
CREATE INDEX IF NOT EXISTS idx_prospect_leads_import_batch ON public.prospect_leads (import_batch);