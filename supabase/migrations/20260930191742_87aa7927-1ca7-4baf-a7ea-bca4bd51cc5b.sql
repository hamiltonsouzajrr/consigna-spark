CREATE OR REPLACE FUNCTION public.prospect_leads_historico_dono()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.consultant_id IS NOT DISTINCT FROM OLD.consultant_id THEN RETURN NEW; END IF;
  IF OLD.consultant_id IS NOT NULL THEN
    INSERT INTO public.prospect_leads_atendimentos (lead_id, consultant_id, status_final, atendido_em)
    VALUES (OLD.id, OLD.consultant_id, OLD.status::text, coalesce(OLD.last_contact_at, OLD.atribuido_em, now()))
    ON CONFLICT (lead_id, consultant_id) DO UPDATE SET status_final = EXCLUDED.status_final;
  END IF;
  RETURN NEW;
END $$;