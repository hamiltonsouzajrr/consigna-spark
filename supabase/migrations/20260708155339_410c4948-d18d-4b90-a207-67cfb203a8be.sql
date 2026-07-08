
-- 1) Novos campos em do_registros
ALTER TABLE public.do_registros
  ADD COLUMN IF NOT EXISTS nome_completo text,
  ADD COLUMN IF NOT EXISTS nome_parcial text,
  ADD COLUMN IF NOT EXISTS cargo_atual text,
  ADD COLUMN IF NOT EXISTS cargo_promovido text,
  ADD COLUMN IF NOT EXISTS cargo_anterior text,
  ADD COLUMN IF NOT EXISTS cargo_novo text,
  ADD COLUMN IF NOT EXISTS data_promocao date,
  ADD COLUMN IF NOT EXISTS orgao_lotacao text;

-- 2) Tabela de jobs de busca
CREATE TABLE IF NOT EXISTS public.diario_busca_jobs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  status text NOT NULL DEFAULT 'queued',
  periodo text,
  periodo_label text,
  date_from date,
  date_to date,
  total integer NOT NULL DEFAULT 0,
  processed integer NOT NULL DEFAULT 0,
  baixados integer NOT NULL DEFAULT 0,
  registros integer NOT NULL DEFAULT 0,
  erros integer NOT NULL DEFAULT 0,
  current_label text,
  erro_msg text,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.diario_busca_jobs TO authenticated;
GRANT ALL ON public.diario_busca_jobs TO service_role;
ALTER TABLE public.diario_busca_jobs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins podem ver jobs de busca"
  ON public.diario_busca_jobs FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER set_diario_busca_jobs_updated_at
  BEFORE UPDATE ON public.diario_busca_jobs
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- 3) Tabela de fila de edições
CREATE TABLE IF NOT EXISTS public.diario_busca_fila (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id uuid NOT NULL REFERENCES public.diario_busca_jobs(id) ON DELETE CASCADE,
  ordem integer NOT NULL DEFAULT 0,
  edicao jsonb NOT NULL,
  status text NOT NULL DEFAULT 'pendente',
  registros integer NOT NULL DEFAULT 0,
  erro_msg text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_diario_busca_fila_job ON public.diario_busca_fila(job_id);
CREATE INDEX IF NOT EXISTS idx_diario_busca_fila_status ON public.diario_busca_fila(status);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.diario_busca_fila TO authenticated;
GRANT ALL ON public.diario_busca_fila TO service_role;
ALTER TABLE public.diario_busca_fila ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins podem ver fila de busca"
  ON public.diario_busca_fila FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER set_diario_busca_fila_updated_at
  BEFORE UPDATE ON public.diario_busca_fila
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- 4) Função para reservar a próxima edição pendente (seguro para concorrência)
CREATE OR REPLACE FUNCTION public.claim_diario_fila_item(_job_id uuid)
RETURNS public.diario_busca_fila
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  item public.diario_busca_fila;
BEGIN
  SELECT * INTO item
  FROM public.diario_busca_fila
  WHERE job_id = _job_id AND status = 'pendente'
  ORDER BY ordem ASC
  FOR UPDATE SKIP LOCKED
  LIMIT 1;

  IF item.id IS NULL THEN
    RETURN NULL;
  END IF;

  UPDATE public.diario_busca_fila
    SET status = 'processando', updated_at = now()
    WHERE id = item.id;

  item.status := 'processando';
  RETURN item;
END;
$$;
