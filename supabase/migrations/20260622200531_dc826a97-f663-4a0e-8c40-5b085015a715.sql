ALTER TABLE public.radar_consultoras ADD COLUMN IF NOT EXISTS email text;
CREATE INDEX IF NOT EXISTS idx_radar_consultoras_email ON public.radar_consultoras (lower(email));