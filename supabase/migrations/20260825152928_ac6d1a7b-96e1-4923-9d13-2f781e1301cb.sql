REVOKE ALL ON FUNCTION public.sync_radar_consultoras() FROM anon, authenticated, PUBLIC;
REVOKE ALL ON FUNCTION public.distribuir_do_registros_pendentes(integer) FROM anon, authenticated, PUBLIC;
REVOKE ALL ON FUNCTION public.redistribuir_do_registros_igualmente(integer, boolean) FROM anon, authenticated, PUBLIC;
GRANT EXECUTE ON FUNCTION public.sync_radar_consultoras() TO service_role;
GRANT EXECUTE ON FUNCTION public.distribuir_do_registros_pendentes(integer) TO service_role;
GRANT EXECUTE ON FUNCTION public.redistribuir_do_registros_igualmente(integer, boolean) TO service_role;