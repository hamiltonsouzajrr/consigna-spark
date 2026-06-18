CREATE TABLE public.promovidos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nome text NOT NULL,
  cpf text NOT NULL,
  cargo text NOT NULL,
  mes_referencia date NOT NULL,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.promovidos TO authenticated;
GRANT ALL ON public.promovidos TO service_role;

ALTER TABLE public.promovidos ENABLE ROW LEVEL SECURITY;

-- Any authenticated user can view the recently promoted list.
CREATE POLICY "Authenticated can view promovidos"
  ON public.promovidos FOR SELECT
  TO authenticated
  USING (true);

-- Only admins can add, edit or remove promovidos.
CREATE POLICY "Admins can insert promovidos"
  ON public.promovidos FOR INSERT
  TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can update promovidos"
  ON public.promovidos FOR UPDATE
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can delete promovidos"
  ON public.promovidos FOR DELETE
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER set_promovidos_updated_at
  BEFORE UPDATE ON public.promovidos
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();