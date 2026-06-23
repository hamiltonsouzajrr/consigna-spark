-- Harden write access on Radar/Diário Oficial tables.
-- All legitimate app writes flow through authenticated server functions that use
-- the service-role client (which bypasses RLS), so restricting direct Data API
-- writes to admins blocks tampering without breaking the app.

-- ===== do_registros (PII: nome_servidor, cpf_parcial) =====
DROP POLICY IF EXISTS "do_registros insert authenticated" ON public.do_registros;
DROP POLICY IF EXISTS "do_registros update authenticated" ON public.do_registros;

CREATE POLICY "do_registros insert admin" ON public.do_registros
  FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "do_registros update admin" ON public.do_registros
  FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- ===== do_arquivos =====
DROP POLICY IF EXISTS "do_arquivos insert authenticated" ON public.do_arquivos;
DROP POLICY IF EXISTS "do_arquivos update authenticated" ON public.do_arquivos;

CREATE POLICY "do_arquivos insert admin" ON public.do_arquivos
  FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "do_arquivos update admin" ON public.do_arquivos
  FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- ===== fontes_diario_oficial =====
DROP POLICY IF EXISTS "Autenticados inserem fontes" ON public.fontes_diario_oficial;
DROP POLICY IF EXISTS "Autenticados atualizam fontes" ON public.fontes_diario_oficial;

CREATE POLICY "Admins inserem fontes" ON public.fontes_diario_oficial
  FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins atualizam fontes" ON public.fontes_diario_oficial
  FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- ===== radar_consultoras =====
DROP POLICY IF EXISTS "Authenticated can insert consultoras" ON public.radar_consultoras;
DROP POLICY IF EXISTS "Authenticated can update consultoras" ON public.radar_consultoras;
DROP POLICY IF EXISTS "Authenticated can delete consultoras" ON public.radar_consultoras;

CREATE POLICY "Admins insert consultoras" ON public.radar_consultoras
  FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins update consultoras" ON public.radar_consultoras
  FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins delete consultoras" ON public.radar_consultoras
  FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));