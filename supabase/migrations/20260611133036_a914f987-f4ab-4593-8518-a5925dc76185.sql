DROP POLICY IF EXISTS "Authenticated manage rh_employees" ON public.rh_employees;
CREATE POLICY "Admins manage rh_employees" ON public.rh_employees
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

DROP POLICY IF EXISTS "Authenticated manage rh_benefits" ON public.rh_benefits;
CREATE POLICY "Admins manage rh_benefits" ON public.rh_benefits
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

DROP POLICY IF EXISTS "Authenticated manage rh_kpi_metrics" ON public.rh_kpi_metrics;
CREATE POLICY "Admins manage rh_kpi_metrics" ON public.rh_kpi_metrics
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

DROP POLICY IF EXISTS "Authenticated manage rh_vacation_requests" ON public.rh_vacation_requests;
CREATE POLICY "Admins manage rh_vacation_requests" ON public.rh_vacation_requests
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

DROP POLICY IF EXISTS "Authenticated manage wa_accounts" ON public.wa_accounts;
CREATE POLICY "Admins manage wa_accounts" ON public.wa_accounts
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

DROP POLICY IF EXISTS "Authenticated manage wa_contacts" ON public.wa_contacts;
CREATE POLICY "Admins manage wa_contacts" ON public.wa_contacts
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

DROP POLICY IF EXISTS "Authenticated manage wa_messages" ON public.wa_messages;
CREATE POLICY "Admins manage wa_messages" ON public.wa_messages
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));