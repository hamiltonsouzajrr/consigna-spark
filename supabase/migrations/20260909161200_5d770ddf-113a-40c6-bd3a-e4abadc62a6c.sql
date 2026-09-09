CREATE TABLE public.prospect_metas (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL UNIQUE,
  meta_contatos integer NOT NULL DEFAULT 0,
  meta_vendas integer NOT NULL DEFAULT 0,
  meta_horas numeric NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.prospect_metas TO authenticated;
GRANT INSERT, UPDATE, DELETE ON public.prospect_metas TO authenticated;
GRANT ALL ON public.prospect_metas TO service_role;

ALTER TABLE public.prospect_metas ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Autenticados podem ver metas" ON public.prospect_metas
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins gerenciam metas" ON public.prospect_metas
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER prospect_metas_set_updated_at
  BEFORE UPDATE ON public.prospect_metas
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE public.prospect_metas_padrao (
  id boolean NOT NULL DEFAULT true PRIMARY KEY,
  meta_contatos integer NOT NULL DEFAULT 250,
  meta_vendas integer NOT NULL DEFAULT 3,
  meta_horas numeric NOT NULL DEFAULT 30,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT prospect_metas_padrao_unica CHECK (id)
);

GRANT SELECT ON public.prospect_metas_padrao TO authenticated;
GRANT INSERT, UPDATE ON public.prospect_metas_padrao TO authenticated;
GRANT ALL ON public.prospect_metas_padrao TO service_role;

ALTER TABLE public.prospect_metas_padrao ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Autenticados podem ver meta padrao" ON public.prospect_metas_padrao
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins gerenciam meta padrao" ON public.prospect_metas_padrao
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER prospect_metas_padrao_set_updated_at
  BEFORE UPDATE ON public.prospect_metas_padrao
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

INSERT INTO public.prospect_metas_padrao (id) VALUES (true) ON CONFLICT (id) DO NOTHING;