DROP POLICY IF EXISTS "Onboarding readable by authenticated" ON public.rh_onboarding;
CREATE POLICY "Onboarding readable by admins" ON public.rh_onboarding
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role));