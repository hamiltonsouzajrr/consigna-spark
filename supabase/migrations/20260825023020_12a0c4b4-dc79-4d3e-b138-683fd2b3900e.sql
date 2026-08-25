ALTER TABLE public.do_registros
  ADD COLUMN IF NOT EXISTS cpf_confirmado text,
  ADD COLUMN IF NOT EXISTS cpf_validado_em timestamptz,
  ADD COLUMN IF NOT EXISTS cpf_validado_por uuid;

CREATE INDEX IF NOT EXISTS idx_do_registros_resp_data
  ON public.do_registros (consultora_responsavel, data_publicacao DESC);
CREATE INDEX IF NOT EXISTS idx_do_registros_pendentes
  ON public.do_registros (created_at DESC)
  WHERE consultora_responsavel IS NULL;
CREATE INDEX IF NOT EXISTS idx_do_registros_status_abordagem
  ON public.do_registros (status_abordagem);

-- Sincroniza o cadastro de consultoras a partir das contas do sistema:
-- toda conta que NÃO é admin vira consultora ativa; contas inexistentes saem.
CREATE OR REPLACE FUNCTION public.sync_radar_consultoras()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  criadas integer := 0;
BEGIN
  WITH elegiveis AS (
    SELECT u.id,
           lower(u.email) AS email,
           coalesce(nullif(btrim(p.nome_completo), ''), split_part(u.email, '@', 1)) AS nome
    FROM auth.users u
    LEFT JOIN public.profiles p ON p.user_id = u.id
    WHERE u.email IS NOT NULL
      AND u.deleted_at IS NULL
      AND NOT EXISTS (
        SELECT 1 FROM public.user_roles r
        WHERE r.user_id = u.id AND r.role = 'admin'
      )
  ), ins AS (
    INSERT INTO public.radar_consultoras (nome, email, ativo)
    SELECT e.nome, e.email, true
    FROM elegiveis e
    WHERE NOT EXISTS (
      SELECT 1 FROM public.radar_consultoras c WHERE lower(c.email) = e.email
    )
    RETURNING 1
  )
  SELECT count(*) INTO criadas FROM ins;

  -- Reativa quem voltou a ter conta válida.
  UPDATE public.radar_consultoras c
     SET ativo = true
   WHERE c.ativo = false
     AND c.email IS NOT NULL
     AND EXISTS (
       SELECT 1 FROM auth.users u
       WHERE lower(u.email) = lower(c.email)
         AND u.deleted_at IS NULL
         AND NOT EXISTS (SELECT 1 FROM public.user_roles r WHERE r.user_id = u.id AND r.role = 'admin')
     );

  -- Desativa quem não tem mais conta no sistema (ou virou admin).
  UPDATE public.radar_consultoras c
     SET ativo = false
   WHERE c.ativo = true
     AND (
       c.email IS NULL
       OR NOT EXISTS (
         SELECT 1 FROM auth.users u
         WHERE lower(u.email) = lower(c.email)
           AND u.deleted_at IS NULL
           AND NOT EXISTS (SELECT 1 FROM public.user_roles r WHERE r.user_id = u.id AND r.role = 'admin')
       )
     );

  RETURN criadas;
END;
$$;

REVOKE ALL ON FUNCTION public.sync_radar_consultoras() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.sync_radar_consultoras() TO authenticated, service_role;

-- Distribui em rodízio justo todos os registros sem responsável e avisa cada
-- consultora por notificação interna.
CREATE OR REPLACE FUNCTION public.distribuir_do_registros_pendentes(_limit integer DEFAULT 2000)
RETURNS TABLE (atribuidos integer, consultoras integer)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  reg record;
  alvo record;
  total integer := 0;
  qtd_consultoras integer := 0;
  novos record;
BEGIN
  PERFORM public.sync_radar_consultoras();

  SELECT count(*) INTO qtd_consultoras
  FROM public.radar_consultoras WHERE ativo = true AND btrim(coalesce(nome,'')) <> '';

  IF qtd_consultoras = 0 THEN
    RETURN QUERY SELECT 0, 0;
    RETURN;
  END IF;

  CREATE TEMP TABLE IF NOT EXISTS _dist_tmp (consultora text, qtd integer) ON COMMIT DROP;
  DELETE FROM _dist_tmp;

  FOR reg IN
    SELECT id, idade, sexo, score
    FROM public.do_registros
    WHERE consultora_responsavel IS NULL
    ORDER BY CASE lower(coalesce(potencial_financeiro,''))
               WHEN 'alto' THEN 0 WHEN 'médio' THEN 1 WHEN 'medio' THEN 1 ELSE 2 END,
             data_publicacao DESC NULLS LAST,
             created_at DESC
    LIMIT _limit
  LOOP
    SELECT id, nome INTO alvo
    FROM public.radar_consultoras
    WHERE ativo = true
      AND btrim(coalesce(nome,'')) <> ''
      AND (reg.sexo IS NULL OR reg.sexo = ANY(pref_sexos))
      AND (reg.idade IS NULL OR pref_idade_min IS NULL OR reg.idade >= pref_idade_min)
      AND (reg.idade IS NULL OR pref_idade_max IS NULL OR reg.idade <= pref_idade_max)
      AND (reg.score IS NULL OR reg.score >= coalesce(pref_score_min, 0))
    ORDER BY total_leads_atribuidos ASC, created_at ASC
    LIMIT 1;

    IF alvo.id IS NULL THEN
      CONTINUE;
    END IF;

    UPDATE public.do_registros
       SET consultora_responsavel = alvo.nome
     WHERE id = reg.id;

    UPDATE public.radar_consultoras
       SET total_leads_atribuidos = total_leads_atribuidos + 1
     WHERE id = alvo.id;

    INSERT INTO _dist_tmp (consultora, qtd) VALUES (alvo.nome, 1);
    total := total + 1;
  END LOOP;

  FOR novos IN
    SELECT t.consultora, sum(t.qtd)::int AS qtd, u.id AS user_id
    FROM _dist_tmp t
    JOIN public.radar_consultoras c ON c.nome = t.consultora
    JOIN auth.users u ON lower(u.email) = lower(c.email)
    GROUP BY t.consultora, u.id
  LOOP
    INSERT INTO public.rh_notifications (user_id, title, body)
    VALUES (
      novos.user_id,
      novos.qtd || ' novos promovidos na sua carteira',
      'O Radar Diário Oficial entregou ' || novos.qtd || ' lead(s) recém promovido(s). Fale nas primeiras 48h para aproveitar a janela de ouro.'
    );
  END LOOP;

  RETURN QUERY SELECT total, qtd_consultoras;
END;
$$;

REVOKE ALL ON FUNCTION public.distribuir_do_registros_pendentes(integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.distribuir_do_registros_pendentes(integer) TO authenticated, service_role;

-- Passa a atribuir TODO registro novo (não só Alto/Médio potencial).
CREATE OR REPLACE FUNCTION public.atribuir_consultora_automatico()
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
  IF coalesce(NEW.status_abordagem, 'novo') <> 'novo' THEN
    RETURN NEW;
  END IF;

  SELECT id, nome INTO alvo_id, alvo_nome
  FROM public.radar_consultoras
  WHERE ativo = true
    AND btrim(coalesce(nome,'')) <> ''
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
$$;