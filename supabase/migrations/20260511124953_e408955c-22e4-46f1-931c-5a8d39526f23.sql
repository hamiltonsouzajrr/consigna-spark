ALTER TABLE public.consultas_margem ADD COLUMN IF NOT EXISTS erro_tipo TEXT;
CREATE INDEX IF NOT EXISTS idx_consultas_margem_erro_tipo ON public.consultas_margem(user_id, erro_tipo);