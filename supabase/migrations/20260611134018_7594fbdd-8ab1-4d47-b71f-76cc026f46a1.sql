DROP POLICY IF EXISTS "Authenticated can read producao" ON public.rh_producao;
CREATE POLICY "Producao readable by admins" ON public.rh_producao
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role));