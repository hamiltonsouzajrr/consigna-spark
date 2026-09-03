CREATE TABLE public.app_uso_ativo (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL,
  ref_date date NOT NULL,
  segundos integer NOT NULL DEFAULT 0,
  ultimo_em timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, ref_date)
);

GRANT SELECT ON public.app_uso_ativo TO authenticated;
GRANT ALL ON public.app_uso_ativo TO service_role;

ALTER TABLE public.app_uso_ativo ENABLE ROW LEVEL SECURITY;

CREATE POLICY "uso ativo select own" ON public.app_uso_ativo
  FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR has_role(auth.uid(), 'admin'::app_role));

CREATE TRIGGER set_app_uso_ativo_updated_at
  BEFORE UPDATE ON public.app_uso_ativo
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE OR REPLACE FUNCTION public.registrar_uso_ativo(_user_id uuid, _segundos integer)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  hoje date := (now() AT TIME ZONE 'America/Maceio')::date;
  inc integer := least(greatest(coalesce(_segundos, 0), 0), 300);
  total integer;
BEGIN
  IF _user_id IS NULL THEN RETURN 0; END IF;

  INSERT INTO public.app_uso_ativo (user_id, ref_date, segundos, ultimo_em)
  VALUES (_user_id, hoje, inc, now())
  ON CONFLICT (user_id, ref_date) DO UPDATE
     SET segundos = least(public.app_uso_ativo.segundos + inc, 86400),
         ultimo_em = now()
  RETURNING segundos INTO total;

  RETURN coalesce(total, 0);
END;
$function$;

REVOKE ALL ON FUNCTION public.registrar_uso_ativo(uuid, integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.registrar_uso_ativo(uuid, integer) TO service_role;