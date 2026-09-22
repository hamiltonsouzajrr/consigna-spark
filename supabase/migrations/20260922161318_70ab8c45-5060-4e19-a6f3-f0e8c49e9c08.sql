CREATE TABLE public.esteira_lotes (
  lote_id uuid PRIMARY KEY,
  nome text,
  campos_visiveis jsonb NOT NULL DEFAULT '{"status":true,"banco":true,"data_prazo":true,"valor_bruto":false,"producao":false,"digitador":false,"observacao":true}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.esteira_lotes TO authenticated;
GRANT ALL ON public.esteira_lotes TO service_role;

ALTER TABLE public.esteira_lotes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "esteira_lotes_read_authenticated" ON public.esteira_lotes
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "esteira_lotes_admin_manage" ON public.esteira_lotes
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER esteira_lotes_updated_at BEFORE UPDATE ON public.esteira_lotes
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.esteira_contratos
  ADD COLUMN IF NOT EXISTS removido_em timestamptz,
  ADD COLUMN IF NOT EXISTS removido_por uuid;

CREATE INDEX IF NOT EXISTS esteira_contratos_ativos_idx
  ON public.esteira_contratos (consultant_id, proximo_contato_em)
  WHERE removido_em IS NULL;

INSERT INTO public.esteira_lotes (lote_id, nome)
SELECT DISTINCT c.lote_id, max(c.lote_nome)
  FROM public.esteira_contratos c
 WHERE c.lote_id IS NOT NULL
 GROUP BY c.lote_id
ON CONFLICT (lote_id) DO NOTHING;