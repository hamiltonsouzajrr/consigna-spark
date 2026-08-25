-- Consultoras podem ver os registros do Radar atribuídos a elas
CREATE POLICY "do_registros select own consultora"
ON public.do_registros
FOR SELECT
TO authenticated
USING (
  consultora_responsavel IS NOT NULL
  AND consultora_responsavel = public.minha_consultora_nome()
);

-- Consultoras podem atualizar apenas os próprios registros
CREATE POLICY "do_registros update own consultora"
ON public.do_registros
FOR UPDATE
TO authenticated
USING (
  consultora_responsavel IS NOT NULL
  AND consultora_responsavel = public.minha_consultora_nome()
)
WITH CHECK (
  consultora_responsavel IS NOT NULL
  AND consultora_responsavel = public.minha_consultora_nome()
);

GRANT SELECT, UPDATE ON public.do_registros TO authenticated;