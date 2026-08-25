-- Semanas da competição de prospecção
CREATE TABLE public.prospect_competicao_semanas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  week_start date NOT NULL UNIQUE,
  closes_at timestamptz NOT NULL,
  premio_titulo text,
  premio_descricao text,
  revelado boolean NOT NULL DEFAULT false,
  vencedor_user_id uuid,
  placar_final jsonb NOT NULL DEFAULT '[]'::jsonb,
  fechado_em timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.prospect_competicao_semanas TO authenticated;
GRANT ALL ON public.prospect_competicao_semanas TO service_role;

ALTER TABLE public.prospect_competicao_semanas ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Autenticados leem semanas da competicao"
  ON public.prospect_competicao_semanas FOR SELECT TO authenticated USING (true);

CREATE POLICY "Admins gerenciam semanas da competicao"
  ON public.prospect_competicao_semanas FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER set_prospect_competicao_semanas_updated_at
  BEFORE UPDATE ON public.prospect_competicao_semanas
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Extrato de pontos (ledger). Escrito apenas pelo servidor.
CREATE TABLE public.prospect_pontos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  week_start date NOT NULL,
  categoria text NOT NULL CHECK (categoria IN ('contato','qualificacao','followup','ganho')),
  ref_tabela text NOT NULL,
  ref_id uuid NOT NULL,
  pontos integer NOT NULL DEFAULT 0,
  motivo text,
  anulado_em timestamptz,
  anulado_por uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX prospect_pontos_unico_idx
  ON public.prospect_pontos (user_id, week_start, categoria, ref_tabela, ref_id);
CREATE INDEX prospect_pontos_semana_idx ON public.prospect_pontos (week_start, user_id);

GRANT SELECT ON public.prospect_pontos TO authenticated;
GRANT ALL ON public.prospect_pontos TO service_role;

ALTER TABLE public.prospect_pontos ENABLE ROW LEVEL SECURITY;

-- Ranking é interno e visível para todas; escrita nunca vem do cliente.
CREATE POLICY "Autenticados leem pontos"
  ON public.prospect_pontos FOR SELECT TO authenticated USING (true);

-- Semana vigente: segunda 00:00 até sexta 16:00 (horário de Maceió).
CREATE OR REPLACE FUNCTION public.competicao_week_start(_at timestamptz DEFAULT now())
RETURNS date
LANGUAGE sql
IMMUTABLE
SET search_path = public
AS $$
  SELECT (date_trunc('week', (_at AT TIME ZONE 'America/Maceio')))::date
$$;

REVOKE EXECUTE ON FUNCTION public.competicao_week_start(timestamptz) FROM anon;

-- Garante a linha da semana (com horário de encerramento na sexta 16:00).
CREATE OR REPLACE FUNCTION public.competicao_garantir_semana(_week_start date DEFAULT NULL)
RETURNS public.prospect_competicao_semanas
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  ws date := coalesce(_week_start, public.competicao_week_start());
  row public.prospect_competicao_semanas;
BEGIN
  SELECT * INTO row FROM public.prospect_competicao_semanas WHERE week_start = ws;
  IF row.id IS NULL THEN
    INSERT INTO public.prospect_competicao_semanas (week_start, closes_at)
    VALUES (ws, ((ws + 4)::text || ' 16:00')::timestamp AT TIME ZONE 'America/Maceio')
    ON CONFLICT (week_start) DO NOTHING;
    SELECT * INTO row FROM public.prospect_competicao_semanas WHERE week_start = ws;
  END IF;
  RETURN row;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.competicao_garantir_semana(date) FROM anon, authenticated;

-- Registra um ponto respeitando o limite de 1 por lead/categoria/semana e o
-- teto diário por categoria. Retorna os pontos efetivamente creditados.
CREATE OR REPLACE FUNCTION public.registrar_ponto(
  _user_id uuid,
  _categoria text,
  _ref_tabela text,
  _ref_id uuid,
  _pontos integer,
  _motivo text DEFAULT NULL,
  _teto_diario integer DEFAULT NULL
)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  ws date := public.competicao_week_start();
  hoje date := (now() AT TIME ZONE 'America/Maceio')::date;
  usados integer;
  inseridos integer;
BEGIN
  IF _user_id IS NULL OR _ref_id IS NULL THEN RETURN 0; END IF;

  -- Administradores acompanham, mas não pontuam.
  IF public.has_role(_user_id, 'admin') THEN RETURN 0; END IF;

  PERFORM public.competicao_garantir_semana(ws);

  IF _teto_diario IS NOT NULL THEN
    SELECT count(*) INTO usados
      FROM public.prospect_pontos
     WHERE user_id = _user_id
       AND categoria = _categoria
       AND anulado_em IS NULL
       AND (created_at AT TIME ZONE 'America/Maceio')::date = hoje;
    IF usados >= _teto_diario THEN RETURN 0; END IF;
  END IF;

  INSERT INTO public.prospect_pontos
    (user_id, week_start, categoria, ref_tabela, ref_id, pontos, motivo)
  VALUES (_user_id, ws, _categoria, _ref_tabela, _ref_id, _pontos, _motivo)
  ON CONFLICT (user_id, week_start, categoria, ref_tabela, ref_id) DO NOTHING;

  GET DIAGNOSTICS inseridos = ROW_COUNT;
  RETURN CASE WHEN inseridos > 0 THEN _pontos ELSE 0 END;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.registrar_ponto(uuid, text, text, uuid, integer, text, integer) FROM anon, authenticated;

-- Estorna pontos de um lead (usado quando a tratativa é desfeita).
CREATE OR REPLACE FUNCTION public.estornar_pontos(
  _ref_tabela text,
  _ref_id uuid,
  _categorias text[] DEFAULT NULL,
  _motivo text DEFAULT 'estorno automático'
)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  afetados integer;
BEGIN
  UPDATE public.prospect_pontos
     SET anulado_em = now(),
         motivo = coalesce(motivo, '') || ' | ' || _motivo
   WHERE ref_tabela = _ref_tabela
     AND ref_id = _ref_id
     AND anulado_em IS NULL
     AND (_categorias IS NULL OR categoria = ANY(_categorias));
  GET DIAGNOSTICS afetados = ROW_COUNT;
  RETURN afetados;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.estornar_pontos(text, uuid, text[], text) FROM anon, authenticated;

-- Ranking da semana, já ignorando pontos anulados.
CREATE OR REPLACE FUNCTION public.ranking_competicao(_week_start date DEFAULT NULL)
RETURNS TABLE (
  user_id uuid,
  nome text,
  contatos integer,
  qualificacoes integer,
  followups integer,
  ganhos integer,
  total integer
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH ws AS (SELECT coalesce(_week_start, public.competicao_week_start()) AS d),
  agg AS (
    SELECT p.user_id,
           count(*) FILTER (WHERE p.categoria = 'contato')::int      AS contatos,
           count(*) FILTER (WHERE p.categoria = 'qualificacao')::int AS qualificacoes,
           count(*) FILTER (WHERE p.categoria = 'followup')::int     AS followups,
           count(*) FILTER (WHERE p.categoria = 'ganho')::int        AS ganhos,
           coalesce(sum(p.pontos), 0)::int                           AS total
      FROM public.prospect_pontos p, ws
     WHERE p.week_start = ws.d AND p.anulado_em IS NULL
     GROUP BY p.user_id
  )
  SELECT a.user_id,
         coalesce(nullif(btrim(pr.nome_completo), ''), split_part(u.email, '@', 1), 'Consultora') AS nome,
         a.contatos, a.qualificacoes, a.followups, a.ganhos, a.total
    FROM agg a
    LEFT JOIN auth.users u ON u.id = a.user_id
    LEFT JOIN public.profiles pr ON pr.user_id = a.user_id
   ORDER BY a.total DESC, a.ganhos DESC, a.qualificacoes DESC, a.contatos DESC;
$$;

REVOKE EXECUTE ON FUNCTION public.ranking_competicao(date) FROM anon, authenticated;