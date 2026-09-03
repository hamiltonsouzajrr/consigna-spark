CREATE TABLE IF NOT EXISTS public.do_registros_atendimentos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  registro_id uuid NOT NULL REFERENCES public.do_registros(id) ON DELETE CASCADE,
  consultora_nome text NOT NULL,
  status_final text,
  atendido_em timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS do_registros_atendimentos_reg_idx
  ON public.do_registros_atendimentos (registro_id);
CREATE INDEX IF NOT EXISTS do_registros_atendimentos_nome_idx
  ON public.do_registros_atendimentos (lower(btrim(consultora_nome)), atendido_em DESC);

GRANT SELECT ON public.do_registros_atendimentos TO authenticated;
GRANT ALL ON public.do_registros_atendimentos TO service_role;

ALTER TABLE public.do_registros_atendimentos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins leem todo o historico de atendimento"
  ON public.do_registros_atendimentos FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Consultora le o proprio historico"
  ON public.do_registros_atendimentos FOR SELECT TO authenticated
  USING (lower(btrim(consultora_nome)) = lower(btrim(coalesce(public.minha_consultora_nome(), ''))));

-- Backfill dos responsáveis atuais.
INSERT INTO public.do_registros_atendimentos (registro_id, consultora_nome, status_final, atendido_em)
SELECT d.id, btrim(d.consultora_responsavel), d.status_abordagem,
       coalesce(d.contatado_em, d.atribuido_em, d.created_at)
  FROM public.do_registros d
 WHERE coalesce(btrim(d.consultora_responsavel), '') <> '';

CREATE OR REPLACE FUNCTION public.reiniciar_promovidos_e_redistribuir(
  _dias_bloqueio integer DEFAULT 7,
  _janela_dias integer DEFAULT NULL,
  _limite integer DEFAULT 20000
)
RETURNS TABLE(reiniciados integer, atribuidos integer, consultoras integer, sem_dono integer)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_reini integer := 0;
  v_atrib integer := 0;
  v_qtd integer := 0;
  v_orfao integer := 0;
  reg record;
  alvo record;
  corte timestamptz := now() - make_interval(days => greatest(coalesce(_dias_bloqueio, 7), 0));
BEGIN
  PERFORM public.sync_radar_consultoras();

  -- 1. Leads no escopo
  CREATE TEMP TABLE _pool ON COMMIT DROP AS
  SELECT d.id, btrim(d.consultora_responsavel) AS dono, d.status_abordagem,
         coalesce(d.contatado_em, d.atribuido_em, d.created_at) AS quando,
         d.data_publicacao, d.created_at
    FROM public.do_registros d
   WHERE (_janela_dias IS NULL OR d.data_publicacao >= current_date - _janela_dias)
   ORDER BY d.data_publicacao DESC NULLS LAST, d.created_at DESC
   LIMIT greatest(coalesce(_limite, 20000), 0);

  -- 2. Guarda o histórico de quem já atendeu
  INSERT INTO public.do_registros_atendimentos (registro_id, consultora_nome, status_final, atendido_em)
  SELECT p.id, p.dono, p.status_abordagem, p.quando
    FROM _pool p
   WHERE coalesce(p.dono, '') <> '';

  -- 3. Devolve tudo ao estoque
  WITH u AS (
    UPDATE public.do_registros d
       SET consultora_responsavel = NULL,
           atribuido_em = NULL,
           contatado_em = NULL,
           status_abordagem = 'novo'
      FROM _pool p
     WHERE d.id = p.id
    RETURNING 1
  ) SELECT count(*) INTO v_reini FROM u;

  -- 4. Consultoras elegíveis (ativas e com conta no sistema)
  CREATE TEMP TABLE _alvos ON COMMIT DROP AS
  SELECT c.nome, 0::int AS carga, c.created_at
    FROM public.radar_consultoras c
   WHERE c.ativo = true
     AND btrim(coalesce(c.nome, '')) <> ''
     AND EXISTS (SELECT 1 FROM auth.users u
                  WHERE u.deleted_at IS NULL AND lower(u.email) = lower(btrim(c.email)));

  SELECT count(*) INTO v_qtd FROM _alvos;
  IF v_qtd = 0 THEN
    RETURN QUERY SELECT v_reini, 0, 0, v_reini;
    RETURN;
  END IF;

  -- 5. Rodízio equilibrado respeitando o bloqueio de repetição
  FOR reg IN SELECT id FROM _pool ORDER BY data_publicacao DESC NULLS LAST, created_at DESC LOOP
    SELECT a.nome INTO alvo
      FROM _alvos a
     WHERE NOT EXISTS (
       SELECT 1 FROM public.do_registros_atendimentos h
        WHERE h.registro_id = reg.id
          AND lower(btrim(h.consultora_nome)) = lower(btrim(a.nome))
          AND h.atendido_em >= corte
     )
     ORDER BY a.carga ASC, a.created_at ASC, a.nome ASC
     LIMIT 1;

    IF alvo.nome IS NULL THEN
      v_orfao := v_orfao + 1;
      CONTINUE;
    END IF;

    UPDATE public.do_registros
       SET consultora_responsavel = alvo.nome, atribuido_em = now()
     WHERE id = reg.id;

    UPDATE _alvos SET carga = carga + 1 WHERE nome = alvo.nome;
    v_atrib := v_atrib + 1;
  END LOOP;

  UPDATE public.radar_consultoras c
     SET total_leads_atribuidos = (
       SELECT count(*) FROM public.do_registros d WHERE d.consultora_responsavel = c.nome
     )
   WHERE c.id IS NOT NULL;

  RETURN QUERY SELECT v_reini, v_atrib, v_qtd, v_orfao;
END;
$function$;

REVOKE ALL ON FUNCTION public.reiniciar_promovidos_e_redistribuir(integer, integer, integer) FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION public.reiniciar_promovidos_e_redistribuir(integer, integer, integer) TO service_role;