ALTER TABLE public.quitacao_clientes
  ADD COLUMN IF NOT EXISTS produto text NOT NULL DEFAULT 'geral',
  ADD COLUMN IF NOT EXISTS etapa text NOT NULL DEFAULT 'novo',
  ADD COLUMN IF NOT EXISTS prioridade int,
  ADD COLUMN IF NOT EXISTS apto_roteiro boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS troco_simulado numeric,
  ADD COLUMN IF NOT EXISTS taxa_simulada text,
  ADD COLUMN IF NOT EXISTS liberacao_prevista timestamptz,
  ADD COLUMN IF NOT EXISTS checklist jsonb NOT NULL DEFAULT '{}'::jsonb;
ALTER TABLE public.quitacao_lotes ADD COLUMN IF NOT EXISTS produto text NOT NULL DEFAULT 'geral';
ALTER TABLE public.quitacao_contatos ADD COLUMN IF NOT EXISTS etapa text;
DO $$ DECLARE r record; BEGIN
  FOR r IN SELECT conname FROM pg_constraint WHERE conrelid='public.quitacao_clientes'::regclass AND contype='u' LOOP
    EXECUTE format('ALTER TABLE public.quitacao_clientes DROP CONSTRAINT %I', r.conname); END LOOP;
  FOR r IN SELECT indexname FROM pg_indexes WHERE schemaname='public' AND tablename='quitacao_clientes' AND indexdef ILIKE '%UNIQUE%' AND indexname NOT LIKE '%pkey' LOOP
    EXECUTE format('DROP INDEX public.%I', r.indexname); END LOOP;
END $$;
CREATE UNIQUE INDEX quitacao_clientes_prod_cpf_ordem_uk ON public.quitacao_clientes(produto, cpf, cod_ordem);
CREATE INDEX IF NOT EXISTS quitacao_clientes_prod_cons_prio ON public.quitacao_clientes(produto, consultant_id, prioridade DESC) WHERE removido_em IS NULL;