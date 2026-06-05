
CREATE TABLE public.rh_employees (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  full_name TEXT NOT NULL,
  job_title TEXT,
  department TEXT,
  salary NUMERIC NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.rh_employees TO authenticated;
GRANT ALL ON public.rh_employees TO service_role;
ALTER TABLE public.rh_employees ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated manage rh_employees" ON public.rh_employees FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE TABLE public.rh_kpi_metrics (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  employee_id UUID NOT NULL REFERENCES public.rh_employees(id) ON DELETE CASCADE,
  kpi TEXT NOT NULL,
  ref_month DATE NOT NULL,
  value NUMERIC NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (employee_id, kpi, ref_month)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.rh_kpi_metrics TO authenticated;
GRANT ALL ON public.rh_kpi_metrics TO service_role;
ALTER TABLE public.rh_kpi_metrics ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated manage rh_kpi_metrics" ON public.rh_kpi_metrics FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE TABLE public.rh_vacation_requests (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  employee_id UUID NOT NULL REFERENCES public.rh_employees(id) ON DELETE CASCADE,
  tipo TEXT NOT NULL,
  status TEXT NOT NULL,
  inicio DATE NOT NULL,
  fim DATE NOT NULL,
  dias INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.rh_vacation_requests TO authenticated;
GRANT ALL ON public.rh_vacation_requests TO service_role;
ALTER TABLE public.rh_vacation_requests ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated manage rh_vacation_requests" ON public.rh_vacation_requests FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE TABLE public.rh_benefits (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  employee_id UUID NOT NULL REFERENCES public.rh_employees(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  active BOOLEAN NOT NULL DEFAULT true,
  activated_at DATE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.rh_benefits TO authenticated;
GRANT ALL ON public.rh_benefits TO service_role;
ALTER TABLE public.rh_benefits ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated manage rh_benefits" ON public.rh_benefits FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE TRIGGER set_rh_employees_updated_at BEFORE UPDATE ON public.rh_employees FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER set_rh_kpi_metrics_updated_at BEFORE UPDATE ON public.rh_kpi_metrics FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER set_rh_vacation_requests_updated_at BEFORE UPDATE ON public.rh_vacation_requests FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER set_rh_benefits_updated_at BEFORE UPDATE ON public.rh_benefits FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
