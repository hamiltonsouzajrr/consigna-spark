ALTER TABLE public.lead_tasks
  ALTER COLUMN lead_id DROP NOT NULL,
  ADD COLUMN IF NOT EXISTS tomador_id uuid REFERENCES public.tomadores_al(id) ON DELETE CASCADE;

ALTER TABLE public.lead_tasks
  DROP CONSTRAINT IF EXISTS lead_tasks_exatamente_um_cliente_check,
  ADD CONSTRAINT lead_tasks_exatamente_um_cliente_check CHECK (num_nonnulls(lead_id, tomador_id) = 1);

CREATE INDEX IF NOT EXISTS idx_lead_tasks_tomador_pending_due ON public.lead_tasks(tomador_id, due_at) WHERE status = 'pending';

GRANT SELECT, INSERT, UPDATE, DELETE ON public.lead_tasks TO authenticated;
GRANT ALL ON public.lead_tasks TO service_role;