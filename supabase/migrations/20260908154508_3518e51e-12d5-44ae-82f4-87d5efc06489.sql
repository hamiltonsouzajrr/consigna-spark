CREATE EXTENSION IF NOT EXISTS pg_trgm;

CREATE INDEX IF NOT EXISTS prospect_leads_pool_idx
  ON public.prospect_leads (status, score DESC)
  WHERE first_response_at IS NULL AND opened_at IS NULL;

CREATE INDEX IF NOT EXISTS prospect_leads_sem_consultora_idx
  ON public.prospect_leads (created_at DESC)
  WHERE consultant_id IS NULL;

CREATE INDEX IF NOT EXISTS tomadores_al_carteira_idx
  ON public.tomadores_al (consultora_responsavel, status_abordagem, margem_disp_emprestimo DESC);

CREATE INDEX IF NOT EXISTS tomadores_al_nome_trgm_idx
  ON public.tomadores_al USING gin (nome gin_trgm_ops);

CREATE INDEX IF NOT EXISTS tomadores_al_documento_trgm_idx
  ON public.tomadores_al USING gin (documento gin_trgm_ops);

CREATE INDEX IF NOT EXISTS lead_events_consultant_kind_created_idx
  ON public.lead_events (consultant_id, kind, created_at DESC);

CREATE OR REPLACE FUNCTION public.registrar_ponto(
  _user_id uuid,
  _categoria text,
  _ref_tabela text,
  _ref_id uuid,
  _pontos integer,
  _motivo text DEFAULT NULL::text,
  _teto_diario integer DEFAULT NULL::integer
) RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  ws date := public.competicao_week_start();
  hoje date := (now() AT TIME ZONE 'America/Maceio')::date;
  usados integer;
  inseridos integer;
BEGIN
  IF _user_id IS NULL OR _ref_id IS NULL THEN RETURN 0; END IF;

  -- Administradores acompanham, mas não pontuam.
  IF public.has_role(_user_id, 'admin') THEN RETURN 0; END IF;

  PERFORM public.competicao_garantir_semana(ws);

  IF _teto_diario IS NOT NULL THEN
    SELECT count(*) INTO usados
      FROM public.prospect_pontos
     WHERE user_id = _user_id
       AND categoria = _categoria
       AND anulado_em IS NULL
       AND (created_at AT TIME ZONE 'America/Maceio')::date = hoje;
    IF usados >= _teto_diario THEN RETURN 0; END IF;
  END IF;

  INSERT INTO public.prospect_pontos
    (user_id, week_start, categoria, ref_tabela, ref_id, pontos, motivo)
  VALUES (_user_id, ws, _categoria, _ref_tabela, _ref_id, _pontos, _motivo)
  ON CONFLICT (user_id, week_start, categoria, ref_tabela, ref_id) DO UPDATE
    SET anulado_em = NULL,
        anulado_por = NULL,
        pontos = EXCLUDED.pontos,
        motivo = EXCLUDED.motivo,
        created_at = now()
    WHERE public.prospect_pontos.anulado_em IS NOT NULL;

  GET DIAGNOSTICS inseridos = ROW_COUNT;
  RETURN CASE WHEN inseridos > 0 THEN _pontos ELSE 0 END;
END;
$$;