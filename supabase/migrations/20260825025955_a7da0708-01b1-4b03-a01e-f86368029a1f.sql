-- Atividades: escrita apenas pelo servidor (server functions).
DROP POLICY IF EXISTS "Consultants insert own lead events" ON public.lead_events;
REVOKE INSERT, UPDATE, DELETE ON public.lead_events FROM authenticated;

-- Follow-ups: consultora pode concluir o seu, mas não criar direto do cliente.
DROP POLICY IF EXISTS "Consultants manage own tasks" ON public.lead_tasks;
CREATE POLICY "Consultants update own tasks"
  ON public.lead_tasks FOR UPDATE TO authenticated
  USING (consultant_id = auth.uid())
  WITH CHECK (consultant_id = auth.uid());
REVOKE INSERT, DELETE ON public.lead_tasks FROM authenticated;