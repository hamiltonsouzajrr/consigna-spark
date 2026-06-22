CREATE TABLE public.do_arquivos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nome_arquivo text NOT NULL,
  tipo_arquivo text NOT NULL,
  data_upload timestamptz NOT NULL DEFAULT now(),
  data_publicacao date,
  numero_edicao text,
  orgao_detectado text,
  caminho_arquivo text,
  texto_extraido text,
  status_processamento text NOT NULL DEFAULT 'processando',
  total_registros_extraidos integer NOT NULL DEFAULT 0,
  total_aprovados integer NOT NULL DEFAULT 0,
  total_erros integer NOT NULL DEFAULT 0,
  uploaded_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.do_registros (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  arquivo_id uuid NOT NULL REFERENCES public.do_arquivos(id) ON DELETE CASCADE,
  nome_servidor text NOT NULL,
  matricula text,
  cpf_parcial text,
  cargo text,
  orgao text,
  tipo_movimentacao text,
  data_publicacao date,
  data_ato date,
  pagina text,
  classe_anterior text,
  classe_nova text,
  nivel_anterior text,
  nivel_novo text,
  referencia_anterior text,
  referencia_nova text,
  numero_ato text,
  trecho_original text,
  confianca_ia text,
  categoria text,
  status_revisao text NOT NULL DEFAULT 'Novo',
  duplicado_possivel boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_do_registros_arquivo ON public.do_registros(arquivo_id);
CREATE INDEX idx_do_registros_status ON public.do_registros(status_revisao);
CREATE INDEX idx_do_registros_data_pub ON public.do_registros(data_publicacao DESC);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.do_arquivos TO authenticated;
GRANT ALL ON public.do_arquivos TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.do_registros TO authenticated;
GRANT ALL ON public.do_registros TO service_role;

ALTER TABLE public.do_arquivos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.do_registros ENABLE ROW LEVEL SECURITY;

CREATE POLICY "do_arquivos select authenticated" ON public.do_arquivos
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "do_arquivos insert authenticated" ON public.do_arquivos
  FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "do_arquivos update authenticated" ON public.do_arquivos
  FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "do_arquivos delete admin" ON public.do_arquivos
  FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "do_registros select authenticated" ON public.do_registros
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "do_registros insert authenticated" ON public.do_registros
  FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "do_registros update authenticated" ON public.do_registros
  FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "do_registros delete admin" ON public.do_registros
  FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER set_do_arquivos_updated_at BEFORE UPDATE ON public.do_arquivos
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER set_do_registros_updated_at BEFORE UPDATE ON public.do_registros
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();