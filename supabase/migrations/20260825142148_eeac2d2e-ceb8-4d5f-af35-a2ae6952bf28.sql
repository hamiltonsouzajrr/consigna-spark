CREATE TABLE public.app_sessions (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL,
  session_key text NOT NULL,
  ip text,
  user_agent text,
  blocked_at timestamp with time zone,
  last_seen_at timestamp with time zone NOT NULL DEFAULT now(),
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE (user_id, session_key)
);

CREATE INDEX idx_app_sessions_user_seen ON public.app_sessions (user_id, last_seen_at DESC);

GRANT SELECT ON public.app_sessions TO authenticated;
GRANT ALL ON public.app_sessions TO service_role;
ALTER TABLE public.app_sessions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Usuário vê suas sessões" ON public.app_sessions
  FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Admin vê todas as sessões" ON public.app_sessions
  FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER set_app_sessions_updated_at
  BEFORE UPDATE ON public.app_sessions
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE public.security_incidents (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tipo text NOT NULL DEFAULT 'acesso_simultaneo',
  user_id uuid NOT NULL,
  user_email text,
  detalhes jsonb NOT NULL DEFAULT '{}'::jsonb,
  resolvido_em timestamp with time zone,
  resolvido_por uuid,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

CREATE INDEX idx_security_incidents_created ON public.security_incidents (created_at DESC);

GRANT SELECT ON public.security_incidents TO authenticated;
GRANT ALL ON public.security_incidents TO service_role;
ALTER TABLE public.security_incidents ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin vê incidentes" ON public.security_incidents
  FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER set_security_incidents_updated_at
  BEFORE UPDATE ON public.security_incidents
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();