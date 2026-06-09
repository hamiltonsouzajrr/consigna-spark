CREATE TABLE public.rh_producao (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  consultora text NOT NULL,
  departamento text,
  mes text NOT NULL,
  valor numeric NOT NULL DEFAULT 0,
  contratos integer NOT NULL DEFAULT 0,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (consultora, mes)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.rh_producao TO authenticated;
GRANT ALL ON public.rh_producao TO service_role;

ALTER TABLE public.rh_producao ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can read producao"
  ON public.rh_producao FOR SELECT TO authenticated USING (true);

CREATE POLICY "Admins can insert producao"
  ON public.rh_producao FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can update producao"
  ON public.rh_producao FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can delete producao"
  ON public.rh_producao FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER set_rh_producao_updated_at
  BEFORE UPDATE ON public.rh_producao
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();