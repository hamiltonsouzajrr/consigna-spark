CREATE TABLE public.rh_onboarding (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  colaborador text NOT NULL,
  tarefas jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.rh_onboarding TO authenticated;
GRANT ALL ON public.rh_onboarding TO service_role;

ALTER TABLE public.rh_onboarding ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Onboarding readable by authenticated"
ON public.rh_onboarding FOR SELECT TO authenticated USING (true);

CREATE POLICY "Admins manage onboarding"
ON public.rh_onboarding FOR ALL TO authenticated
USING (public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER set_rh_onboarding_updated_at
BEFORE UPDATE ON public.rh_onboarding
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();