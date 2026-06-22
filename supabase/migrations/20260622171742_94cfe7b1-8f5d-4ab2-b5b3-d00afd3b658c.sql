
CREATE TABLE public.fontes_diario_oficial (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  data_consulta TIMESTAMPTZ NOT NULL DEFAULT now(),
  data_publicacao DATE,
  numero_edicao TEXT,
  tipo_edicao TEXT,
  titulo TEXT,
  suplemento BOOLEAN NOT NULL DEFAULT false,
  edition_id TEXT,
  url_origem TEXT,
  url_pdf TEXT,
  nome_arquivo TEXT,
  caminho_arquivo TEXT,
  hash_arquivo TEXT,
  status_download TEXT NOT NULL DEFAULT 'pendente',
  status_processamento TEXT NOT NULL DEFAULT 'pendente',
  total_paginas INTEGER NOT NULL DEFAULT 0,
  total_registros_extraidos INTEGER NOT NULL DEFAULT 0,
  requer_ocr BOOLEAN NOT NULL DEFAULT false,
  erro_processamento TEXT,
  arquivo_id UUID REFERENCES public.do_arquivos(id) ON DELETE SET NULL,
  criado_por UUID,
  criado_em TIMESTAMPTZ NOT NULL DEFAULT now(),
  atualizado_em TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX fontes_diario_oficial_unica
  ON public.fontes_diario_oficial (data_publicacao, numero_edicao, tipo_edicao, suplemento);
CREATE INDEX fontes_diario_oficial_data_idx ON public.fontes_diario_oficial (data_publicacao DESC);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.fontes_diario_oficial TO authenticated;
GRANT ALL ON public.fontes_diario_oficial TO service_role;

ALTER TABLE public.fontes_diario_oficial ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Autenticados leem fontes" ON public.fontes_diario_oficial
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "Autenticados inserem fontes" ON public.fontes_diario_oficial
  FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Autenticados atualizam fontes" ON public.fontes_diario_oficial
  FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Admins excluem fontes" ON public.fontes_diario_oficial
  FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'admin'));

CREATE TABLE public.diario_automacao_logs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  executado_em TIMESTAMPTZ NOT NULL DEFAULT now(),
  gatilho TEXT NOT NULL DEFAULT 'manual',
  url_consultada TEXT,
  arquivos_encontrados INTEGER NOT NULL DEFAULT 0,
  arquivos_baixados INTEGER NOT NULL DEFAULT 0,
  registros_extraidos INTEGER NOT NULL DEFAULT 0,
  duracao_ms INTEGER NOT NULL DEFAULT 0,
  erros TEXT,
  detalhe JSONB,
  criado_em TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX diario_automacao_logs_exec_idx ON public.diario_automacao_logs (executado_em DESC);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.diario_automacao_logs TO authenticated;
GRANT ALL ON public.diario_automacao_logs TO service_role;

ALTER TABLE public.diario_automacao_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Autenticados leem logs" ON public.diario_automacao_logs
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "Autenticados inserem logs" ON public.diario_automacao_logs
  FOR INSERT TO authenticated WITH CHECK (true);

CREATE TABLE public.diario_alertas (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tipo TEXT NOT NULL,
  titulo TEXT NOT NULL,
  mensagem TEXT,
  severidade TEXT NOT NULL DEFAULT 'info',
  fonte_id UUID REFERENCES public.fontes_diario_oficial(id) ON DELETE SET NULL,
  lido BOOLEAN NOT NULL DEFAULT false,
  criado_em TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX diario_alertas_criado_idx ON public.diario_alertas (criado_em DESC);
CREATE INDEX diario_alertas_lido_idx ON public.diario_alertas (lido);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.diario_alertas TO authenticated;
GRANT ALL ON public.diario_alertas TO service_role;

ALTER TABLE public.diario_alertas ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Autenticados leem alertas" ON public.diario_alertas
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "Autenticados inserem alertas" ON public.diario_alertas
  FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Autenticados atualizam alertas" ON public.diario_alertas
  FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Admins excluem alertas" ON public.diario_alertas
  FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER fontes_diario_oficial_set_updated_at
  BEFORE UPDATE ON public.fontes_diario_oficial
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
