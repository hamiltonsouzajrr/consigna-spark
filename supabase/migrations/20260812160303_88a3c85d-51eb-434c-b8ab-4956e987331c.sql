CREATE TABLE public.tomadores_al (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  nome text NOT NULL,
  documento text NOT NULL,
  descricao_cargo text,
  descricao_lotacao text,
  dt_nascimento date,
  orgao text,
  matricula text,
  margem_bruta_cartao_credito numeric,
  margem_bruta_emprestimo numeric,
  margem_disp_cartao_credito numeric,
  margem_disp_emprestimo numeric,
  margem_util_cartao_beneficio numeric,
  margem_util_cartao_credito numeric,
  margem_util_emprestimo numeric,
  pct_utilizado_emprestimo numeric,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX tomadores_al_documento_idx ON public.tomadores_al (documento);
CREATE INDEX tomadores_al_nome_idx ON public.tomadores_al (nome);
CREATE INDEX tomadores_al_orgao_idx ON public.tomadores_al (orgao);
CREATE INDEX tomadores_al_margem_disp_idx ON public.tomadores_al (margem_disp_emprestimo DESC);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.tomadores_al TO authenticated;
GRANT ALL ON public.tomadores_al TO service_role;

ALTER TABLE public.tomadores_al ENABLE ROW LEVEL SECURITY;

CREATE POLICY "tomadores_al_select_auth" ON public.tomadores_al
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "tomadores_al_admin_insert" ON public.tomadores_al
  FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "tomadores_al_admin_update" ON public.tomadores_al
  FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "tomadores_al_admin_delete" ON public.tomadores_al
  FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'admin'));

CREATE OR REPLACE FUNCTION public.tomadores_al_set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER update_tomadores_al_updated_at
  BEFORE UPDATE ON public.tomadores_al
  FOR EACH ROW EXECUTE FUNCTION public.tomadores_al_set_updated_at();