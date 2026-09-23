CREATE TABLE public.rockdata_consultas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  cpf text NOT NULL UNIQUE,
  nome text,
  resultado jsonb NOT NULL DEFAULT '{}'::jsonb,
  consultado_em timestamptz NOT NULL DEFAULT now(),
  consultado_por uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.rockdata_consultas TO authenticated;
GRANT ALL ON public.rockdata_consultas TO service_role;

ALTER TABLE public.rockdata_consultas ENABLE ROW LEVEL SECURITY;

CREATE POLICY "rockdata_consultas_select_auth" ON public.rockdata_consultas
  FOR SELECT TO authenticated USING (true);

CREATE INDEX idx_rockdata_consultas_nome_trgm ON public.rockdata_consultas USING gin (nome gin_trgm_ops);
CREATE INDEX idx_rockdata_consultas_consultado_em ON public.rockdata_consultas (consultado_em DESC);

CREATE TRIGGER rockdata_consultas_set_updated_at
  BEFORE UPDATE ON public.rockdata_consultas
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE public.rockdata_consultas_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  termo text NOT NULL,
  tipo text NOT NULL,
  origem text NOT NULL,
  cpf text,
  nome text,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.rockdata_consultas_log TO authenticated;
GRANT ALL ON public.rockdata_consultas_log TO service_role;

ALTER TABLE public.rockdata_consultas_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "rockdata_log_select_own" ON public.rockdata_consultas_log
  FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));

CREATE INDEX idx_rockdata_log_user ON public.rockdata_consultas_log (user_id, created_at DESC);