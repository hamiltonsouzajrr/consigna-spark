CREATE TABLE public.rh_ocorrencias (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  colaborador text NOT NULL,
  para_user_id uuid,
  tipo text NOT NULL DEFAULT 'Observação',
  data date NOT NULL DEFAULT current_date,
  descricao text NOT NULL,
  popup boolean NOT NULL DEFAULT true,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.rh_ocorrencias TO authenticated;
GRANT ALL ON public.rh_ocorrencias TO service_role;

ALTER TABLE public.rh_ocorrencias ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage ocorrencias"
ON public.rh_ocorrencias FOR ALL TO authenticated
USING (public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Consultora reads own elogios"
ON public.rh_ocorrencias FOR SELECT TO authenticated
USING (para_user_id = auth.uid() AND tipo = 'Elogio');

CREATE TRIGGER set_rh_ocorrencias_updated_at
BEFORE UPDATE ON public.rh_ocorrencias
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();