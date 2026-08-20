ALTER TABLE public.prospect_leads ADD COLUMN IF NOT EXISTS raw_data JSONB;
GRANT ALL ON public.prospect_leads TO authenticated;
GRANT ALL ON public.prospect_leads TO service_role;
