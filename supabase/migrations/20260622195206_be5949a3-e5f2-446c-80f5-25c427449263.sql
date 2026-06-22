CREATE TABLE public.radar_consultoras (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  nome text NOT NULL,
  ativo boolean NOT NULL DEFAULT true,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX radar_consultoras_nome_lower_idx ON public.radar_consultoras (lower(nome));

GRANT SELECT, INSERT, UPDATE, DELETE ON public.radar_consultoras TO authenticated;
GRANT ALL ON public.radar_consultoras TO service_role;

ALTER TABLE public.radar_consultoras ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can view consultoras"
  ON public.radar_consultoras FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated can insert consultoras"
  ON public.radar_consultoras FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated can update consultoras"
  ON public.radar_consultoras FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Authenticated can delete consultoras"
  ON public.radar_consultoras FOR DELETE TO authenticated USING (true);

CREATE TRIGGER set_radar_consultoras_updated_at
  BEFORE UPDATE ON public.radar_consultoras
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();