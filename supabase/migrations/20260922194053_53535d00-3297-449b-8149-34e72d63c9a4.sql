ALTER TABLE public.prospect_conversoes
  DROP CONSTRAINT IF EXISTS prospect_conversoes_origem_check;
ALTER TABLE public.prospect_conversoes
  ADD CONSTRAINT prospect_conversoes_origem_check
  CHECK (origem = ANY (ARRAY['crm'::text, 'tomadores_al'::text, 'manual'::text]));

ALTER TABLE public.prospect_conversoes
  ADD COLUMN IF NOT EXISTS cliente_manual boolean NOT NULL DEFAULT false;

CREATE TABLE IF NOT EXISTS public.prospect_conversao_itens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  conversao_id uuid NOT NULL REFERENCES public.prospect_conversoes(id) ON DELETE CASCADE,
  produto text NOT NULL CHECK (produto = ANY (ARRAY['emprestimo_novo'::text,'cartao_credito'::text,'cartao_beneficio'::text,'refinanciamento'::text])),
  banco text,
  valor_liberado numeric NOT NULL DEFAULT 0 CHECK (valor_liberado >= 0),
  prazo integer CHECK (prazo IS NULL OR (prazo >= 1 AND prazo <= 240)),
  valor_parcela numeric CHECK (valor_parcela IS NULL OR valor_parcela >= 0),
  margem_usada numeric NOT NULL DEFAULT 0 CHECK (margem_usada >= 0),
  ordem integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.prospect_conversao_itens TO authenticated;
GRANT ALL ON public.prospect_conversao_itens TO service_role;

ALTER TABLE public.prospect_conversao_itens ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Consultora gerencia itens das proprias conversoes"
  ON public.prospect_conversao_itens FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.prospect_conversoes c WHERE c.id = conversao_id AND c.user_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.prospect_conversoes c WHERE c.id = conversao_id AND c.user_id = auth.uid()));

CREATE POLICY "Admins gerenciam todos os itens"
  ON public.prospect_conversao_itens FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'gestor_acessos'))
  WITH CHECK (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'gestor_acessos'));

CREATE INDEX IF NOT EXISTS idx_prospect_conversao_itens_conversao
  ON public.prospect_conversao_itens (conversao_id, ordem);

CREATE TRIGGER set_prospect_conversao_itens_updated_at
  BEFORE UPDATE ON public.prospect_conversao_itens
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

INSERT INTO public.prospect_conversao_itens
  (conversao_id, produto, banco, valor_liberado, prazo, valor_parcela, margem_usada, ordem)
SELECT c.id,
       CASE c.tipo_margem
         WHEN 'cartao_credito' THEN 'cartao_credito'
         WHEN 'cartao_beneficio' THEN 'cartao_beneficio'
         ELSE 'emprestimo_novo'
       END,
       NULL,
       COALESCE(c.valor_liberado, 0),
       c.prazo,
       c.valor_parcela,
       COALESCE(c.margem_usada, 0),
       0
FROM public.prospect_conversoes c
WHERE NOT EXISTS (SELECT 1 FROM public.prospect_conversao_itens i WHERE i.conversao_id = c.id);