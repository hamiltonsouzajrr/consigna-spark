CREATE OR REPLACE FUNCTION public.compute_prospect_lead()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
DECLARE
  s int := 0;
  open_minutes numeric;
  days_since_contact numeric;
BEGIN
  -- Score (unchanged)
  s := s + CASE lower(coalesce(NEW.origem,''))
    WHEN 'indicacao' THEN 25
    WHEN 'whatsapp' THEN 15
    WHEN 'site' THEN 12
    WHEN 'evento' THEN 12
    ELSE 5 END;
  IF NEW.orcamento IS NOT NULL THEN
    IF NEW.orcamento >= 50000 THEN s := s + 20;
    ELSIF NEW.orcamento >= 20000 THEN s := s + 13;
    ELSIF NEW.orcamento > 0 THEN s := s + 6;
    END IF;
  END IF;
  s := s + CASE lower(coalesce(NEW.urgencia,''))
    WHEN 'alta' THEN 20 WHEN 'media' THEN 10 ELSE 2 END;
  IF NEW.respondeu_whatsapp THEN s := s + 15; END IF;
  s := s + CASE NEW.status
    WHEN 'qualificado' THEN 8
    WHEN 'proposta' THEN 14
    WHEN 'ganho' THEN 20
    ELSE 0 END;
  IF NEW.last_contact_at IS NOT NULL THEN
    days_since_contact := EXTRACT(EPOCH FROM (now() - NEW.last_contact_at)) / 86400.0;
    IF days_since_contact <= 1 THEN s := s + 10;
    ELSIF days_since_contact <= 3 THEN s := s + 5;
    END IF;
  END IF;
  IF s > 100 THEN s := 100; END IF;
  IF s < 0 THEN s := 0; END IF;
  NEW.score := s;

  -- SLA: only count time AFTER the consultant opens the lead. Untouched leads
  -- sitting in the queue (opened_at IS NULL) are never "atrasado" — they are
  -- simply waiting in the fila, regardless of import/created date.
  IF NEW.status IN ('ganho','perdido') THEN
    NEW.sla_status := 'ok';
  ELSIF NEW.next_follow_up_at IS NOT NULL THEN
    -- A scheduled follow-up is the real deadline once it exists.
    IF NEW.next_follow_up_at < now() THEN NEW.sla_status := 'atrasado';
    ELSE NEW.sla_status := 'ok';
    END IF;
  ELSIF NEW.opened_at IS NULL THEN
    -- Still in the queue, not yet worked.
    NEW.sla_status := 'ok';
  ELSIF NEW.first_response_at IS NULL THEN
    -- Opened but not contacted yet: clock starts at opened_at.
    open_minutes := EXTRACT(EPOCH FROM (now() - NEW.opened_at)) / 60.0;
    IF open_minutes > 1440 THEN NEW.sla_status := 'atrasado';
    ELSIF open_minutes > 60 THEN NEW.sla_status := 'atencao';
    ELSE NEW.sla_status := 'ok';
    END IF;
  ELSIF NEW.last_contact_at IS NOT NULL
        AND EXTRACT(EPOCH FROM (now() - NEW.last_contact_at)) / 86400.0 >= 3 THEN
    NEW.sla_status := 'atrasado';
  ELSE
    NEW.sla_status := 'ok';
  END IF;

  RETURN NEW;
END;
$function$;

-- Recompute existing rows so the queue stops showing everything as overdue.
UPDATE public.prospect_leads SET updated_at = now();