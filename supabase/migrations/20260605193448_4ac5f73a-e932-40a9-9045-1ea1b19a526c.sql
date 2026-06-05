
CREATE TABLE public.rh_tab_access (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  tab_key TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, tab_key)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.rh_tab_access TO authenticated;
GRANT ALL ON public.rh_tab_access TO service_role;
ALTER TABLE public.rh_tab_access ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Read own or admin reads all rh_tab_access"
  ON public.rh_tab_access FOR SELECT TO authenticated
  USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins insert rh_tab_access"
  ON public.rh_tab_access FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins update rh_tab_access"
  ON public.rh_tab_access FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins delete rh_tab_access"
  ON public.rh_tab_access FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));
