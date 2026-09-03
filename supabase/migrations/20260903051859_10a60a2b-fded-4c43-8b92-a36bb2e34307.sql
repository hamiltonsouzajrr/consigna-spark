CREATE OR REPLACE FUNCTION public.garantir_pool_tomadores_faixa(
  _nome text,
  _faixa text,
  _alvo integer DEFAULT 10,
  _dias_reciclagem integer DEFAULT 14,
  _dias_sem_interesse integer DEFAULT 7
) RETURNS integer
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

  -- Serializa reposições concorrentes da mesma faixa/consultora.
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
    -- Reserva do estoque livre, com trava por linha (sem disputa entre consultoras).
    WITH livres AS (
      SELECT t.id
        FROM public.tomadores_al t
       WHERE t.consultora_responsavel IS NULL
         AND (_gte IS NULL OR coalesce(t.margem_disp_emprestimo, 0) >= _gte)
         AND (_lt  IS NULL OR coalesce(t.margem_disp_emprestimo, 0) <  _lt)
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

    -- Estoque insuficiente: devolve leads parados (dono inativo ou nunca trabalhado).
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
      -- Reaproveita "sem interesse" antigos, nunca para quem os finalizou.
      WITH antigos AS (
        SELECT t.id
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

REVOKE ALL ON FUNCTION public.garantir_pool_tomadores_faixa(text, text, integer, integer, integer) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.garantir_pool_tomadores_faixa(text, text, integer, integer, integer) FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION public.garantir_pool_tomadores_faixa(text, text, integer, integer, integer) TO service_role;