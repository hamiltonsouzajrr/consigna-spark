DROP POLICY IF EXISTS "esteira_lotes_read_authenticated" ON public.esteira_lotes;
CREATE POLICY "esteira_lotes_admin_read"
ON public.esteira_lotes
FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "Autenticados podem ver meta padrao" ON public.prospect_metas_padrao;
CREATE POLICY "Admins podem ver meta padrao"
ON public.prospect_metas_padrao
FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));