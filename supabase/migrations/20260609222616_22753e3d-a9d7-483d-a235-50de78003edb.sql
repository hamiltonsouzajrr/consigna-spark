CREATE TABLE public.rh_clima_responses (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL,
  week_start date NOT NULL,
  answers jsonb NOT NULL DEFAULT '{}'::jsonb,
  comment text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, week_start)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.rh_clima_responses TO authenticated;
GRANT ALL ON public.rh_clima_responses TO service_role;

ALTER TABLE public.rh_clima_responses ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users insert own clima response"
  ON public.rh_clima_responses FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users update own clima response"
  ON public.rh_clima_responses FOR UPDATE TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users view own clima response"
  ON public.rh_clima_responses FOR SELECT TO authenticated
  USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER set_rh_clima_responses_updated_at
  BEFORE UPDATE ON public.rh_clima_responses
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();