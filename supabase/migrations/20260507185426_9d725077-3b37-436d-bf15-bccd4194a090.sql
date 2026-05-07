
CREATE TABLE public.processar_runs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  status TEXT NOT NULL DEFAULT 'running',
  total INTEGER NOT NULL DEFAULT 0,
  processed INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.processar_runs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "users view own runs" ON public.processar_runs
  FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "users insert own runs" ON public.processar_runs
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "users update own runs" ON public.processar_runs
  FOR UPDATE TO authenticated USING (auth.uid() = user_id);

ALTER PUBLICATION supabase_realtime ADD TABLE public.processar_runs;
