CREATE TABLE public.rh_vagas (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  titulo text NOT NULL,
  departamento text NOT NULL DEFAULT 'Comercial',
  status text NOT NULL DEFAULT 'Aberta',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.rh_vagas TO authenticated;
GRANT ALL ON public.rh_vagas TO service_role;

ALTER TABLE public.rh_vagas ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Vagas readable by authenticated"
ON public.rh_vagas FOR SELECT TO authenticated USING (true);

CREATE POLICY "Admins manage vagas"
ON public.rh_vagas FOR ALL TO authenticated
USING (public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER set_rh_vagas_updated_at
BEFORE UPDATE ON public.rh_vagas
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE public.rh_candidatos (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  nome text NOT NULL,
  vaga_id uuid REFERENCES public.rh_vagas(id) ON DELETE SET NULL,
  etapa text NOT NULL DEFAULT 'Triagem',
  email text,
  telefone text,
  fit integer NOT NULL DEFAULT 80,
  notas text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.rh_candidatos TO authenticated;
GRANT ALL ON public.rh_candidatos TO service_role;

ALTER TABLE public.rh_candidatos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Candidatos readable by authenticated"
ON public.rh_candidatos FOR SELECT TO authenticated USING (true);

CREATE POLICY "Admins manage candidatos"
ON public.rh_candidatos FOR ALL TO authenticated
USING (public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER set_rh_candidatos_updated_at
BEFORE UPDATE ON public.rh_candidatos
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();