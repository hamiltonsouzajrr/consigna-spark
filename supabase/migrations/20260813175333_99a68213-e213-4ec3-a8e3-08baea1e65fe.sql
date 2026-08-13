ALTER TABLE public.tomadores_al
  ADD COLUMN IF NOT EXISTS motivo_sem_interesse text,
  ADD COLUMN IF NOT EXISTS finalizado_em timestamp with time zone;