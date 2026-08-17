CREATE OR REPLACE FUNCTION public.minha_consultora_nome()
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT c.nome
  FROM public.radar_consultoras c
  WHERE c.email IS NOT NULL
    AND lower(c.email) = lower((auth.jwt() ->> 'email'))
  LIMIT 1
$$;

REVOKE ALL ON FUNCTION public.minha_consultora_nome() FROM public;
GRANT EXECUTE ON FUNCTION public.minha_consultora_nome() TO authenticated, service_role;

DROP POLICY IF EXISTS "tomadores_al_select_auth" ON public.tomadores_al;

CREATE POLICY "tomadores_al_select_own_or_admin"
ON public.tomadores_al
FOR SELECT
TO authenticated
USING (
  has_role(auth.uid(), 'admin'::app_role)
  OR (
    consultora_responsavel IS NOT NULL
    AND consultora_responsavel = public.minha_consultora_nome()
  )
);