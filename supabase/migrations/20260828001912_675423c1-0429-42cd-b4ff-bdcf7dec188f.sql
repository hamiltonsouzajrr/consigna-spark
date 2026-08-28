ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS senha_temporaria boolean NOT NULL DEFAULT false;

UPDATE public.profiles p
   SET senha_temporaria = true
 WHERE p.user_id = '4cc0ac14-bf2e-4a0e-82ca-c271cbd700b8';