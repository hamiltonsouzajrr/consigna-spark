CREATE TABLE public.prospect_jornada (
  user_id uuid NOT NULL PRIMARY KEY,
  inicio time NOT NULL DEFAULT '08:00',
  fim time NOT NULL DEFAULT '18:00',
  almoco_inicio time NOT NULL DEFAULT '12:00',
  almoco_minutos integer NOT NULL DEFAULT 60,
  meta_diaria integer NOT NULL DEFAULT 250,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.prospect_jornada TO authenticated;
GRANT ALL ON public.prospect_jornada TO service_role;

ALTER TABLE public.prospect_jornada ENABLE ROW LEVEL SECURITY;

CREATE POLICY "jornada_select_own_or_admin" ON public.prospect_jornada
  FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));

CREATE POLICY "jornada_insert_own" ON public.prospect_jornada
  FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "jornada_update_own_or_admin" ON public.prospect_jornada
  FOR UPDATE TO authenticated
  USING (user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'))
  WITH CHECK (user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));

CREATE POLICY "jornada_delete_own_or_admin" ON public.prospect_jornada
  FOR DELETE TO authenticated
  USING (user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER prospect_jornada_updated_at
  BEFORE UPDATE ON public.prospect_jornada
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.prospect_jornada
  ADD CONSTRAINT prospect_jornada_meta_check CHECK (meta_diaria BETWEEN 1 AND 2000),
  ADD CONSTRAINT prospect_jornada_almoco_check CHECK (almoco_minutos BETWEEN 0 AND 240);