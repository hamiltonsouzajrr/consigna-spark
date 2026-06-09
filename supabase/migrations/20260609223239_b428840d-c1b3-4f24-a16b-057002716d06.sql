-- Avisos
CREATE TABLE public.rh_portal_avisos (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  titulo text NOT NULL,
  quando text,
  tone text NOT NULL DEFAULT 'sky',
  icon text NOT NULL DEFAULT 'Megaphone',
  sort int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.rh_portal_avisos TO authenticated;
GRANT ALL ON public.rh_portal_avisos TO service_role;
ALTER TABLE public.rh_portal_avisos ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Portal avisos readable by authenticated"
  ON public.rh_portal_avisos FOR SELECT TO authenticated USING (true);
CREATE POLICY "Portal avisos admin insert"
  ON public.rh_portal_avisos FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Portal avisos admin update"
  ON public.rh_portal_avisos FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Portal avisos admin delete"
  ON public.rh_portal_avisos FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));
CREATE TRIGGER set_rh_portal_avisos_updated_at
  BEFORE UPDATE ON public.rh_portal_avisos
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Atalhos
CREATE TABLE public.rh_portal_atalhos (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  label text NOT NULL,
  icon text NOT NULL DEFAULT 'FileText',
  sort int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.rh_portal_atalhos TO authenticated;
GRANT ALL ON public.rh_portal_atalhos TO service_role;
ALTER TABLE public.rh_portal_atalhos ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Portal atalhos readable by authenticated"
  ON public.rh_portal_atalhos FOR SELECT TO authenticated USING (true);
CREATE POLICY "Portal atalhos admin insert"
  ON public.rh_portal_atalhos FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Portal atalhos admin update"
  ON public.rh_portal_atalhos FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Portal atalhos admin delete"
  ON public.rh_portal_atalhos FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));
CREATE TRIGGER set_rh_portal_atalhos_updated_at
  BEFORE UPDATE ON public.rh_portal_atalhos
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- KPIs (configuração exibida no portal)
CREATE TABLE public.rh_portal_kpis (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  saldo_ferias int NOT NULL DEFAULT 30,
  banco_horas int NOT NULL DEFAULT 0,
  salario numeric NOT NULL DEFAULT 0,
  beneficios int NOT NULL DEFAULT 0,
  trein_total int NOT NULL DEFAULT 0,
  trein_concluidos int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.rh_portal_kpis TO authenticated;
GRANT ALL ON public.rh_portal_kpis TO service_role;
ALTER TABLE public.rh_portal_kpis ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Portal kpis readable by authenticated"
  ON public.rh_portal_kpis FOR SELECT TO authenticated USING (true);
CREATE POLICY "Portal kpis admin insert"
  ON public.rh_portal_kpis FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Portal kpis admin update"
  ON public.rh_portal_kpis FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Portal kpis admin delete"
  ON public.rh_portal_kpis FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));
CREATE TRIGGER set_rh_portal_kpis_updated_at
  BEFORE UPDATE ON public.rh_portal_kpis
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();