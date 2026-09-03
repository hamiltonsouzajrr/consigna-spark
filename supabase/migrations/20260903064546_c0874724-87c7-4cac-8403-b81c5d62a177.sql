ALTER TABLE public.diario_busca_fila
  ADD COLUMN IF NOT EXISTS claimed_at timestamptz,
  ADD COLUMN IF NOT EXISTS tentativas integer NOT NULL DEFAULT 0;

CREATE OR REPLACE FUNCTION public.claim_diario_fila_item(_job_id uuid)
 RETURNS diario_busca_fila
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  item public.diario_busca_fila;
BEGIN
  -- Reservas antigas (mais de 15 min sem concluir) voltam para a fila.
  UPDATE public.diario_busca_fila
     SET status = CASE WHEN tentativas >= 3 THEN 'erro' ELSE 'pendente' END,
         erro_msg = CASE WHEN tentativas >= 3
                         THEN COALESCE(erro_msg, 'Falhou após 3 tentativas (reserva expirada).')
                         ELSE erro_msg END,
         updated_at = now()
   WHERE job_id = _job_id
     AND status = 'processando'
     AND COALESCE(claimed_at, updated_at) < now() - interval '15 minutes';

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
    SET status = 'processando',
        claimed_at = now(),
        tentativas = tentativas + 1,
        updated_at = now()
    WHERE id = item.id;

  item.status := 'processando';
  RETURN item;
END;
$function$;

CREATE OR REPLACE FUNCTION public.recuperar_diario_fila()
 RETURNS TABLE(liberados integer, falhados integer, jobs_fechados integer)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_lib integer := 0;
  v_fail integer := 0;
  v_jobs integer := 0;
BEGIN
  WITH f AS (
    UPDATE public.diario_busca_fila
       SET status = 'erro',
           erro_msg = COALESCE(erro_msg, 'Falhou após 3 tentativas (reserva expirada).'),
           updated_at = now()
     WHERE status = 'processando'
       AND tentativas >= 3
       AND COALESCE(claimed_at, updated_at) < now() - interval '15 minutes'
     RETURNING 1
  ) SELECT count(*) INTO v_fail FROM f;

  WITH l AS (
    UPDATE public.diario_busca_fila
       SET status = 'pendente', updated_at = now()
     WHERE status = 'processando'
       AND COALESCE(claimed_at, updated_at) < now() - interval '15 minutes'
     RETURNING 1
  ) SELECT count(*) INTO v_lib FROM l;

  WITH j AS (
    UPDATE public.diario_busca_jobs jb
       SET status = 'done',
           finished_at = COALESCE(jb.finished_at, now()),
           current_label = NULL,
           updated_at = now()
     WHERE jb.status = 'running'
       AND (
         NOT EXISTS (
           SELECT 1 FROM public.diario_busca_fila fi
            WHERE fi.job_id = jb.id AND fi.status IN ('pendente','processando')
         )
         OR jb.updated_at < now() - interval '24 hours'
       )
     RETURNING 1
  ) SELECT count(*) INTO v_jobs FROM j;

  RETURN QUERY SELECT v_lib, v_fail, v_jobs;
END;
$function$;

REVOKE ALL ON FUNCTION public.recuperar_diario_fila() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.recuperar_diario_fila() TO service_role;

ALTER TABLE public.do_registros
  ADD COLUMN IF NOT EXISTS liberado_em timestamptz,
  ADD COLUMN IF NOT EXISTS liberado_por uuid;

UPDATE public.do_registros
   SET liberado_em = COALESCE(atribuido_em, created_at)
 WHERE liberado_em IS NULL;

CREATE INDEX IF NOT EXISTS do_registros_liberado_idx ON public.do_registros (liberado_em);

DROP POLICY IF EXISTS "do_registros select own consultora" ON public.do_registros;
CREATE POLICY "do_registros select own consultora" ON public.do_registros
  FOR SELECT TO authenticated
  USING (
    liberado_em IS NOT NULL
    AND consultora_responsavel IS NOT NULL
    AND consultora_responsavel = minha_consultora_nome()
  );

DROP POLICY IF EXISTS "do_registros update own consultora" ON public.do_registros;
CREATE POLICY "do_registros update own consultora" ON public.do_registros
  FOR UPDATE TO authenticated
  USING (
    liberado_em IS NOT NULL
    AND consultora_responsavel IS NOT NULL
    AND consultora_responsavel = minha_consultora_nome()
  )
  WITH CHECK (
    liberado_em IS NOT NULL
    AND consultora_responsavel IS NOT NULL
    AND consultora_responsavel = minha_consultora_nome()
  );