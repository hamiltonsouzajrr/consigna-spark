CREATE TABLE public.esteira_contratos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  status text,
  data_venda date NOT NULL,
  cpf text NOT NULL,
  nome text NOT NULL,
  banco text,
  seguro text,
  prazo integer,
  valor_bruto numeric,
  producao numeric,
  repasse numeric,
  digitador text,
  consultora text,
  consultant_id uuid,
  observacao text,
  dia_amortizacao integer NOT NULL DEFAULT 1,
  proximo_contato_em date,
  acompanhamento_ativo boolean NOT NULL DEFAULT true,
  lote_id uuid,
  lote_nome text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.esteira_contratos TO authenticated;
GRANT ALL ON public.esteira_contratos TO service_role;
ALTER TABLE public.esteira_contratos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "esteira_contratos_own_select" ON public.esteira_contratos
  FOR SELECT TO authenticated USING (consultant_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));
CREATE POLICY "esteira_contratos_own_update" ON public.esteira_contratos
  FOR UPDATE TO authenticated USING (consultant_id = auth.uid() OR public.has_role(auth.uid(), 'admin'))
  WITH CHECK (consultant_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));
CREATE POLICY "esteira_contratos_admin_insert" ON public.esteira_contratos
  FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "esteira_contratos_admin_delete" ON public.esteira_contratos
  FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'admin'));

CREATE UNIQUE INDEX esteira_contratos_unico ON public.esteira_contratos (cpf, data_venda, coalesce(banco, ''));
CREATE INDEX esteira_contratos_consultant_idx ON public.esteira_contratos (consultant_id, proximo_contato_em);
CREATE INDEX esteira_contratos_proximo_idx ON public.esteira_contratos (proximo_contato_em) WHERE acompanhamento_ativo;

CREATE TRIGGER esteira_contratos_updated_at BEFORE UPDATE ON public.esteira_contratos
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE public.esteira_contatos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  contrato_id uuid NOT NULL REFERENCES public.esteira_contratos(id) ON DELETE CASCADE,
  consultant_id uuid,
  resultado text NOT NULL,
  observacao text,
  contato_em timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.esteira_contatos TO authenticated;
GRANT ALL ON public.esteira_contatos TO service_role;
ALTER TABLE public.esteira_contatos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "esteira_contatos_select" ON public.esteira_contatos
  FOR SELECT TO authenticated USING (
    public.has_role(auth.uid(), 'admin')
    OR EXISTS (SELECT 1 FROM public.esteira_contratos c WHERE c.id = contrato_id AND c.consultant_id = auth.uid())
  );
CREATE POLICY "esteira_contatos_insert" ON public.esteira_contatos
  FOR INSERT TO authenticated WITH CHECK (
    public.has_role(auth.uid(), 'admin')
    OR EXISTS (SELECT 1 FROM public.esteira_contratos c WHERE c.id = contrato_id AND c.consultant_id = auth.uid())
  );

CREATE INDEX esteira_contatos_contrato_idx ON public.esteira_contatos (contrato_id, contato_em DESC);

ALTER TABLE public.lead_tasks ADD COLUMN esteira_id uuid REFERENCES public.esteira_contratos(id) ON DELETE CASCADE;
CREATE INDEX lead_tasks_esteira_idx ON public.lead_tasks (esteira_id);