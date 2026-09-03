CREATE TABLE public.tomadores_al_atendimentos (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tomador_id uuid NOT NULL REFERENCES public.tomadores_al(id) ON DELETE CASCADE,
  consultora_nome text NOT NULL,
  status_final text,
  finalizado_em timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX tomadores_al_atend_unq ON public.tomadores_al_atendimentos (tomador_id, lower(btrim(consultora_nome)));
CREATE INDEX tomadores_al_atend_tomador_idx ON public.tomadores_al_atendimentos (tomador_id);

GRANT SELECT ON public.tomadores_al_atendimentos TO authenticated;
GRANT ALL ON public.tomadores_al_atendimentos TO service_role;

ALTER TABLE public.tomadores_al_atendimentos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "atend admin all" ON public.tomadores_al_atendimentos
  FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "atend select own" ON public.tomadores_al_atendimentos
  FOR SELECT TO authenticated
  USING (lower(btrim(consultora_nome)) = lower(btrim(coalesce(public.minha_consultora_nome(), ''))));

INSERT INTO public.tomadores_al_atendimentos (tomador_id, consultora_nome, status_final, finalizado_em)
SELECT t.id, btrim(t.consultora_responsavel), t.status_abordagem, coalesce(t.finalizado_em, t.contatado_em)
  FROM public.tomadores_al t
 WHERE coalesce(btrim(t.consultora_responsavel), '') <> ''
   AND t.status_abordagem IN ('convertido', 'sem_interesse')
ON CONFLICT DO NOTHING;

CREATE OR REPLACE FUNCTION public.reiniciar_tomadores_trabalhados(
  _status text[] DEFAULT ARRAY['convertido','sem_interesse'],
  _dias_min integer DEFAULT 0,
  _limite integer DEFAULT 5000
)
RETURNS TABLE(reiniciados integer, historicos integer)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_reini integer := 0;
  v_hist integer := 0;
  _sts text[] := coalesce(nullif(_status, '{}'), ARRAY['convertido','sem_interesse']);
BEGIN
  CREATE TEMP TABLE _alvo ON COMMIT DROP AS
  SELECT t.id, btrim(t.consultora_responsavel) AS nome, t.status_abordagem,
         coalesce(t.finalizado_em, t.contatado_em, t.atribuido_em) AS quando
    FROM public.tomadores_al t
   WHERE t.status_abordagem = ANY (_sts)
     AND coalesce(t.finalizado_em, t.contatado_em, t.atribuido_em) < now() - make_interval(days => greatest(_dias_min, 0))
   ORDER BY coalesce(t.finalizado_em, t.contatado_em, t.atribuido_em) ASC
   LIMIT greatest(_limite, 0);

  WITH h AS (
    INSERT INTO public.tomadores_al_atendimentos (tomador_id, consultora_nome, status_final, finalizado_em)
    SELECT a.id, a.nome, a.status_abordagem, a.quando
      FROM _alvo a
     WHERE coalesce(a.nome, '') <> ''
    ON CONFLICT DO NOTHING
    RETURNING 1
  ) SELECT count(*) INTO v_hist FROM h;

  WITH u AS (
    UPDATE public.tomadores_al t
       SET consultora_responsavel = NULL,
           atribuido_em = NULL,
           contatado_em = NULL,
           finalizado_em = NULL,
           motivo_sem_interesse = NULL,
           status_abordagem = 'novo'
      FROM _alvo a
     WHERE t.id = a.id
    RETURNING 1
  ) SELECT count(*) INTO v_reini FROM u;

  UPDATE public.radar_consultoras c
     SET total_leads_atribuidos = (
       SELECT count(*) FROM public.tomadores_al t WHERE t.consultora_responsavel = c.nome
     );

  DROP TABLE IF EXISTS _alvo;
  RETURN QUERY SELECT v_reini, v_hist;
END;
$function$;

REVOKE ALL ON FUNCTION public.reiniciar_tomadores_trabalhados(text[], integer, integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.reiniciar_tomadores_trabalhados(text[], integer, integer) TO service_role;

CREATE OR REPLACE FUNCTION public.garantir_pool_tomadores_faixa(_nome text, _faixa text, _alvo integer DEFAULT 10, _dias_reciclagem integer DEFAULT 14, _dias_sem_interesse integer DEFAULT 7)
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  _gte numeric;
  _lt numeric;
  abertos integer;
  faltam integer;
  novos integer := 0;
  reservados integer;
  liberados integer;
  tentativa integer;
BEGIN
  IF coalesce(btrim(_nome), '') = '' THEN RETURN 0; END IF;

  _gte := CASE _faixa WHEN 'baixa' THEN 0 WHEN 'media' THEN 200 WHEN 'alta' THEN 600 ELSE NULL END;
  _lt  := CASE _faixa WHEN 'baixa' THEN 200 WHEN 'media' THEN 600 ELSE NULL END;

  PERFORM pg_advisory_xact_lock(hashtext('pool_tomadores:' || lower(_nome) || ':' || coalesce(_faixa, '')));

  SELECT count(*) INTO abertos
    FROM public.tomadores_al t
   WHERE t.consultora_responsavel = _nome
     AND t.status_abordagem IN ('novo', 'contatado', 'proposta_enviada')
     AND (_gte IS NULL OR coalesce(t.margem_disp_emprestimo, 0) >= _gte)
     AND (_lt  IS NULL OR coalesce(t.margem_disp_emprestimo, 0) <  _lt);

  faltam := greatest(_alvo, 0) - abertos;
  IF faltam <= 0 THEN RETURN 0; END IF;

  FOR tentativa IN 1..3 LOOP
    WITH livres AS (
      SELECT t.id
        FROM public.tomadores_al t
       WHERE t.consultora_responsavel IS NULL
         AND (_gte IS NULL OR coalesce(t.margem_disp_emprestimo, 0) >= _gte)
         AND (_lt  IS NULL OR coalesce(t.margem_disp_emprestimo, 0) <  _lt)
         AND NOT EXISTS (
           SELECT 1 FROM public.tomadores_al_atendimentos h
            WHERE h.tomador_id = t.id
              AND lower(btrim(h.consultora_nome)) = lower(btrim(_nome))
         )
       ORDER BY (
                 EXISTS (SELECT 1 FROM public.pesquisas_nv n
                          WHERE regexp_replace(coalesce(n.documento,''), '\D', '', 'g') = regexp_replace(coalesce(t.documento,''), '\D', '', 'g')
                            AND length(regexp_replace(coalesce(n.celular,''), '\D', '', 'g')) >= 10)
                 OR EXISTS (SELECT 1 FROM public.prospect_leads p
                             WHERE regexp_replace(coalesce(p.cpf,''), '\D', '', 'g') = regexp_replace(coalesce(t.documento,''), '\D', '', 'g')
                               AND length(regexp_replace(coalesce(p.telefone,''), '\D', '', 'g')) >= 10)
                ) DESC,
                coalesce(t.margem_disp_emprestimo, 0) DESC
       LIMIT faltam
         FOR UPDATE SKIP LOCKED
    ), upd AS (
      UPDATE public.tomadores_al d
         SET consultora_responsavel = _nome,
             atribuido_em = now()
        FROM livres l
       WHERE d.id = l.id
         AND d.consultora_responsavel IS NULL
      RETURNING 1
    )
    SELECT count(*) INTO reservados FROM upd;

    novos := novos + coalesce(reservados, 0);
    faltam := faltam - coalesce(reservados, 0);
    EXIT WHEN faltam <= 0;

    WITH parados AS (
      SELECT t.id
        FROM public.tomadores_al t
       WHERE t.consultora_responsavel IS NOT NULL
         AND t.consultora_responsavel <> _nome
         AND t.status_abordagem = 'novo'
         AND (_gte IS NULL OR coalesce(t.margem_disp_emprestimo, 0) >= _gte)
         AND (_lt  IS NULL OR coalesce(t.margem_disp_emprestimo, 0) <  _lt)
         AND (
           NOT EXISTS (SELECT 1 FROM public.radar_consultoras c
                        WHERE c.ativo = true
                          AND lower(btrim(c.nome)) = lower(btrim(t.consultora_responsavel)))
           OR t.atribuido_em IS NULL
           OR t.atribuido_em < now() - make_interval(days => greatest(_dias_reciclagem, 1))
         )
       ORDER BY t.atribuido_em ASC NULLS FIRST
       LIMIT faltam
         FOR UPDATE SKIP LOCKED
    ), upd2 AS (
      UPDATE public.tomadores_al d
         SET consultora_responsavel = NULL, atribuido_em = NULL
        FROM parados p
       WHERE d.id = p.id AND d.status_abordagem = 'novo'
      RETURNING 1
    )
    SELECT count(*) INTO liberados FROM upd2;

    IF coalesce(liberados, 0) < faltam THEN
      WITH antigos AS (
        SELECT t.id, btrim(t.consultora_responsavel) AS dono, t.status_abordagem, t.finalizado_em
          FROM public.tomadores_al t
         WHERE t.status_abordagem = 'sem_interesse'
           AND t.finalizado_em IS NOT NULL
           AND t.finalizado_em < now() - make_interval(days => greatest(_dias_sem_interesse, 1))
           AND coalesce(t.consultora_responsavel, '') <> _nome
           AND (_gte IS NULL OR coalesce(t.margem_disp_emprestimo, 0) >= _gte)
           AND (_lt  IS NULL OR coalesce(t.margem_disp_emprestimo, 0) <  _lt)
         ORDER BY t.finalizado_em ASC
         LIMIT faltam - coalesce(liberados, 0)
           FOR UPDATE SKIP LOCKED
      ), hist AS (
        INSERT INTO public.tomadores_al_atendimentos (tomador_id, consultora_nome, status_final, finalizado_em)
        SELECT a.id, a.dono, a.status_abordagem, a.finalizado_em
          FROM antigos a WHERE coalesce(a.dono, '') <> ''
        ON CONFLICT DO NOTHING
        RETURNING 1
      )
      UPDATE public.tomadores_al d
         SET consultora_responsavel = NULL,
             atribuido_em = NULL,
             status_abordagem = 'novo',
             contatado_em = NULL,
             finalizado_em = NULL
        FROM antigos a
       WHERE d.id = a.id AND d.status_abordagem = 'sem_interesse';
    END IF;
  END LOOP;

  IF novos > 0 THEN
    UPDATE public.radar_consultoras c
       SET total_leads_atribuidos = (
             SELECT count(*) FROM public.tomadores_al t WHERE t.consultora_responsavel = c.nome
           )
     WHERE c.nome = _nome;
  END IF;

  RETURN novos;
END;
$function$;