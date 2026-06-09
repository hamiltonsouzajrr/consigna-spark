CREATE TABLE public.rh_reconhecimentos (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  de text NOT NULL,
  para text NOT NULL,
  tipo text NOT NULL,
  mensagem text NOT NULL,
  data date NOT NULL DEFAULT current_date,
  periodo_inicio date,
  periodo_fim date,
  popup boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.rh_reconhecimentos TO authenticated;
GRANT ALL ON public.rh_reconhecimentos TO service_role;

ALTER TABLE public.rh_reconhecimentos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone authenticated can view reconhecimentos"
  ON public.rh_reconhecimentos FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "Admins can insert reconhecimentos"
  ON public.rh_reconhecimentos FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can update reconhecimentos"
  ON public.rh_reconhecimentos FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can delete reconhecimentos"
  ON public.rh_reconhecimentos FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER set_rh_reconhecimentos_updated_at
  BEFORE UPDATE ON public.rh_reconhecimentos
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();