CREATE OR REPLACE FUNCTION public.prospect_dashboard_admin()
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  res jsonb;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Acesso restrito a administradores.';
  END IF;

  SELECT jsonb_build_object(
    'crm', (
      SELECT jsonb_build_object(
        'total', count(*),
        'atribuidos', count(consultant_id),
        'sem_responsavel', count(*) - count(consultant_id),
        'trabalhados', count(*) FILTER (WHERE first_response_at IS NOT NULL OR last_contact_at IS NOT NULL),
        'nao_trabalhados', count(*) FILTER (WHERE first_response_at IS NULL AND last_contact_at IS NULL),
        'ganhos', count(*) FILTER (WHERE status = 'ganho'),
        'perdidos', count(*) FILTER (WHERE status = 'perdido'),
        'em_aberto', count(*) FILTER (WHERE status NOT IN ('ganho','perdido')),
        'com_telefone', count(*) FILTER (WHERE length(regexp_replace(coalesce(telefone,''), '\D', '', 'g')) >= 10),
        'esquecidos_3d', count(*) FILTER (
          WHERE status NOT IN ('ganho','perdido')
            AND coalesce(last_contact_at, created_at) < now() - interval '3 days'
        ),
        'contatados_hoje', count(*) FILTER (
          WHERE (last_contact_at AT TIME ZONE 'America/Maceio')::date = (now() AT TIME ZONE 'America/Maceio')::date
        ),
        'contatados_7d', count(*) FILTER (WHERE last_contact_at >= now() - interval '7 days'),
        'adicionados_7d', count(*) FILTER (WHERE created_at >= now() - interval '7 days'),
        'adicionados_30d', count(*) FILTER (WHERE created_at >= now() - interval '30 days')
      )
      FROM public.prospect_leads
    ),
    'por_status', (
      SELECT coalesce(jsonb_object_agg(s.status, s.n), '{}'::jsonb)
      FROM (SELECT status::text AS status, count(*) AS n FROM public.prospect_leads GROUP BY 1) s
    ),
    'lotes', (
      SELECT coalesce(jsonb_agg(x), '[]'::jsonb) FROM (
        SELECT coalesce(nullif(btrim(l.import_batch), ''), 'sem lote') AS lote,
               count(*) AS total,
               count(*) FILTER (WHERE l.first_response_at IS NOT NULL OR l.last_contact_at IS NOT NULL) AS trabalhados,
               max(l.created_at) AS ultimo_em
        FROM public.prospect_leads l
        GROUP BY 1
        ORDER BY max(l.created_at) DESC NULLS LAST
        LIMIT 12
      ) x
    ),
    'consultoras', (
      SELECT coalesce(jsonb_agg(x), '[]'::jsonb) FROM (
        SELECT l.consultant_id,
               coalesce(nullif(btrim(p.nome_completo), ''), '—') AS nome,
               count(*) AS recebidos,
               count(*) FILTER (WHERE l.first_response_at IS NOT NULL OR l.last_contact_at IS NOT NULL) AS trabalhados,
               count(*) FILTER (WHERE l.status NOT IN ('ganho','perdido')) AS em_aberto,
               count(*) FILTER (WHERE l.status = 'ganho') AS ganhos
        FROM public.prospect_leads l
        LEFT JOIN public.profiles p ON p.user_id = l.consultant_id
        WHERE l.consultant_id IS NOT NULL
        GROUP BY l.consultant_id, p.nome_completo
        ORDER BY count(*) DESC
      ) x
    ),
    'tomadores', (
      SELECT jsonb_build_object(
        'total', count(*),
        'atribuidos', count(consultora_responsavel),
        'livres', count(*) - count(consultora_responsavel),
        'trabalhados', count(*) FILTER (WHERE coalesce(status_abordagem,'novo') <> 'novo'),
        'convertidos', count(*) FILTER (WHERE status_abordagem = 'convertido'),
        'sem_interesse', count(*) FILTER (WHERE status_abordagem = 'sem_interesse'),
        'em_aberto', count(*) FILTER (WHERE coalesce(status_abordagem,'novo') IN ('novo','contatado','proposta_enviada'))
      )
      FROM public.tomadores_al
    ),
    'promovidos', (
      SELECT jsonb_build_object(
        'total', count(*),
        'atribuidos', count(consultora_responsavel),
        'livres', count(*) - count(consultora_responsavel),
        'contatados', count(*) FILTER (WHERE contatado_em IS NOT NULL),
        'ultimos_15d', count(*) FILTER (WHERE data_publicacao >= current_date - 15)
      )
      FROM public.do_registros
    ),
    'vendas', (
      SELECT jsonb_build_object(
        'total', count(*),
        'valor_total', coalesce(sum(valor_liberado), 0),
        'semana', count(*) FILTER (WHERE data_operacao >= (public.competicao_week_start())),
        'mes', count(*) FILTER (WHERE data_operacao >= date_trunc('month', (now() AT TIME ZONE 'America/Maceio'))::date)
      )
      FROM public.prospect_conversoes
    ),
    'gerado_em', now()
  ) INTO res;

  RETURN res;
END;
$function$;

REVOKE ALL ON FUNCTION public.prospect_dashboard_admin() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.prospect_dashboard_admin() TO authenticated;
GRANT EXECUTE ON FUNCTION public.prospect_dashboard_admin() TO service_role;