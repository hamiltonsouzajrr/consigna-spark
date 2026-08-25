CREATE OR REPLACE FUNCTION public.sync_radar_consultoras()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  criadas integer := 0;
  vinculadas integer := 0;
BEGIN
  CREATE TEMP TABLE _elegiveis ON COMMIT DROP AS
  SELECT DISTINCT ON (lower(nome)) nome, email
  FROM (
    SELECT lower(u.email) AS email,
           coalesce(nullif(btrim(p.nome_completo), ''), split_part(u.email, '@', 1)) AS nome,
           coalesce(u.last_sign_in_at, u.created_at) AS ord
    FROM auth.users u
    LEFT JOIN public.profiles p ON p.user_id = u.id
    WHERE u.email IS NOT NULL
      AND u.deleted_at IS NULL
      AND NOT EXISTS (
        SELECT 1 FROM public.user_roles r
        WHERE r.user_id = u.id AND r.role = 'admin'
      )
  ) s
  ORDER BY lower(nome), ord DESC NULLS LAST;

  -- Consultora já cadastrada com o mesmo nome e sem e-mail: apenas vincula.
  WITH upd AS (
    UPDATE public.radar_consultoras c
       SET email = e.email, ativo = true
      FROM _elegiveis e
     WHERE lower(c.nome) = lower(e.nome)
       AND (c.email IS NULL OR btrim(c.email) = '')
       AND NOT EXISTS (
         SELECT 1 FROM public.radar_consultoras c2 WHERE lower(c2.email) = e.email
       )
    RETURNING 1
  )
  SELECT count(*) INTO vinculadas FROM upd;

  WITH ins AS (
    INSERT INTO public.radar_consultoras (nome, email, ativo)
    SELECT e.nome, e.email, true
    FROM _elegiveis e
    WHERE NOT EXISTS (
      SELECT 1 FROM public.radar_consultoras c
       WHERE lower(c.email) = e.email OR lower(c.nome) = lower(e.nome)
    )
    RETURNING 1
  )
  SELECT count(*) INTO criadas FROM ins;

  DROP TABLE IF EXISTS _elegiveis;
  RETURN criadas + vinculadas;
END;
$function$;

REVOKE EXECUTE ON FUNCTION public.sync_radar_consultoras() FROM authenticated, anon;