CREATE TABLE public.profiles (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL UNIQUE,
  nome_completo text NOT NULL,
  cpf text NOT NULL,
  email text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT profiles_cpf_digits CHECK (cpf ~ '^[0-9]{11}$')
);

CREATE UNIQUE INDEX profiles_cpf_key ON public.profiles (cpf);

GRANT SELECT, UPDATE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "profiles select own" ON public.profiles
  FOR SELECT TO authenticated USING (auth.uid() = user_id);

CREATE POLICY "profiles select admin" ON public.profiles
  FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "profiles update own" ON public.profiles
  FOR UPDATE TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE TRIGGER set_profiles_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.radar_consultoras ADD COLUMN IF NOT EXISTS cpf text;