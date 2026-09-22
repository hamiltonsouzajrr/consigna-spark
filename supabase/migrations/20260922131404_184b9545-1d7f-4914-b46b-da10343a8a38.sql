ALTER TABLE public.esteira_contratos ALTER COLUMN banco SET DEFAULT '';
UPDATE public.esteira_contratos SET banco = '' WHERE banco IS NULL;
ALTER TABLE public.esteira_contratos ALTER COLUMN banco SET NOT NULL;
DROP INDEX IF EXISTS public.esteira_contratos_unico;
CREATE UNIQUE INDEX esteira_contratos_unico ON public.esteira_contratos (cpf, data_venda, banco);