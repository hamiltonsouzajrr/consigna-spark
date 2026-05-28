CREATE TABLE public.pesquisas (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  tipo_busca TEXT NOT NULL,
  termo_busca TEXT NOT NULL,
  finalidade TEXT,
  resultado_json JSONB,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.pesquisas TO authenticated;
GRANT ALL ON public.pesquisas TO service_role;

ALTER TABLE public.pesquisas ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view own pesquisas"
ON public.pesquisas
FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "Users insert own pesquisas"
ON public.pesquisas
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users delete own pesquisas"
ON public.pesquisas
FOR DELETE
TO authenticated
USING (auth.uid() = user_id);

CREATE INDEX idx_pesquisas_user_created ON public.pesquisas (user_id, created_at DESC);