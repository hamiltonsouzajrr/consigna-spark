CREATE TABLE public.prospect_leads_atendimentos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id uuid NOT NULL REFERENCES public.prospect_leads(id) ON DELETE CASCADE,
  consultant_id uuid NOT NULL,
  status_final text,
  atendido_em timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (lead_id, consultant_id)
);
GRANT SELECT ON public.prospect_leads_atendimentos TO authenticated;
GRANT ALL ON public.prospect_leads_atendimentos TO service_role;
ALTER TABLE public.prospect_leads_atendimentos ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins leem historico de atendimento" ON public.prospect_leads_atendimentos
  FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE INDEX idx_pla_consultant ON public.prospect_leads_atendimentos(consultant_id);

-- Guarda o dono anterior e impede que o lead volte para quem já atendeu.
CREATE OR REPLACE FUNCTION public.prospect_leads_historico_dono()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.consultant_id IS NOT DISTINCT FROM OLD.consultant_id THEN RETURN NEW; END IF;
  IF OLD.consultant_id IS NOT NULL THEN
    INSERT INTO public.prospect_leads_atendimentos (lead_id, consultant_id, status_final, atendido_em)
    VALUES (OLD.id, OLD.consultant_id, OLD.status::text, coalesce(OLD.last_contact_at, OLD.atribuido_em, now()))
    ON CONFLICT (lead_id, consultant_id) DO UPDATE SET status_final = EXCLUDED.status_final;
  END IF;
  IF NEW.consultant_id IS NOT NULL AND EXISTS (
    SELECT 1 FROM public.prospect_leads_atendimentos h
     WHERE h.lead_id = NEW.id AND h.consultant_id = NEW.consultant_id) THEN
    NEW.consultant_id := NULL;
    NEW.atribuido_em := NULL;
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER trg_prospect_leads_historico_dono BEFORE UPDATE OF consultant_id ON public.prospect_leads
  FOR EACH ROW EXECUTE FUNCTION public.prospect_leads_historico_dono();

CREATE OR REPLACE FUNCTION public.reiniciar_prospect_leads(
  _consultoras uuid[], _status text[] DEFAULT ARRAY['perdido','novo','qualificado','proposta'],
  _dias_min integer DEFAULT 0, _limite integer DEFAULT 50000, _simular boolean DEFAULT false)
RETURNS TABLE(reiniciados integer, atribuidos integer, esgotados integer, consultoras integer)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
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
     AND coalesce(l.last_contact_at, l.atribuido_em, l.created_at) < now() - make_interval(days => greatest(_dias_min,0))
   ORDER BY coalesce(l.last_contact_at, l.atribuido_em, l.created_at) ASC
   LIMIT greatest(_limite, 0);

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
    WHERE l.consultant_id = a.id AND l.status NOT IN ('ganho','perdido'));

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
END $$;
REVOKE ALL ON FUNCTION public.reiniciar_prospect_leads(uuid[], text[], integer, integer, boolean) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.reiniciar_prospect_leads(uuid[], text[], integer, integer, boolean) TO authenticated;