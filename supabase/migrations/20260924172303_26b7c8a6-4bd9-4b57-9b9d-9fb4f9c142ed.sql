CREATE TABLE public.prospect_calculos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  lead_id uuid NOT NULL REFERENCES public.prospect_leads(id) ON DELETE CASCADE,
  calculadora text NOT NULL CHECK (calculadora IN ('bancos', 'contracheque', 'banese')),
  entradas jsonb NOT NULL DEFAULT '{}'::jsonb,
  resultado jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.prospect_calculos TO authenticated;
GRANT ALL ON public.prospect_calculos TO service_role;
ALTER TABLE public.prospect_calculos ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Consultoras gerenciam os proprios calculos"
ON public.prospect_calculos FOR ALL TO authenticated
USING (user_id = auth.uid())
WITH CHECK (user_id = auth.uid());
CREATE POLICY "Administradores consultam todos os calculos"
ON public.prospect_calculos FOR SELECT TO authenticated
USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'gestor_acessos'));
CREATE INDEX prospect_calculos_lead_created_idx ON public.prospect_calculos (lead_id, created_at DESC);
CREATE INDEX prospect_calculos_user_created_idx ON public.prospect_calculos (user_id, created_at DESC);
CREATE TRIGGER prospect_calculos_set_updated_at
BEFORE UPDATE ON public.prospect_calculos
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();