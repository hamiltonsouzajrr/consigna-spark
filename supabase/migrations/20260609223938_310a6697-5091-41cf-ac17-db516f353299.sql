-- Profile photo per authenticated user (consultant self-service)
CREATE TABLE public.rh_portal_profiles (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  foto_path text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.rh_portal_profiles TO authenticated;
GRANT ALL ON public.rh_portal_profiles TO service_role;

ALTER TABLE public.rh_portal_profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage their own profile"
  ON public.rh_portal_profiles FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE TRIGGER set_rh_portal_profiles_updated_at
  BEFORE UPDATE ON public.rh_portal_profiles
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Storage policies: each user manages files inside a folder named after their uid
CREATE POLICY "Portal avatars - read own"
  ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'portal-avatars' AND (storage.foldername(name))[1] = auth.uid()::text);

CREATE POLICY "Portal avatars - insert own"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'portal-avatars' AND (storage.foldername(name))[1] = auth.uid()::text);

CREATE POLICY "Portal avatars - update own"
  ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'portal-avatars' AND (storage.foldername(name))[1] = auth.uid()::text);

CREATE POLICY "Portal avatars - delete own"
  ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'portal-avatars' AND (storage.foldername(name))[1] = auth.uid()::text);