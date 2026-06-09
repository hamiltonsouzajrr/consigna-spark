CREATE TABLE public.rh_desligamentos (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  colaborador text NOT NULL,
  cargo text,
  setor text,
  data_admissao date,
  data_desligamento date NOT NULL DEFAULT now(),
  responsavel text,
  tipo text NOT NULL DEFAULT 'Outros',
  motivo text,
  motivo_detalhado text NOT NULL,
  sinais_contratacao text NOT NULL,
  alertas_futuros text,
  criado_por uuid,
  editado_por uuid,
  historico jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.rh_desligamentos TO authenticated;
GRANT ALL ON public.rh_desligamentos TO service_role;

ALTER TABLE public.rh_desligamentos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins podem ver desligamentos"
  ON public.rh_desligamentos FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins podem inserir desligamentos"
  ON public.rh_desligamentos FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins podem atualizar desligamentos"
  ON public.rh_desligamentos FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins podem excluir desligamentos"
  ON public.rh_desligamentos FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER set_rh_desligamentos_updated_at
  BEFORE UPDATE ON public.rh_desligamentos
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();