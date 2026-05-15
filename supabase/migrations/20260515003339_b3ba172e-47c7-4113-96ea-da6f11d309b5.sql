-- Índice composto para acelerar a fila (SELECT por user/status/tentativas)
CREATE INDEX IF NOT EXISTS idx_consultas_margem_queue
  ON public.consultas_margem (user_id, status, tentativas);

-- RPC atômica para incrementar contadores do run sem SELECT+UPDATE
CREATE OR REPLACE FUNCTION public.bump_run_counters(
  _run_id uuid,
  _processed_inc integer,
  _errors_inc integer
)
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  UPDATE public.processar_runs
     SET processed = processed + _processed_inc,
         errors    = errors    + _errors_inc,
         updated_at = now()
   WHERE id = _run_id;
$$;

REVOKE ALL ON FUNCTION public.bump_run_counters(uuid, integer, integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.bump_run_counters(uuid, integer, integer) TO service_role;