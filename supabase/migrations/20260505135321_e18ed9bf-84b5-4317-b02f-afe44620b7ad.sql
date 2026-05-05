
CREATE TYPE consulta_status AS ENUM ('pendente', 'processando', 'concluido', 'erro');

CREATE TABLE public.consultas_margem (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  cpf TEXT NOT NULL,
  nome TEXT NOT NULL,
  margem_disponivel NUMERIC,
  status consulta_status NOT NULL DEFAULT 'pendente',
  erro TEXT,
  processed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_consultas_user ON public.consultas_margem(user_id);
CREATE INDEX idx_consultas_status ON public.consultas_margem(status);

ALTER TABLE public.consultas_margem ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view own consultas" ON public.consultas_margem
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users insert own consultas" ON public.consultas_margem
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users update own consultas" ON public.consultas_margem
  FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users delete own consultas" ON public.consultas_margem
  FOR DELETE USING (auth.uid() = user_id);

CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_consultas_updated
BEFORE UPDATE ON public.consultas_margem
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER PUBLICATION supabase_realtime ADD TABLE public.consultas_margem;
ALTER TABLE public.consultas_margem REPLICA IDENTITY FULL;
