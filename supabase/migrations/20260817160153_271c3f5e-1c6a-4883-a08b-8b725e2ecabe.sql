CREATE TABLE public.rh_access_audit (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  actor_id uuid,
  actor_email text,
  target_user_id uuid,
  target_email text,
  action text NOT NULL,
  detail jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

GRANT SELECT ON public.rh_access_audit TO authenticated;
GRANT ALL ON public.rh_access_audit TO service_role;

ALTER TABLE public.rh_access_audit ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins podem ver o historico de acessos"
  ON public.rh_access_audit FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE INDEX rh_access_audit_created_idx ON public.rh_access_audit (created_at DESC);