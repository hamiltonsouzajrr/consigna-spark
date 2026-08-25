REVOKE EXECUTE ON FUNCTION public.minha_consultora_nome() FROM anon;

DROP POLICY IF EXISTS "diario read authenticated" ON storage.objects;
CREATE POLICY "diario read admin or own folder" ON storage.objects
FOR SELECT TO authenticated
USING (
  bucket_id = 'diario-oficial'
  AND (
    public.has_role(auth.uid(), 'admin'::app_role)
    OR (storage.foldername(name))[1] = (auth.uid())::text
  )
);

DROP POLICY IF EXISTS "diario insert admin or own folder" ON storage.objects;
CREATE POLICY "diario insert own folder" ON storage.objects
FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'diario-oficial'
  AND (
    public.has_role(auth.uid(), 'admin'::app_role)
    OR (storage.foldername(name))[1] = (auth.uid())::text
  )
);