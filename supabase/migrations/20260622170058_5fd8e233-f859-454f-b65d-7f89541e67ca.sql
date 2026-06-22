CREATE POLICY "diario read authenticated" ON storage.objects
  FOR SELECT TO authenticated USING (bucket_id = 'diario-oficial');
CREATE POLICY "diario insert authenticated" ON storage.objects
  FOR INSERT TO authenticated WITH CHECK (bucket_id = 'diario-oficial');
CREATE POLICY "diario delete admin" ON storage.objects
  FOR DELETE TO authenticated USING (bucket_id = 'diario-oficial' AND public.has_role(auth.uid(), 'admin'));