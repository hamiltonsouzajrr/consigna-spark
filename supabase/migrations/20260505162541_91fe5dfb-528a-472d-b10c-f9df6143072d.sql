
DROP POLICY IF EXISTS "Service inserts logs" ON public.processar_logs;
CREATE POLICY "Service role inserts logs" ON public.processar_logs
  FOR INSERT WITH CHECK (auth.role() = 'service_role');
