CREATE TABLE public.pesquisas_nv (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL,
  documento text NOT NULL,
  tipo text NOT NULL DEFAULT 'PF',
  nome text,
  resultado jsonb,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.pesquisas_nv TO authenticated;
GRANT ALL ON public.pesquisas_nv TO service_role;

ALTER TABLE public.pesquisas_nv ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view own pesquisas"
  ON public.pesquisas_nv FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users insert own pesquisas"
  ON public.pesquisas_nv FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users delete own pesquisas"
  ON public.pesquisas_nv FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

CREATE INDEX idx_pesquisas_nv_user_created ON public.pesquisas_nv (user_id, created_at DESC);