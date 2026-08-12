-- Regra reutilizável de rodízio para qualquer tabela que tenha
-- as colunas consultora_responsavel / atribuido_em.
CREATE OR REPLACE FUNCTION public.atribuir_consultora_round_robin()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  alvo_id uuid;
  alvo_nome text;
BEGIN
  IF NEW.consultora_responsavel IS NOT NULL THEN
    RETURN NEW;
  END IF;

  SELECT id, nome INTO alvo_id, alvo_nome
  FROM public.radar_consultoras
  WHERE ativo = true
  ORDER BY total_leads_atribuidos ASC, created_at ASC
  LIMIT 1;

  IF alvo_id IS NULL THEN
    RETURN NEW;
  END IF;

  NEW.consultora_responsavel := alvo_nome;
  NEW.atribuido_em := now();

  UPDATE public.radar_consultoras
    SET total_leads_atribuidos = total_leads_atribuidos + 1
    WHERE id = alvo_id;

  RETURN NEW;
END;
$$;

ALTER TABLE public.tomadores_al
  ADD COLUMN IF NOT EXISTS consultora_responsavel text,
  ADD COLUMN IF NOT EXISTS status_abordagem text NOT NULL DEFAULT 'novo',
  ADD COLUMN IF NOT EXISTS contatado_em timestamptz,
  ADD COLUMN IF NOT EXISTS atribuido_em timestamptz;

CREATE INDEX IF NOT EXISTS tomadores_al_consultora_idx
  ON public.tomadores_al (consultora_responsavel);
CREATE INDEX IF NOT EXISTS tomadores_al_status_abordagem_idx
  ON public.tomadores_al (status_abordagem);

DROP TRIGGER IF EXISTS trg_tomadores_al_atribuir ON public.tomadores_al;
CREATE TRIGGER trg_tomadores_al_atribuir
  BEFORE INSERT ON public.tomadores_al
  FOR EACH ROW EXECUTE FUNCTION public.atribuir_consultora_round_robin();
