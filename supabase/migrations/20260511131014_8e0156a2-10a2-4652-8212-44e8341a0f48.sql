CREATE TABLE IF NOT EXISTS public.consigup_sessions (
  user_id uuid NOT NULL,
  slot smallint NOT NULL,
  cookies jsonb NOT NULL DEFAULT '{}'::jsonb,
  orgaos jsonb NOT NULL DEFAULT '[]'::jsonb,
  last_used_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, slot)
);

ALTER TABLE public.consigup_sessions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view own sessions"
  ON public.consigup_sessions FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users insert own sessions"
  ON public.consigup_sessions FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users update own sessions"
  ON public.consigup_sessions FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users delete own sessions"
  ON public.consigup_sessions FOR DELETE
  USING (auth.uid() = user_id);