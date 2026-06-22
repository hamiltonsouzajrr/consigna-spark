ALTER TABLE public.do_registros
  ADD COLUMN IF NOT EXISTS status_abordagem text NOT NULL DEFAULT 'novo'
    CHECK (status_abordagem IN ('novo','contatado','proposta_enviada','convertido','sem_interesse')),
  ADD COLUMN IF NOT EXISTS contatado_em timestamptz,
  ADD COLUMN IF NOT EXISTS contatado_por uuid;