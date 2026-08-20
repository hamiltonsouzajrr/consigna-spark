ALTER TABLE public.prospect_leads ADD COLUMN IF NOT EXISTS batch_id UUID REFERENCES public.lead_batches(id);
GRANT ALL ON public.prospect_leads TO authenticated;
GRANT ALL ON public.prospect_leads TO service_role;
