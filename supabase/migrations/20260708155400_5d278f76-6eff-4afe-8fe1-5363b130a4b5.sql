
REVOKE EXECUTE ON FUNCTION public.claim_diario_fila_item(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.claim_diario_fila_item(uuid) TO service_role;
