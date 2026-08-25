CREATE OR REPLACE FUNCTION public.sync_radar_consultoras()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
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
  ),
  -- 1) Consultora já cadastrada com o mesmo nome mas sem e-mail vinculado:
  --    apenas vincula o e-mail da conta e reativa.
  vinculadas AS (
    UPDATE public.radar_consultoras c
       SET email = e.email, ativo = true
      FROM elegiveis e
     WHERE lower(c.nome) = lower(e.nome)
       AND (c.email IS NULL OR btrim(c.email) = '')
       AND NOT EXISTS (
         SELECT 1 FROM public.radar_consultoras c2 WHERE lower(c2.email) = e.email
       )
    RETURNING 1
  ),
  -- 2) Contas sem consultora correspondente (por e-mail ou por nome): cria.
  ins AS (
    INSERT INTO public.radar_consultoras (nome, email, ativo)
    SELECT e.nome, e.email, true
    FROM elegiveis e
    WHERE NOT EXISTS (
      SELECT 1 FROM public.radar_consultoras c
       WHERE lower(c.email) = e.email OR lower(c.nome) = lower(e.nome)
    )
    RETURNING 1
  )
  SELECT (SELECT count(*) FROM ins) + (SELECT count(*) FROM vinculadas) INTO criadas;

  RETURN criadas;
END;
$function$;

REVOKE EXECUTE ON FUNCTION public.sync_radar_consultoras() FROM authenticated, anon;