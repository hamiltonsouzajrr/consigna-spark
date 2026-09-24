CREATE TABLE public.quitacao_lotes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nome text NOT NULL,
  total integer NOT NULL DEFAULT 0,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.quitacao_lotes TO authenticated;
GRANT ALL ON public.quitacao_lotes TO service_role;
ALTER TABLE public.quitacao_lotes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "admin lotes quitacao" ON public.quitacao_lotes FOR ALL TO authenticated
USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));

CREATE TABLE public.quitacao_clientes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lote_id uuid REFERENCES public.quitacao_lotes(id) ON DELETE SET NULL,
  cpf text NOT NULL,
  nome text NOT NULL,
  status text,
  cod_ordem text NOT NULL DEFAULT '',
  saldo numeric,
  parcela numeric,
  reserva numeric,
  qtd_contratos integer,
  pagas integer,
  abertas integer,
  plano integer,
  prazos jsonb NOT NULL DEFAULT '{}'::jsonb,
  consultant_id uuid,
  resultado text NOT NULL DEFAULT 'novo',
  ultimo_contato_em timestamptz,
  importado_em timestamptz NOT NULL DEFAULT now(),
  removido_em timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (cpf, cod_ordem)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.quitacao_clientes TO authenticated;
GRANT ALL ON public.quitacao_clientes TO service_role;
ALTER TABLE public.quitacao_clientes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "admin clientes quitacao" ON public.quitacao_clientes FOR ALL TO authenticated
USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));
CREATE POLICY "consultora le quitacao" ON public.quitacao_clientes FOR SELECT TO authenticated
USING (consultant_id = auth.uid() AND removido_em IS NULL);
CREATE INDEX quitacao_clientes_consultant_idx ON public.quitacao_clientes (consultant_id);
CREATE TRIGGER quitacao_clientes_updated BEFORE UPDATE ON public.quitacao_clientes
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE public.quitacao_contatos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  cliente_id uuid NOT NULL REFERENCES public.quitacao_clientes(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  resultado text NOT NULL,
  nota text,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT ON public.quitacao_contatos TO authenticated;
GRANT ALL ON public.quitacao_contatos TO service_role;
ALTER TABLE public.quitacao_contatos ENABLE ROW LEVEL SECURITY;
CREATE POLICY "ver contatos quitacao" ON public.quitacao_contatos FOR SELECT TO authenticated
USING (user_id = auth.uid() OR public.has_role(auth.uid(),'admin'));
CREATE POLICY "inserir contatos quitacao" ON public.quitacao_contatos FOR INSERT TO authenticated
WITH CHECK (user_id = auth.uid());