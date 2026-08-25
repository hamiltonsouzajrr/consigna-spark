DROP FUNCTION IF EXISTS public.redistribuir_do_registros_por_desempenho(integer, integer, numeric);

CREATE OR REPLACE FUNCTION public.redistribuir_do_registros_por_desempenho(
  _dias_desempenho integer DEFAULT 14,
  _janela_dias integer DEFAULT NULL,
  _peso_max numeric DEFAULT 4.0,
  _status text[] DEFAULT NULL,
  _somente_nao_contatados boolean DEFAULT true
)
RETURNS TABLE(atribuidos integer, consultoras integer, top_consultora text, top_peso numeric)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  qtd integer := 0;
  total integer := 0;
  n_regs integer := 0;
  soma_peso numeric := 0;
  reg record;
  alvo record;
  novos record;
  _top_nome text;
  _top_peso numeric;
  _sts text[] := coalesce(nullif(_status, '{}'), ARRAY['novo']);
BEGIN
  PERFORM public.sync_radar_consultoras();

  CREATE TEMP TABLE _perf ON COMMIT DROP AS
  WITH ativas AS (
    SELECT c.nome, lower(btrim(c.email)) AS email, c.created_at
    FROM public.radar_consultoras c
    WHERE c.ativo = true
      AND btrim(coalesce(c.nome, '')) <> ''
      AND EXISTS (SELECT 1 FROM auth.users u
                   WHERE u.deleted_at IS NULL AND lower(u.email) = lower(btrim(c.email)))
  ), contatos AS (
    SELECT d.consultora_responsavel AS nome, count(*)::numeric AS n
    FROM public.do_registros d
    WHERE d.contatado_em IS NOT NULL
      AND d.contatado_em >= now() - make_interval(days => greatest(_dias_desempenho, 1))
    GROUP BY d.consultora_responsavel
  ), pontos AS (
    SELECT lower(u.email) AS email, sum(p.pontos)::numeric AS n
    FROM public.prospect_pontos p
    JOIN auth.users u ON u.id = p.user_id
    WHERE p.anulado_em IS NULL
      AND p.created_at >= now() - make_interval(days => greatest(_dias_desempenho, 1))
    GROUP BY lower(u.email)
  )
  SELECT a.nome,
         a.email,
         a.created_at,
         (coalesce(ct.n, 0) + coalesce(pt.n, 0) / 10.0) AS score,
         0::numeric AS peso,
         0::integer AS quota,
         0::integer AS recebidos
  FROM ativas a
  LEFT JOIN contatos ct ON ct.nome = a.nome
  LEFT JOIN pontos pt ON pt.email = a.email;

  SELECT count(*) INTO qtd FROM _perf;
  IF qtd = 0 THEN
    RETURN QUERY SELECT 0, 0, NULL::text, 0::numeric;
    RETURN;
  END IF;

  UPDATE _perf p
     SET peso = 1 + (greatest(_peso_max, 1) - 1)
                * CASE WHEN (SELECT max(score) FROM _perf) > 0
                       THEN p.score / (SELECT max(score) FROM _perf) ELSE 0 END;

  SELECT sum(peso) INTO soma_peso FROM _perf;
  SELECT nome, peso INTO _top_nome, _top_peso FROM _perf ORDER BY peso DESC, nome LIMIT 1;

  CREATE TEMP TABLE _pool ON COMMIT DROP AS
  SELECT d.id,
         row_number() OVER (ORDER BY d.data_publicacao DESC NULLS LAST, d.created_at DESC) AS rn
  FROM public.do_registros d
  WHERE coalesce(d.status_abordagem, 'novo') = ANY (_sts)
    AND (NOT _somente_nao_contatados OR d.contatado_em IS NULL)
    AND (_janela_dias IS NULL OR d.data_publicacao >= current_date - _janela_dias);

  SELECT count(*) INTO n_regs FROM _pool;
  IF n_regs = 0 THEN
    RETURN QUERY SELECT 0, qtd, _top_nome, _top_peso;
    RETURN;
  END IF;

  UPDATE _perf SET quota = floor(n_regs * peso / soma_peso)::int;

  CREATE TEMP TABLE _dist_tmp (consultora text, qtd integer) ON COMMIT DROP;

  FOR reg IN SELECT id FROM _pool ORDER BY rn LOOP
    SELECT nome INTO alvo
      FROM _perf
     ORDER BY (recebidos < quota) DESC, (quota - recebidos) DESC, peso DESC, nome
     LIMIT 1;
    EXIT WHEN alvo.nome IS NULL;

    UPDATE public.do_registros
       SET consultora_responsavel = alvo.nome, atribuido_em = now()
     WHERE id = reg.id
       AND coalesce(consultora_responsavel, '') <> alvo.nome;

    IF FOUND THEN
      INSERT INTO _dist_tmp (consultora, qtd) VALUES (alvo.nome, 1);
      total := total + 1;
    END IF;
    UPDATE _perf SET recebidos = recebidos + 1 WHERE nome = alvo.nome;
  END LOOP;

  UPDATE public.radar_consultoras c
     SET total_leads_atribuidos = (
       SELECT count(*) FROM public.do_registros d WHERE d.consultora_responsavel = c.nome
     );

  FOR novos IN
    SELECT t.consultora, sum(t.qtd)::int AS qtd, u.id AS user_id
    FROM _dist_tmp t
    JOIN public.radar_consultoras c ON c.nome = t.consultora
    JOIN auth.users u ON lower(u.email) = lower(c.email)
    GROUP BY t.consultora, u.id
  LOOP
    INSERT INTO public.rh_notifications (user_id, title, body)
    VALUES (
      novos.user_id,
      novos.qtd || ' novos promovidos na sua carteira',
      'Distribuição por desempenho: ' || novos.qtd || ' lead(s) recém promovido(s) entraram na sua carteira. Fale nas primeiras 48h.'
    );
  END LOOP;

  RETURN QUERY SELECT total, qtd, _top_nome, _top_peso;
END;
$$;

REVOKE ALL ON FUNCTION public.redistribuir_do_registros_por_desempenho(integer, integer, numeric, text[], boolean) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.redistribuir_do_registros_por_desempenho(integer, integer, numeric, text[], boolean) TO service_role;