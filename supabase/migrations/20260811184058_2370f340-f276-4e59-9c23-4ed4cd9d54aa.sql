DROP POLICY IF EXISTS "diario insert authenticated" ON storage.objects;

CREATE POLICY "diario insert admin or own folder"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'diario-oficial'
  AND (
    public.has_role(auth.uid(), 'admin')
    OR (storage.foldername(name))[1] = auth.uid()::text
  )
);