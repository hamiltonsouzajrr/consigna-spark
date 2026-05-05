ALTER TABLE public.consultas_margem
  ADD COLUMN IF NOT EXISTS margem_emprestimo numeric,
  ADD COLUMN IF NOT EXISTS margem_cartao_credito numeric,
  ADD COLUMN IF NOT EXISTS margem_cartao_beneficio numeric,
  ADD COLUMN IF NOT EXISTS servidor_nome text,
  ADD COLUMN IF NOT EXISTS matricula text,
  ADD COLUMN IF NOT EXISTS categoria text,
  ADD COLUMN IF NOT EXISTS situacao text,
  ADD COLUMN IF NOT EXISTS orgao text;