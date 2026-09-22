CREATE TABLE public.esteira_ajustes_consultora (
  contrato_id uuid PRIMARY KEY REFERENCES public.esteira_contratos(id) ON DELETE CASCADE,
  consultant_id uuid NOT NULL,
  margem_usada numeric,
  margem_restante_valor numeric,
  prazo integer,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT esteira_ajustes_margem_usada_valida CHECK (margem_usada IS NULL OR margem_usada >= 0),
  CONSTRAINT esteira_ajustes_margem_restante_valida CHECK (margem_restante_valor IS NULL OR margem_restante_valor >= 0),
  CONSTRAINT esteira_ajustes_prazo_valido CHECK (prazo IS NULL OR prazo BETWEEN 1 AND 240)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.esteira_ajustes_consultora TO authenticated;
GRANT ALL ON public.esteira_ajustes_consultora TO service_role;

ALTER TABLE public.esteira_ajustes_consultora ENABLE ROW LEVEL SECURITY;

CREATE POLICY "esteira_ajustes_select_proprio" ON public.esteira_ajustes_consultora
  FOR SELECT TO authenticated
  USING (consultant_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));

CREATE POLICY "esteira_ajustes_insert_proprio" ON public.esteira_ajustes_consultora
  FOR INSERT TO authenticated
  WITH CHECK (
    public.has_role(auth.uid(), 'admin')
    OR (
      consultant_id = auth.uid()
      AND EXISTS (
        SELECT 1 FROM public.esteira_contratos c
        WHERE c.id = contrato_id AND c.consultant_id = auth.uid() AND c.removido_em IS NULL
      )
    )
  );

CREATE POLICY "esteira_ajustes_update_proprio" ON public.esteira_ajustes_consultora
  FOR UPDATE TO authenticated
  USING (consultant_id = auth.uid() OR public.has_role(auth.uid(), 'admin'))
  WITH CHECK (
    public.has_role(auth.uid(), 'admin')
    OR (
      consultant_id = auth.uid()
      AND EXISTS (
        SELECT 1 FROM public.esteira_contratos c
        WHERE c.id = contrato_id AND c.consultant_id = auth.uid() AND c.removido_em IS NULL
      )
    )
  );

CREATE TRIGGER esteira_ajustes_updated_at
  BEFORE UPDATE ON public.esteira_ajustes_consultora
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();