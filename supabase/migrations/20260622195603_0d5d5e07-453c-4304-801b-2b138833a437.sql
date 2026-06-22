ALTER TABLE public.radar_consultoras
  ADD COLUMN IF NOT EXISTS total_leads_atribuidos integer NOT NULL DEFAULT 0;

-- Sincroniza o contador com os leads já atribuídos atualmente.
UPDATE public.radar_consultoras c
  SET total_leads_atribuidos = sub.total
  FROM (
    SELECT consultora_responsavel AS nome, count(*) AS total
    FROM public.do_registros
    WHERE consultora_responsavel IS NOT NULL
    GROUP BY consultora_responsavel
  ) sub
  WHERE lower(c.nome) = lower(sub.nome);

-- Atribuição automática por rodízio (least-loaded) ao inserir um lead elegível.
CREATE OR REPLACE FUNCTION public.atribuir_consultora_automatico()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  alvo_id uuid;
  alvo_nome text;
BEGIN
  -- Só distribui quando ainda não há consultora, potencial alto/médio e status novo.
  IF NEW.consultora_responsavel IS NOT NULL THEN
    RETURN NEW;
  END IF;
  IF lower(coalesce(NEW.potencial_financeiro, '')) NOT IN ('alto', 'médio', 'medio') THEN
    RETURN NEW;
  END IF;
  IF coalesce(NEW.status_abordagem, 'novo') <> 'novo' THEN
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
  UPDATE public.radar_consultoras
    SET total_leads_atribuidos = total_leads_atribuidos + 1
    WHERE id = alvo_id;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_atribuir_consultora ON public.do_registros;
CREATE TRIGGER trg_atribuir_consultora
  BEFORE INSERT ON public.do_registros
  FOR EACH ROW EXECUTE FUNCTION public.atribuir_consultora_automatico();