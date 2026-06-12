
-- ============ positiva_checkins ============
CREATE TABLE public.positiva_checkins (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  ref_date date NOT NULL DEFAULT (now() AT TIME ZONE 'America/Maceio')::date,
  periodo text NOT NULL CHECK (periodo IN ('08h','11h','15h','17h')),
  energia int CHECK (energia BETWEEN 1 AND 3),
  respostas jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, ref_date, periodo)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.positiva_checkins TO authenticated;
GRANT ALL ON public.positiva_checkins TO service_role;
ALTER TABLE public.positiva_checkins ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own checkins" ON public.positiva_checkins FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "admin read checkins" ON public.positiva_checkins FOR SELECT TO authenticated USING (public.has_role(auth.uid(),'admin'));

-- ============ positiva_atividades ============
CREATE TABLE public.positiva_atividades (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  ref_date date NOT NULL DEFAULT (now() AT TIME ZONE 'America/Maceio')::date,
  tipo text NOT NULL CHECK (tipo IN ('ligacao','prospeccao','proposta','followup','contrato','reativacao')),
  quantidade int NOT NULL DEFAULT 1 CHECK (quantidade > 0),
  meta jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.positiva_atividades TO authenticated;
GRANT ALL ON public.positiva_atividades TO service_role;
ALTER TABLE public.positiva_atividades ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own atividades" ON public.positiva_atividades FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "admin read atividades" ON public.positiva_atividades FOR SELECT TO authenticated USING (public.has_role(auth.uid(),'admin'));

-- ============ positiva_missoes ============
CREATE TABLE public.positiva_missoes (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  ref_date date NOT NULL DEFAULT (now() AT TIME ZONE 'America/Maceio')::date,
  chave text NOT NULL,
  titulo text NOT NULL,
  alvo int NOT NULL DEFAULT 1,
  progresso int NOT NULL DEFAULT 0,
  concluida boolean NOT NULL DEFAULT false,
  xp int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, ref_date, chave)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.positiva_missoes TO authenticated;
GRANT ALL ON public.positiva_missoes TO service_role;
ALTER TABLE public.positiva_missoes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own missoes" ON public.positiva_missoes FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "admin read missoes" ON public.positiva_missoes FOR SELECT TO authenticated USING (public.has_role(auth.uid(),'admin'));

-- ============ positiva_humor ============
CREATE TABLE public.positiva_humor (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  ref_date date NOT NULL DEFAULT (now() AT TIME ZONE 'America/Maceio')::date,
  estado text NOT NULL CHECK (estado IN ('motivada','normal','cansada','desanimada')),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, ref_date)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.positiva_humor TO authenticated;
GRANT ALL ON public.positiva_humor TO service_role;
ALTER TABLE public.positiva_humor ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own humor" ON public.positiva_humor FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "admin read humor" ON public.positiva_humor FOR SELECT TO authenticated USING (public.has_role(auth.uid(),'admin'));

-- ============ positiva_score ============
CREATE TABLE public.positiva_score (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  ref_date date NOT NULL DEFAULT (now() AT TIME ZONE 'America/Maceio')::date,
  hunter_score int NOT NULL DEFAULT 0 CHECK (hunter_score BETWEEN 0 AND 100),
  dimensoes jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, ref_date)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.positiva_score TO authenticated;
GRANT ALL ON public.positiva_score TO service_role;
ALTER TABLE public.positiva_score ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own score" ON public.positiva_score FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "admin read score" ON public.positiva_score FOR SELECT TO authenticated USING (public.has_role(auth.uid(),'admin'));

-- ============ positiva_coach_messages ============
CREATE TABLE public.positiva_coach_messages (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role text NOT NULL CHECK (role IN ('user','assistant')),
  content text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.positiva_coach_messages TO authenticated;
GRANT ALL ON public.positiva_coach_messages TO service_role;
ALTER TABLE public.positiva_coach_messages ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own coach msgs" ON public.positiva_coach_messages FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "admin read coach msgs" ON public.positiva_coach_messages FOR SELECT TO authenticated USING (public.has_role(auth.uid(),'admin'));

-- ============ positiva_alertas ============
CREATE TABLE public.positiva_alertas (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  tipo text NOT NULL CHECK (tipo IN ('baixa_performance','solicitacao_ajuda','humor','inatividade')),
  mensagem text NOT NULL,
  resolvido boolean NOT NULL DEFAULT false,
  meta jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.positiva_alertas TO authenticated;
GRANT ALL ON public.positiva_alertas TO service_role;
ALTER TABLE public.positiva_alertas ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own alertas" ON public.positiva_alertas FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "admin read alertas" ON public.positiva_alertas FOR SELECT TO authenticated USING (public.has_role(auth.uid(),'admin'));
CREATE POLICY "admin update alertas" ON public.positiva_alertas FOR UPDATE TO authenticated USING (public.has_role(auth.uid(),'admin'));

-- ============ updated_at triggers ============
CREATE TRIGGER trg_positiva_checkins_updated BEFORE UPDATE ON public.positiva_checkins FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER trg_positiva_missoes_updated BEFORE UPDATE ON public.positiva_missoes FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER trg_positiva_score_updated BEFORE UPDATE ON public.positiva_score FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
