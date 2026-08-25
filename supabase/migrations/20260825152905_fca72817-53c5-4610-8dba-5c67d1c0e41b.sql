-- 1) Índice de apoio
CREATE INDEX IF NOT EXISTS idx_do_registros_consultora_data
  ON public.do_registros (consultora_responsavel, data_publicacao DESC);

-- 2) Sincronização/unificação do cadastro de consultoras
CREATE OR REPLACE FUNCTION public.sync_radar_consultoras()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  afetadas integer := 0;
  criadas integer := 0;
  dup record;
BEGIN
  -- 2.1 funde duplicados por e-mail (mantém quem tem mais leads / mais antigo)
  FOR dup IN
    WITH ranked AS (
      SELECT c.id, c.nome, lower(btrim(c.email)) AS em,
             row_number() OVER (
               PARTITION BY lower(btrim(c.email))
               ORDER BY (SELECT count(*) FROM public.do_registros d
                          WHERE d.consultora_responsavel = c.nome) DESC,
                        c.created_at ASC
             ) AS rn
      FROM public.radar_consultoras c
      WHERE c.email IS NOT NULL AND btrim(c.email) <> ''
    )
    SELECT r.id, r.nome, (SELECT k.nome FROM ranked k WHERE k.em = r.em AND k.rn = 1) AS canonico
    FROM ranked r
    WHERE r.rn > 1
  LOOP
    UPDATE public.do_registros SET consultora_responsavel = dup.canonico
     WHERE consultora_responsavel = dup.nome;
    UPDATE public.tomadores_al SET consultora_responsavel = dup.canonico
     WHERE consultora_responsavel = dup.nome;
    DELETE FROM public.radar_consultoras WHERE id = dup.id;
    afetadas := afetadas + 1;
  END LOOP;

  -- 2.2 contas elegíveis (não-admin, com e-mail)
  CREATE TEMP TABLE _elegiveis ON COMMIT DROP AS
  SELECT DISTINCT ON (lower(u.email))
         lower(u.email) AS email,
         coalesce(nullif(btrim(p.nome_completo), ''), split_part(u.email, '@', 1)) AS nome
  FROM auth.users u
  LEFT JOIN public.profiles p ON p.user_id = u.id
  WHERE u.email IS NOT NULL
    AND u.deleted_at IS NULL
    AND NOT EXISTS (
      SELECT 1 FROM public.user_roles r WHERE r.user_id = u.id AND r.role = 'admin'
    )
  ORDER BY lower(u.email), coalesce(u.last_sign_in_at, u.created_at) DESC NULLS LAST;

  -- 2.3 vincula cadastro sem e-mail cujo nome coincide
  UPDATE public.radar_consultoras c
     SET email = e.email
    FROM _elegiveis e
   WHERE lower(c.nome) = lower(e.nome)
     AND (c.email IS NULL OR btrim(c.email) = '')
     AND NOT EXISTS (SELECT 1 FROM public.radar_consultoras c2
                      WHERE lower(btrim(c2.email)) = e.email);

  -- 2.4 cria cadastro para contas ainda sem consultora
  WITH ins AS (
    INSERT INTO public.radar_consultoras (nome, email, ativo)
    SELECT CASE WHEN EXISTS (SELECT 1 FROM public.radar_consultoras c
                              WHERE lower(c.nome) = lower(e.nome))
                THEN e.nome || ' (' || split_part(e.email, '@', 1) || ')'
                ELSE e.nome END,
           e.email, true
    FROM _elegiveis e
    WHERE NOT EXISTS (SELECT 1 FROM public.radar_consultoras c
                       WHERE lower(btrim(c.email)) = e.email)
    RETURNING 1
  )
  SELECT count(*) INTO criadas FROM ins;

  -- 2.5 ativa quem tem conta, desativa quem não tem
  UPDATE public.radar_consultoras c
     SET ativo = EXISTS (SELECT 1 FROM _elegiveis e WHERE e.email = lower(btrim(c.email)))
   WHERE c.ativo <> EXISTS (SELECT 1 FROM _elegiveis e WHERE e.email = lower(btrim(c.email)));

  -- 2.6 contador alinhado com a carteira real
  UPDATE public.radar_consultoras c
     SET total_leads_atribuidos = (
       SELECT count(*) FROM public.do_registros d WHERE d.consultora_responsavel = c.nome
     );

  DROP TABLE IF EXISTS _elegiveis;
  RETURN criadas + afetadas;
END;
$function$;

-- 3) Redistribuição igualitária
CREATE OR REPLACE FUNCTION public.redistribuir_do_registros_igualmente(
  _janela_dias integer DEFAULT NULL,
  _incluir_abordados boolean DEFAULT false
)
RETURNS TABLE(atribuidos integer, consultoras integer)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  qtd integer := 0;
  total integer := 0;
BEGIN
  PERFORM public.sync_radar_consultoras();

  CREATE TEMP TABLE _alvos ON COMMIT DROP AS
  SELECT c.nome, (row_number() OVER (ORDER BY c.created_at, c.nome) - 1) AS idx
  FROM public.radar_consultoras c
  WHERE c.ativo = true
    AND btrim(coalesce(c.nome, '')) <> ''
    AND EXISTS (SELECT 1 FROM auth.users u
                 WHERE u.deleted_at IS NULL AND lower(u.email) = lower(btrim(c.email)));

  SELECT count(*) INTO qtd FROM _alvos;
  IF qtd = 0 THEN
    RETURN QUERY SELECT 0, 0;
    RETURN;
  END IF;

  WITH regs AS (
    SELECT d.id,
           (row_number() OVER (ORDER BY d.data_publicacao DESC NULLS LAST, d.created_at DESC)) - 1 AS rn
    FROM public.do_registros d
    WHERE (_janela_dias IS NULL OR d.data_publicacao >= current_date - _janela_dias)
      AND (_incluir_abordados OR coalesce(d.status_abordagem, 'novo') = 'novo')
  ), upd AS (
    UPDATE public.do_registros d
       SET consultora_responsavel = a.nome,
           atribuido_em = now()
      FROM regs r
      JOIN _alvos a ON a.idx = (r.rn % qtd)
     WHERE d.id = r.id
       AND coalesce(d.consultora_responsavel, '') <> a.nome
    RETURNING 1
  )
  SELECT count(*) INTO total FROM upd;

  UPDATE public.radar_consultoras c
     SET total_leads_atribuidos = (
       SELECT count(*) FROM public.do_registros d WHERE d.consultora_responsavel = c.nome
     );

  DROP TABLE IF EXISTS _alvos;
  RETURN QUERY SELECT total, qtd;
END;
$function$;

-- 4) Rodízio dos pendentes por carga real e apenas com conta no sistema
CREATE OR REPLACE FUNCTION public.distribuir_do_registros_pendentes(_limit integer DEFAULT 2000)
RETURNS TABLE(atribuidos integer, consultoras integer)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  reg record;
  alvo record;
  total integer := 0;
  qtd integer := 0;
  novos record;
BEGIN
  PERFORM public.sync_radar_consultoras();

  CREATE TEMP TABLE _carga ON COMMIT DROP AS
  SELECT c.nome,
         (SELECT count(*) FROM public.do_registros d WHERE d.consultora_responsavel = c.nome)::int AS carga,
         c.created_at
  FROM public.radar_consultoras c
  WHERE c.ativo = true
    AND btrim(coalesce(c.nome, '')) <> ''
    AND EXISTS (SELECT 1 FROM auth.users u
                 WHERE u.deleted_at IS NULL AND lower(u.email) = lower(btrim(c.email)));

  SELECT count(*) INTO qtd FROM _carga;
  IF qtd = 0 THEN
    RETURN QUERY SELECT 0, 0;
    RETURN;
  END IF;

  CREATE TEMP TABLE _dist_tmp (consultora text, qtd integer) ON COMMIT DROP;

  FOR reg IN
    SELECT id FROM public.do_registros
    WHERE consultora_responsavel IS NULL
    ORDER BY data_publicacao DESC NULLS LAST, created_at DESC
    LIMIT _limit
  LOOP
    SELECT nome INTO alvo FROM _carga ORDER BY carga ASC, created_at ASC, nome ASC LIMIT 1;
    EXIT WHEN alvo.nome IS NULL;

    UPDATE public.do_registros
       SET consultora_responsavel = alvo.nome, atribuido_em = now()
     WHERE id = reg.id;
    UPDATE _carga SET carga = carga + 1 WHERE nome = alvo.nome;
    INSERT INTO _dist_tmp (consultora, qtd) VALUES (alvo.nome, 1);
    total := total + 1;
  END LOOP;

  UPDATE public.radar_consultoras c
     SET total_leads_atribuidos = (
       SELECT count(*) FROM public.do_registros d WHERE d.consultora_responsavel = c.nome
     );

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

  RETURN QUERY SELECT total, qtd;
END;
$function$;

-- 5) Trigger de atribuição imediata usando carga real + conta existente
CREATE OR REPLACE FUNCTION public.atribuir_consultora_automatico()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  alvo_nome text;
BEGIN
  IF NEW.consultora_responsavel IS NOT NULL THEN
    RETURN NEW;
  END IF;

  SELECT c.nome INTO alvo_nome
  FROM public.radar_consultoras c
  WHERE c.ativo = true
    AND btrim(coalesce(c.nome, '')) <> ''
    AND EXISTS (SELECT 1 FROM auth.users u
                 WHERE u.deleted_at IS NULL AND lower(u.email) = lower(btrim(c.email)))
  ORDER BY (SELECT count(*) FROM public.do_registros d WHERE d.consultora_responsavel = c.nome) ASC,
           c.created_at ASC, c.nome ASC
  LIMIT 1;

  IF alvo_nome IS NULL THEN
    RETURN NEW;
  END IF;

  NEW.consultora_responsavel := alvo_nome;
  NEW.atribuido_em := now();
  UPDATE public.radar_consultoras
     SET total_leads_atribuidos = total_leads_atribuidos + 1
   WHERE nome = alvo_nome;

  RETURN NEW;
END;
$function$;