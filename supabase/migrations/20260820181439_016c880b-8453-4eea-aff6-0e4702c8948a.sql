ALTER TABLE public.lead_batches ADD COLUMN IF NOT EXISTS column_mapping JSONB;
GRANT ALL ON public.lead_batches TO authenticated;
GRANT ALL ON public.lead_batches TO service_role;
