ALTER TABLE public.prospect_conversoes
  ADD COLUMN IF NOT EXISTS origem text NOT NULL DEFAULT 'crm',
  ADD COLUMN IF NOT EXISTS tomador_id uuid REFERENCES public.tomadores_al(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS tipo_margem text,
  ADD COLUMN IF NOT EXISTS margem_usada numeric;

ALTER TABLE public.prospect_conversoes
  DROP CONSTRAINT IF EXISTS prospect_conversoes_origem_check,
  ADD CONSTRAINT prospect_conversoes_origem_check CHECK (origem IN ('crm', 'tomadores_al')),
  DROP CONSTRAINT IF EXISTS prospect_conversoes_tipo_margem_check,
  ADD CONSTRAINT prospect_conversoes_tipo_margem_check CHECK (tipo_margem IS NULL OR tipo_margem IN ('emprestimo', 'cartao_credito', 'cartao_beneficio')),
  DROP CONSTRAINT IF EXISTS prospect_conversoes_margem_usada_check,
  ADD CONSTRAINT prospect_conversoes_margem_usada_check CHECK (margem_usada IS NULL OR margem_usada >= 0);

CREATE INDEX IF NOT EXISTS idx_prospect_conversoes_tomador_id ON public.prospect_conversoes(tomador_id) WHERE tomador_id IS NOT NULL;

ALTER TABLE public.tomadores_al
  ADD COLUMN IF NOT EXISTS telefones text[] NOT NULL DEFAULT ARRAY[]::text[];

GRANT SELECT, INSERT, UPDATE, DELETE ON public.prospect_conversoes TO authenticated;
GRANT ALL ON public.prospect_conversoes TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.tomadores_al TO authenticated;
GRANT ALL ON public.tomadores_al TO service_role;