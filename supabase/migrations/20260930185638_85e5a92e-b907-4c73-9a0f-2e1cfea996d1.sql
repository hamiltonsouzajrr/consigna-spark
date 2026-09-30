DROP POLICY "Vagas readable by authenticated" ON public.rh_vagas;
CREATE POLICY "Equipe cadastrada le vagas" ON public.rh_vagas FOR SELECT TO authenticated
USING (EXISTS (SELECT 1 FROM public.profiles p WHERE p.user_id = auth.uid()) OR public.has_role(auth.uid(), 'admin'));
DROP POLICY "Autenticados leem pontos" ON public.prospect_pontos;
CREATE POLICY "Equipe cadastrada le pontos" ON public.prospect_pontos FOR SELECT TO authenticated
USING (EXISTS (SELECT 1 FROM public.profiles p WHERE p.user_id = auth.uid()) OR public.has_role(auth.uid(), 'admin'));