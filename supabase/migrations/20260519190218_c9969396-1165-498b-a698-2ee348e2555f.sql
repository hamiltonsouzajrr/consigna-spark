
-- Roles enum + table
CREATE TYPE public.app_role AS ENUM ('admin', 'user');

CREATE TABLE public.user_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.app_role NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, role)
);

ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role public.app_role)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role
  )
$$;

CREATE POLICY "Users view own roles"
ON public.user_roles FOR SELECT TO authenticated
USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins manage roles"
ON public.user_roles FOR ALL TO authenticated
USING (public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Bootstrap admin
INSERT INTO public.user_roles (user_id, role)
VALUES ('4cc0ac14-bf2e-4a0e-82ca-c271cbd700b8', 'admin')
ON CONFLICT DO NOTHING;

-- Make consultado_por required going forward
UPDATE public.safeconsig_leads SET consultado_por = '4cc0ac14-bf2e-4a0e-82ca-c271cbd700b8'
WHERE consultado_por IS NULL;
ALTER TABLE public.safeconsig_leads ALTER COLUMN consultado_por SET NOT NULL;

-- Replace RLS on safeconsig_leads: owner-only + admin sees all
DROP POLICY IF EXISTS "Authenticated can view leads" ON public.safeconsig_leads;
DROP POLICY IF EXISTS "Authenticated can insert leads" ON public.safeconsig_leads;
DROP POLICY IF EXISTS "Authenticated can update leads" ON public.safeconsig_leads;

CREATE POLICY "Owners and admins view leads"
ON public.safeconsig_leads FOR SELECT TO authenticated
USING (auth.uid() = consultado_por OR public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Owners insert leads"
ON public.safeconsig_leads FOR INSERT TO authenticated
WITH CHECK (auth.uid() = consultado_por);

CREATE POLICY "Owners and admins update leads"
ON public.safeconsig_leads FOR UPDATE TO authenticated
USING (auth.uid() = consultado_por OR public.has_role(auth.uid(), 'admin'))
WITH CHECK (auth.uid() = consultado_por OR public.has_role(auth.uid(), 'admin'));
