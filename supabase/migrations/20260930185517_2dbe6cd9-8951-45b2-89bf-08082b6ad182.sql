DROP FUNCTION IF EXISTS public.reiniciar_prospect_leads(uuid[], text[], integer, integer, boolean);
CREATE FUNCTION public.reiniciar_prospect_leads(_consultoras uuid[], _status text[] DEFAULT ARRAY['perdido','novo','qualificado','proposta'], _dias_min integer DEFAULT 0, _limite integer DEFAULT 800, _simular boolean DEFAULT false, _desde timestamptz DEFAULT NULL)
 RETURNS TABLE(reiniciados integer, atribuidos integer, esgotados integer, consultoras integer)
 LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE
  v_rei int := 0; v_atr int := 0; v_esg int := 0; v_qtd int := 0;
  reg record; alvo uuid;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN RAISE EXCEPTION 'Acesso restrito a administradores.'; END IF;

  CREATE TEMP TABLE _alvos ON COMMIT DROP AS
  SELECT DISTINCT c AS id, 0::int AS carga FROM unnest(coalesce(_consultoras, '{}')) c
   WHERE NOT public.has_role(c, 'admin');
  SELECT count(*) INTO v_qtd FROM _alvos;

  CREATE TEMP TABLE _pool ON COMMIT DROP AS
  SELECT l.id, l.consultant_id FROM public.prospect_leads l
   WHERE l.status::text = ANY(_status) AND l.status <> 'ganho'
     AND l.consultant_id IS NOT NULL
     AND (_desde IS NULL OR l.atribuido_em IS NULL OR l.atribuido_em < _desde)
     AND coalesce(l.last_contact_at, l.atribuido_em, l.created_at) < now() - make_interval(days => greatest(_dias_min,0))
   ORDER BY coalesce(l.last_contact_at, l.atribuido_em, l.created_at) ASC
   LIMIT CASE WHEN _simular THEN 1000000 ELSE least(greatest(_limite, 0), 2000) END;

  IF _simular THEN
    SELECT count(*) INTO v_rei FROM _pool;
    SELECT count(*) INTO v_esg FROM _pool p WHERE NOT EXISTS (
      SELECT 1 FROM _alvos a WHERE a.id <> p.consultant_id AND NOT EXISTS (
        SELECT 1 FROM public.prospect_leads_atendimentos h WHERE h.lead_id = p.id AND h.consultant_id = a.id));
    RETURN QUERY SELECT v_rei, v_rei - v_esg, v_esg, v_qtd; RETURN;
  END IF;

  UPDATE public.lead_tasks t SET status = 'canceled' FROM _pool p WHERE t.lead_id = p.id AND t.status = 'pending';

  WITH u AS (
    UPDATE public.prospect_leads l
       SET consultant_id = NULL, atribuido_em = NULL, next_follow_up_at = NULL,
           status = 'novo', first_response_at = NULL, last_contact_at = NULL, opened_at = NULL
      FROM _pool p WHERE l.id = p.id RETURNING 1)
  SELECT count(*) INTO v_rei FROM u;

  UPDATE _alvos a SET carga = (SELECT count(*) FROM public.prospect_leads l
    WHERE l.consultant_id = a.id AND l.status NOT IN ('ganho','perdido'))
   WHERE a.id IS NOT NULL;

  FOR reg IN SELECT id FROM _pool LOOP
    SELECT a.id INTO alvo FROM _alvos a
     WHERE NOT EXISTS (SELECT 1 FROM public.prospect_leads_atendimentos h
                        WHERE h.lead_id = reg.id AND h.consultant_id = a.id)
     ORDER BY a.carga ASC, random() LIMIT 1;
    IF alvo IS NULL THEN v_esg := v_esg + 1; CONTINUE; END IF;
    UPDATE public.prospect_leads SET consultant_id = alvo, atribuido_em = now(), opened_at = now() WHERE id = reg.id;
    UPDATE _alvos SET carga = carga + 1 WHERE id = alvo;
    v_atr := v_atr + 1;
  END LOOP;

  RETURN QUERY SELECT v_rei, v_atr, v_esg, v_qtd;
END $function$;
REVOKE ALL ON FUNCTION public.reiniciar_prospect_leads(uuid[], text[], integer, integer, boolean, timestamptz) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.reiniciar_prospect_leads(uuid[], text[], integer, integer, boolean, timestamptz) TO authenticated;