ALTER TABLE public.radar_consultoras
  ADD COLUMN IF NOT EXISTS token uuid NOT NULL DEFAULT gen_random_uuid();

UPDATE public.radar_consultoras SET token = gen_random_uuid() WHERE token IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS radar_consultoras_token_idx ON public.radar_consultoras (token);