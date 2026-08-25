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
  el record;
  nome_base text;
  nome_final text;
  n integer;
BEGIN
  -- funde duplicados por e-mail (mantém quem tem mais leads / mais antigo)
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

  UPDATE public.radar_consultoras c
     SET email = e.email
    FROM _elegiveis e
   WHERE lower(c.nome) = lower(e.nome)
     AND (c.email IS NULL OR btrim(c.email) = '')
     AND NOT EXISTS (SELECT 1 FROM public.radar_consultoras c2
                      WHERE lower(btrim(c2.email)) = e.email);

  FOR el IN
    SELECT e.email, e.nome FROM _elegiveis e
    WHERE NOT EXISTS (SELECT 1 FROM public.radar_consultoras c
                       WHERE lower(btrim(c.email)) = e.email)
  LOOP
    nome_base := btrim(el.nome);
    IF nome_base = '' THEN nome_base := split_part(el.email, '@', 1); END IF;
    nome_final := nome_base;
    n := 0;
    WHILE EXISTS (SELECT 1 FROM public.radar_consultoras c WHERE lower(c.nome) = lower(nome_final)) LOOP
      n := n + 1;
      nome_final := CASE WHEN n = 1
                         THEN nome_base || ' (' || split_part(el.email, '@', 1) || ')'
                         ELSE nome_base || ' (' || split_part(el.email, '@', 1) || ' ' || n || ')' END;
    END LOOP;
    INSERT INTO public.radar_consultoras (nome, email, ativo) VALUES (nome_final, el.email, true);
    criadas := criadas + 1;
  END LOOP;

  UPDATE public.radar_consultoras c
     SET ativo = EXISTS (SELECT 1 FROM _elegiveis e WHERE e.email = lower(btrim(c.email)))
   WHERE c.ativo <> EXISTS (SELECT 1 FROM _elegiveis e WHERE e.email = lower(btrim(c.email)));

  UPDATE public.radar_consultoras c
     SET total_leads_atribuidos = (
       SELECT count(*) FROM public.do_registros d WHERE d.consultora_responsavel = c.nome
     );

  DROP TABLE IF EXISTS _elegiveis;
  RETURN criadas + afetadas;
END;
$function$;

REVOKE ALL ON FUNCTION public.sync_radar_consultoras() FROM anon, authenticated, PUBLIC;
GRANT EXECUTE ON FUNCTION public.sync_radar_consultoras() TO service_role;