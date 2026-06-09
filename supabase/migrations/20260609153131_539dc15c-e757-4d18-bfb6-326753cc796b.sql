
-- Enums
CREATE TYPE public.prospect_status AS ENUM ('novo','qualificado','proposta','ganho','perdido');
CREATE TYPE public.prospect_event_kind AS ENUM ('ligacao','whatsapp','nota','status','followup','sistema');
CREATE TYPE public.prospect_task_status AS ENUM ('pending','done','canceled');
CREATE TYPE public.prospect_sla_status AS ENUM ('ok','atencao','atrasado');

-- Leads
CREATE TABLE public.prospect_leads (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nome text NOT NULL,
  telefone text,
  cpf text,
  cidade text,
  origem text DEFAULT 'planilha',
  orcamento numeric,
  urgencia text DEFAULT 'media',
  respondeu_whatsapp boolean NOT NULL DEFAULT false,
  status public.prospect_status NOT NULL DEFAULT 'novo',
  consultant_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  score int NOT NULL DEFAULT 0,
  quality_score int NOT NULL DEFAULT 0,
  loss_reason text,
  first_response_at timestamptz,
  sla_status public.prospect_sla_status NOT NULL DEFAULT 'ok',
  next_follow_up_at timestamptz,
  last_contact_at timestamptz,
  notes text,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_prospect_leads_consultant ON public.prospect_leads(consultant_id);
CREATE INDEX idx_prospect_leads_status ON public.prospect_leads(status);
CREATE INDEX idx_prospect_leads_score ON public.prospect_leads(consultant_id, score DESC);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.prospect_leads TO authenticated;
GRANT ALL ON public.prospect_leads TO service_role;
ALTER TABLE public.prospect_leads ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage all leads" ON public.prospect_leads
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin'))
  WITH CHECK (public.has_role(auth.uid(),'admin'));
CREATE POLICY "Consultants view own leads" ON public.prospect_leads
  FOR SELECT TO authenticated
  USING (consultant_id = auth.uid());
CREATE POLICY "Consultants update own leads" ON public.prospect_leads
  FOR UPDATE TO authenticated
  USING (consultant_id = auth.uid())
  WITH CHECK (consultant_id = auth.uid());

-- Events (timeline)
CREATE TABLE public.lead_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id uuid NOT NULL REFERENCES public.prospect_leads(id) ON DELETE CASCADE,
  consultant_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  kind public.prospect_event_kind NOT NULL DEFAULT 'nota',
  body text,
  meta jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_lead_events_lead ON public.lead_events(lead_id, created_at DESC);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.lead_events TO authenticated;
GRANT ALL ON public.lead_events TO service_role;
ALTER TABLE public.lead_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage all events" ON public.lead_events
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin'))
  WITH CHECK (public.has_role(auth.uid(),'admin'));
CREATE POLICY "Consultants view own lead events" ON public.lead_events
  FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.prospect_leads l WHERE l.id = lead_id AND l.consultant_id = auth.uid()));
CREATE POLICY "Consultants insert own lead events" ON public.lead_events
  FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM public.prospect_leads l WHERE l.id = lead_id AND l.consultant_id = auth.uid()));

-- Tasks (follow-up)
CREATE TABLE public.lead_tasks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id uuid NOT NULL REFERENCES public.prospect_leads(id) ON DELETE CASCADE,
  consultant_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  title text NOT NULL,
  due_at timestamptz NOT NULL,
  status public.prospect_task_status NOT NULL DEFAULT 'pending',
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_lead_tasks_lead ON public.lead_tasks(lead_id);
CREATE INDEX idx_lead_tasks_due ON public.lead_tasks(consultant_id, status, due_at);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.lead_tasks TO authenticated;
GRANT ALL ON public.lead_tasks TO service_role;
ALTER TABLE public.lead_tasks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage all tasks" ON public.lead_tasks
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin'))
  WITH CHECK (public.has_role(auth.uid(),'admin'));
CREATE POLICY "Consultants view own tasks" ON public.lead_tasks
  FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.prospect_leads l WHERE l.id = lead_id AND l.consultant_id = auth.uid()));
CREATE POLICY "Consultants manage own tasks" ON public.lead_tasks
  FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.prospect_leads l WHERE l.id = lead_id AND l.consultant_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.prospect_leads l WHERE l.id = lead_id AND l.consultant_id = auth.uid()));

-- updated_at trigger (reuse existing set_updated_at)
CREATE TRIGGER trg_prospect_leads_updated BEFORE UPDATE ON public.prospect_leads
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Score + SLA computation
CREATE OR REPLACE FUNCTION public.compute_prospect_lead()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  s int := 0;
  age_minutes numeric;
  days_since_contact numeric;
BEGIN
  -- Origem
  s := s + CASE lower(coalesce(NEW.origem,''))
    WHEN 'indicacao' THEN 25
    WHEN 'whatsapp' THEN 15
    WHEN 'site' THEN 12
    WHEN 'evento' THEN 12
    ELSE 5 END;
  -- Orcamento
  IF NEW.orcamento IS NOT NULL THEN
    IF NEW.orcamento >= 50000 THEN s := s + 20;
    ELSIF NEW.orcamento >= 20000 THEN s := s + 13;
    ELSIF NEW.orcamento > 0 THEN s := s + 6;
    END IF;
  END IF;
  -- Urgencia
  s := s + CASE lower(coalesce(NEW.urgencia,''))
    WHEN 'alta' THEN 20 WHEN 'media' THEN 10 ELSE 2 END;
  -- Engajamento
  IF NEW.respondeu_whatsapp THEN s := s + 15; END IF;
  s := s + CASE NEW.status
    WHEN 'qualificado' THEN 8
    WHEN 'proposta' THEN 14
    WHEN 'ganho' THEN 20
    ELSE 0 END;
  -- Recencia de contato
  IF NEW.last_contact_at IS NOT NULL THEN
    days_since_contact := EXTRACT(EPOCH FROM (now() - NEW.last_contact_at)) / 86400.0;
    IF days_since_contact <= 1 THEN s := s + 10;
    ELSIF days_since_contact <= 3 THEN s := s + 5;
    END IF;
  END IF;
  IF s > 100 THEN s := 100; END IF;
  IF s < 0 THEN s := 0; END IF;
  NEW.score := s;

  -- SLA
  IF NEW.status IN ('ganho','perdido') THEN
    NEW.sla_status := 'ok';
  ELSIF NEW.status = 'novo' AND NEW.first_response_at IS NULL THEN
    age_minutes := EXTRACT(EPOCH FROM (now() - NEW.created_at)) / 60.0;
    IF age_minutes > 60 THEN NEW.sla_status := 'atrasado';
    ELSIF age_minutes > 5 THEN NEW.sla_status := 'atencao';
    ELSE NEW.sla_status := 'ok';
    END IF;
  ELSIF NEW.next_follow_up_at IS NOT NULL AND NEW.next_follow_up_at < now() THEN
    NEW.sla_status := 'atrasado';
  ELSIF NEW.last_contact_at IS NOT NULL
        AND EXTRACT(EPOCH FROM (now() - NEW.last_contact_at)) / 86400.0 >= 3 THEN
    NEW.sla_status := 'atrasado';
  ELSE
    NEW.sla_status := 'ok';
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_prospect_leads_compute
  BEFORE INSERT OR UPDATE ON public.prospect_leads
  FOR EACH ROW EXECUTE FUNCTION public.compute_prospect_lead();
