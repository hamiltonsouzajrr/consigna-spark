ALTER TABLE public.quitacao_clientes
  ADD COLUMN IF NOT EXISTS retorno_em timestamptz;

CREATE INDEX IF NOT EXISTS idx_quitacao_clientes_retorno
  ON public.quitacao_clientes (consultant_id, retorno_em)
  WHERE removido_em IS NULL;

ALTER TABLE public.quitacao_contatos
  ADD COLUMN IF NOT EXISTS retorno_em timestamptz;