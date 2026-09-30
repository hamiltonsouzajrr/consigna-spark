ALTER TABLE public.quitacao_clientes
  ADD COLUMN IF NOT EXISTS matricula text,
  ADD COLUMN IF NOT EXISTS perfil text,
  ADD COLUMN IF NOT EXISTS ritmo text,
  ADD COLUMN IF NOT EXISTS competencia text,
  ADD COLUMN IF NOT EXISTS banco_previsto text,
  ADD COLUMN IF NOT EXISTS credito_previsto numeric,
  ADD COLUMN IF NOT EXISTS troco_previsto numeric,
  ADD COLUMN IF NOT EXISTS contratos jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS formato text NOT NULL DEFAULT 'calculados';
CREATE INDEX IF NOT EXISTS quitacao_clientes_matricula_idx ON public.quitacao_clientes (matricula);