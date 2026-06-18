ALTER TABLE public.prospect_leads
  ADD COLUMN IF NOT EXISTS idade integer,
  ADD COLUMN IF NOT EXISTS sexo text;