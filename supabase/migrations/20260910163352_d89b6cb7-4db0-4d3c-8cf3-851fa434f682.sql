-- 1) Conversões da consultora
CREATE TABLE public.prospect_conversoes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  lead_id uuid REFERENCES public.prospect_leads(id) ON DELETE SET NULL,
  cliente_nome text NOT NULL,
  cpf text,
  data_operacao date NOT NULL DEFAULT (now() AT TIME ZONE 'America/Maceio')::date,
  valor_liberado numeric NOT NULL DEFAULT 0,
  prazo integer,
  valor_parcela numeric,
  margem_restante boolean NOT NULL DEFAULT false,
  margem_restante_valor numeric,
  observacao text,
  lembrete_em timestamp with time zone,
  venda_id uuid,
  task_id uuid,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.prospect_conversoes TO authenticated;
GRANT ALL ON public.prospect_conversoes TO service_role;

ALTER TABLE public.prospect_conversoes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "conversoes_select_own_or_admin"
ON public.prospect_conversoes FOR SELECT TO authenticated
USING (user_id = auth.uid() OR public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'gestor_acessos'));

CREATE POLICY "conversoes_insert_own"
ON public.prospect_conversoes FOR INSERT TO authenticated
WITH CHECK (user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));

CREATE POLICY "conversoes_update_own_or_admin"
ON public.prospect_conversoes FOR UPDATE TO authenticated
USING (user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'))
WITH CHECK (user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));

CREATE POLICY "conversoes_delete_own_or_admin"
ON public.prospect_conversoes FOR DELETE TO authenticated
USING (user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER prospect_conversoes_set_updated_at
BEFORE UPDATE ON public.prospect_conversoes
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE INDEX idx_prospect_conversoes_user_data ON public.prospect_conversoes (user_id, data_operacao DESC);
CREATE INDEX idx_prospect_conversoes_lead ON public.prospect_conversoes (lead_id);

-- 2) Renda separada da margem
ALTER TABLE public.prospect_leads ADD COLUMN IF NOT EXISTS renda numeric;

-- 3) Score deixa de pontuar o valor ambíguo (orcamento) da planilha
CREATE OR REPLACE FUNCTION public.compute_prospect_lead()
RETURNS trigger
LANGUAGE plpgsql
AS $function$
DECLARE
  s int := 0;
  open_minutes numeric;
  days_since_contact numeric;
BEGIN
  s := s + CASE lower(coalesce(NEW.origem,''))
    WHEN 'indicacao' THEN 25
    WHEN 'whatsapp' THEN 15
    WHEN 'site' THEN 12
    WHEN 'evento' THEN 12
    ELSE 5 END;
  -- orcamento nao pontua: pode ser renda/salario da planilha, nao margem.
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

  IF NEW.status IN ('ganho','perdido') THEN
    NEW.sla_status := 'ok';
  ELSIF NEW.next_follow_up_at IS NOT NULL THEN
    IF NEW.next_follow_up_at < now() THEN NEW.sla_status := 'atrasado';
    ELSE NEW.sla_status := 'ok';
    END IF;
  ELSIF NEW.opened_at IS NULL THEN
    NEW.sla_status := 'ok';
  ELSIF NEW.first_response_at IS NULL THEN
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