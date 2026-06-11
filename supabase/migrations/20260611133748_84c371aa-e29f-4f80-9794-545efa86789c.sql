DROP POLICY IF EXISTS "Portal kpis readable by authenticated" ON public.rh_portal_kpis;
CREATE POLICY "Portal kpis readable by admins" ON public.rh_portal_kpis
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role));

DROP POLICY IF EXISTS "Candidatos readable by authenticated" ON public.rh_candidatos;
CREATE POLICY "Candidatos readable by admins" ON public.rh_candidatos
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role));

DROP POLICY IF EXISTS "Anyone authenticated can view reconhecimentos" ON public.rh_reconhecimentos;
CREATE POLICY "Reconhecimentos readable by admins" ON public.rh_reconhecimentos
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role));