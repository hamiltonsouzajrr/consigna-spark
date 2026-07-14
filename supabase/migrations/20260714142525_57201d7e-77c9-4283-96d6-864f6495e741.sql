
ALTER TABLE public.do_registros
  ADD COLUMN IF NOT EXISTS idade integer,
  ADD COLUMN IF NOT EXISTS sexo text,
  ADD COLUMN IF NOT EXISTS score integer;

ALTER TABLE public.do_registros
  DROP CONSTRAINT IF EXISTS do_registros_sexo_check,
  ADD CONSTRAINT do_registros_sexo_check CHECK (sexo IS NULL OR sexo IN ('M','F','O'));

ALTER TABLE public.do_registros
  DROP CONSTRAINT IF EXISTS do_registros_score_check,
  ADD CONSTRAINT do_registros_score_check CHECK (score IS NULL OR (score >= 0 AND score <= 100));

ALTER TABLE public.do_registros
  DROP CONSTRAINT IF EXISTS do_registros_idade_check,
  ADD CONSTRAINT do_registros_idade_check CHECK (idade IS NULL OR (idade >= 0 AND idade <= 120));

ALTER TABLE public.radar_consultoras
  ADD COLUMN IF NOT EXISTS pref_idade_min integer,
  ADD COLUMN IF NOT EXISTS pref_idade_max integer,
  ADD COLUMN IF NOT EXISTS pref_sexos text[] NOT NULL DEFAULT ARRAY['M','F','O']::text[],
  ADD COLUMN IF NOT EXISTS pref_score_min integer NOT NULL DEFAULT 0;

ALTER TABLE public.radar_consultoras
  DROP CONSTRAINT IF EXISTS radar_consultoras_pref_score_check,
  ADD CONSTRAINT radar_consultoras_pref_score_check CHECK (pref_score_min >= 0 AND pref_score_min <= 100);

CREATE OR REPLACE FUNCTION public.atribuir_consultora_automatico()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  alvo_id uuid;
  alvo_nome text;
BEGIN
  IF NEW.consultora_responsavel IS NOT NULL THEN
    RETURN NEW;
  END IF;
  IF lower(coalesce(NEW.potencial_financeiro, '')) NOT IN ('alto', 'médio', 'medio') THEN
    RETURN NEW;
  END IF;
  IF coalesce(NEW.status_abordagem, 'novo') <> 'novo' THEN
    RETURN NEW;
  END IF;

  -- Escolhe a consultora ativa com menor carga cujas preferências aceitam o lead.
  -- Regra: quando o lead tem valor conhecido para idade/sexo/score, ele precisa
  -- casar com as preferências da consultora. Valores nulos no lead sempre passam.
  SELECT id, nome INTO alvo_id, alvo_nome
  FROM public.radar_consultoras
  WHERE ativo = true
    AND (NEW.sexo IS NULL OR NEW.sexo = ANY(pref_sexos))
    AND (NEW.idade IS NULL OR pref_idade_min IS NULL OR NEW.idade >= pref_idade_min)
    AND (NEW.idade IS NULL OR pref_idade_max IS NULL OR NEW.idade <= pref_idade_max)
    AND (NEW.score IS NULL OR NEW.score >= coalesce(pref_score_min, 0))
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
$function$;
