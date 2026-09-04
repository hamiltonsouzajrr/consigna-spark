CREATE TABLE public.prospect_vendas (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL,
  origem text NOT NULL DEFAULT 'crm',
  ref_tabela text NOT NULL,
  ref_id uuid NOT NULL,
  cliente_nome text,
  week_start date NOT NULL DEFAULT public.competicao_week_start(),
  status text NOT NULL DEFAULT 'pendente',
  pontos_creditados integer NOT NULL DEFAULT 0,
  motivo text,
  motivo_recusa text,
  revisado_por uuid,
  revisado_em timestamp with time zone,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT prospect_vendas_origem_check CHECK (origem IN ('crm','tomadores_al')),
  CONSTRAINT prospect_vendas_status_check CHECK (status IN ('pendente','confirmada','recusada'))
);

GRANT SELECT ON public.prospect_vendas TO authenticated;
GRANT ALL ON public.prospect_vendas TO service_role;

ALTER TABLE public.prospect_vendas ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Consultants view own sales" ON public.prospect_vendas
  FOR SELECT TO authenticated USING (user_id = auth.uid());

CREATE POLICY "Admins manage sales" ON public.prospect_vendas
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE UNIQUE INDEX prospect_vendas_pendente_uniq
  ON public.prospect_vendas (ref_tabela, ref_id)
  WHERE status = 'pendente';

CREATE INDEX prospect_vendas_status_created_idx
  ON public.prospect_vendas (status, created_at DESC);

CREATE INDEX prospect_vendas_user_week_idx
  ON public.prospect_vendas (user_id, week_start);

CREATE TRIGGER set_prospect_vendas_updated_at
  BEFORE UPDATE ON public.prospect_vendas
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();