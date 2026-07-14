-- 1. Restrict SELECT to admins on sensitive Radar/Diario tables ----------
DROP POLICY IF EXISTS "do_registros select authenticated" ON public.do_registros;
CREATE POLICY "do_registros select admin"
  ON public.do_registros FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "do_arquivos select authenticated" ON public.do_arquivos;
CREATE POLICY "do_arquivos select admin"
  ON public.do_arquivos FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "Authenticated can view consultoras" ON public.radar_consultoras;
CREATE POLICY "Admins view consultoras"
  ON public.radar_consultoras FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- 2. diario_alertas: SELECT + write restricted to admins ------------------
DROP POLICY IF EXISTS "Autenticados leem alertas" ON public.diario_alertas;
DROP POLICY IF EXISTS "Autenticados inserem alertas" ON public.diario_alertas;
DROP POLICY IF EXISTS "Autenticados atualizam alertas" ON public.diario_alertas;

CREATE POLICY "Admins leem alertas"
  ON public.diario_alertas FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins inserem alertas"
  ON public.diario_alertas FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins atualizam alertas"
  ON public.diario_alertas FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- 3. diario_automacao_logs: SELECT + INSERT restricted to admins ----------
DROP POLICY IF EXISTS "Autenticados leem logs" ON public.diario_automacao_logs;
DROP POLICY IF EXISTS "Autenticados inserem logs" ON public.diario_automacao_logs;

CREATE POLICY "Admins leem logs"
  ON public.diario_automacao_logs FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins inserem logs"
  ON public.diario_automacao_logs FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- 4. Revoke EXECUTE on SECURITY DEFINER functions from anon/public --------
REVOKE EXECUTE ON FUNCTION public.has_role(uuid, app_role) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.has_role(uuid, app_role) TO authenticated, service_role;

REVOKE EXECUTE ON FUNCTION public.atribuir_consultora_automatico() FROM PUBLIC, anon, authenticated;
-- trigger runs with table owner privileges, no direct EXECUTE needed
