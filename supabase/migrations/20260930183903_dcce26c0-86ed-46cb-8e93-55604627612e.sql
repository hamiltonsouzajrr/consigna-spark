DROP POLICY IF EXISTS "Portal avisos readable by authenticated" ON public.rh_portal_avisos;
CREATE POLICY "Equipe cadastrada le avisos" ON public.rh_portal_avisos FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.profiles p WHERE p.user_id = auth.uid()) OR public.has_role(auth.uid(),'admin'));
DROP POLICY IF EXISTS "Portal atalhos readable by authenticated" ON public.rh_portal_atalhos;
CREATE POLICY "Equipe cadastrada le atalhos" ON public.rh_portal_atalhos FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.profiles p WHERE p.user_id = auth.uid()) OR public.has_role(auth.uid(),'admin'));
DROP POLICY IF EXISTS "Autenticados leem semanas da competicao" ON public.prospect_competicao_semanas;
CREATE POLICY "Equipe cadastrada le semanas" ON public.prospect_competicao_semanas FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.profiles p WHERE p.user_id = auth.uid()) OR public.has_role(auth.uid(),'admin'));