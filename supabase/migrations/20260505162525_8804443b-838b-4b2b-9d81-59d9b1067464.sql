
CREATE TABLE public.processar_logs (
  id BIGSERIAL PRIMARY KEY,
  consulta_id UUID NOT NULL REFERENCES public.consultas_margem(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  level TEXT NOT NULL DEFAULT 'info',
  message TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_processar_logs_consulta ON public.processar_logs(consulta_id, id);

ALTER TABLE public.processar_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view own logs" ON public.processar_logs
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Service inserts logs" ON public.processar_logs
  FOR INSERT WITH CHECK (true);

ALTER PUBLICATION supabase_realtime ADD TABLE public.processar_logs;
ALTER TABLE public.processar_logs REPLICA IDENTITY FULL;
