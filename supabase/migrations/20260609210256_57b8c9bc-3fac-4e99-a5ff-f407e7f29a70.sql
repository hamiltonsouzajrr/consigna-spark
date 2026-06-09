CREATE TABLE public.legal_approvals (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  lead_id uuid REFERENCES public.prospect_leads(id) ON DELETE SET NULL,
  token text NOT NULL UNIQUE,
  consultant_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  consultant_email text,
  nome_completo text NOT NULL,
  cpf text,
  banco text,
  tipo_operacao text,
  valor_solicitado numeric,
  valor_parcela numeric,
  status text NOT NULL DEFAULT 'pendente',
  cliente_aceite boolean,
  aceite_registrado_at timestamptz,
  video_path text,
  audio_path text,
  transcricao text,
  resumo text,
  duracao_segundos integer,
  file_hash text,
  gravado_em timestamptz,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.legal_approvals TO authenticated;
GRANT ALL ON public.legal_approvals TO service_role;

ALTER TABLE public.legal_approvals ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage legal approvals"
ON public.legal_approvals FOR ALL
TO authenticated
USING (public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE INDEX idx_legal_approvals_lead ON public.legal_approvals(lead_id);
CREATE INDEX idx_legal_approvals_token ON public.legal_approvals(token);
CREATE INDEX idx_legal_approvals_created ON public.legal_approvals(created_at DESC);

CREATE TRIGGER set_legal_approvals_updated_at
BEFORE UPDATE ON public.legal_approvals
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Storage policies: admins only
CREATE POLICY "Admins read legal recordings"
ON storage.objects FOR SELECT
TO authenticated
USING (bucket_id = 'legal-recordings' AND public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins upload legal recordings"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'legal-recordings' AND public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins update legal recordings"
ON storage.objects FOR UPDATE
TO authenticated
USING (bucket_id = 'legal-recordings' AND public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins delete legal recordings"
ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id = 'legal-recordings' AND public.has_role(auth.uid(), 'admin'));