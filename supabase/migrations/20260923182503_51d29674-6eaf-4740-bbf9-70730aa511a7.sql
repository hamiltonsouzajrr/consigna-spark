ALTER TABLE public.rockdata_consultas ADD COLUMN IF NOT EXISTS telefones text[] NOT NULL DEFAULT '{}';

UPDATE public.rockdata_consultas
SET telefones = COALESCE((
  SELECT array_agg(DISTINCT regexp_replace(t, '\D', '', 'g'))
  FROM jsonb_array_elements_text(COALESCE(resultado->'telefones', '[]'::jsonb)) AS t
  WHERE length(regexp_replace(t, '\D', '', 'g')) >= 8
), '{}')
WHERE telefones = '{}';

CREATE INDEX IF NOT EXISTS rockdata_consultas_telefones_gin ON public.rockdata_consultas USING gin (telefones);