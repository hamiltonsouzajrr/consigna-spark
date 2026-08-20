ALTER TABLE public.leads_raw ADD COLUMN IF NOT EXISTS consultant_id UUID REFERENCES auth.users(id);
ALTER TABLE public.leads_raw ADD COLUMN IF NOT EXISTS opened_at TIMESTAMP WITH TIME ZONE;
ALTER TABLE public.leads_raw ADD COLUMN IF NOT EXISTS last_contact_at TIMESTAMP WITH TIME ZONE;
GRANT ALL ON public.leads_raw TO authenticated;
GRANT ALL ON public.leads_raw TO service_role;
