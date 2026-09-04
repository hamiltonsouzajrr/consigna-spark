ALTER TABLE public.lead_events
  ALTER COLUMN lead_id DROP NOT NULL,
  ADD COLUMN IF NOT EXISTS tomador_id uuid REFERENCES public.tomadores_al(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS origem text NOT NULL DEFAULT 'crm';

ALTER TABLE public.lead_events
  DROP CONSTRAINT IF EXISTS lead_events_origem_check;
ALTER TABLE public.lead_events
  ADD CONSTRAINT lead_events_origem_check CHECK (origem IN ('crm','tomadores_al'));

ALTER TABLE public.lead_events
  DROP CONSTRAINT IF EXISTS lead_events_ref_check;
ALTER TABLE public.lead_events
  ADD CONSTRAINT lead_events_ref_check CHECK (
    (lead_id IS NOT NULL AND tomador_id IS NULL)
    OR (lead_id IS NULL AND tomador_id IS NOT NULL)
  );

CREATE INDEX IF NOT EXISTS lead_events_consultant_created_idx
  ON public.lead_events (consultant_id, created_at DESC);
CREATE INDEX IF NOT EXISTS lead_events_tomador_created_idx
  ON public.lead_events (tomador_id, created_at DESC);

DROP POLICY IF EXISTS "Consultants view own lead events" ON public.lead_events;
CREATE POLICY "Consultants view own lead events"
  ON public.lead_events
  FOR SELECT
  TO authenticated
  USING (
    consultant_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.prospect_leads l
       WHERE l.id = lead_events.lead_id AND l.consultant_id = auth.uid()
    )
    OR EXISTS (
      SELECT 1 FROM public.tomadores_al t
       WHERE t.id = lead_events.tomador_id
         AND t.consultora_responsavel = public.minha_consultora_nome()
    )
  );