-- consigup_sessions: re-scope policies to authenticated only
DROP POLICY IF EXISTS "Users delete own sessions" ON public.consigup_sessions;
DROP POLICY IF EXISTS "Users insert own sessions" ON public.consigup_sessions;
DROP POLICY IF EXISTS "Users update own sessions" ON public.consigup_sessions;
DROP POLICY IF EXISTS "Users view own sessions" ON public.consigup_sessions;

CREATE POLICY "Users view own sessions" ON public.consigup_sessions
  FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users insert own sessions" ON public.consigup_sessions
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users update own sessions" ON public.consigup_sessions
  FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users delete own sessions" ON public.consigup_sessions
  FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- consultas_margem: re-scope policies to authenticated only
DROP POLICY IF EXISTS "Users delete own consultas" ON public.consultas_margem;
DROP POLICY IF EXISTS "Users insert own consultas" ON public.consultas_margem;
DROP POLICY IF EXISTS "Users update own consultas" ON public.consultas_margem;
DROP POLICY IF EXISTS "Users view own consultas" ON public.consultas_margem;

CREATE POLICY "Users view own consultas" ON public.consultas_margem
  FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users insert own consultas" ON public.consultas_margem
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users update own consultas" ON public.consultas_margem
  FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users delete own consultas" ON public.consultas_margem
  FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- processar_logs: re-scope user policies to authenticated; keep service role insert
DROP POLICY IF EXISTS "Users delete own logs" ON public.processar_logs;
DROP POLICY IF EXISTS "Users view own logs" ON public.processar_logs;

CREATE POLICY "Users view own logs" ON public.processar_logs
  FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users delete own logs" ON public.processar_logs
  FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- Lock down direct execution of SECURITY DEFINER helper functions.
-- Trigger function: no client needs to call it directly.
REVOKE ALL ON FUNCTION public.set_updated_at() FROM PUBLIC, anon, authenticated;
-- Run-counter mutator: only the service role should call it.
REVOKE ALL ON FUNCTION public.bump_run_counters(uuid, integer, integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.bump_run_counters(uuid, integer, integer) TO service_role;