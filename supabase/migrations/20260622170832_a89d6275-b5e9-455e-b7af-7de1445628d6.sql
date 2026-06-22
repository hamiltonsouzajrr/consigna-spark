ALTER TABLE public.do_registros
  ADD COLUMN IF NOT EXISTS potencial_financeiro text,
  ADD COLUMN IF NOT EXISTS motivo_classificacao text;