CREATE INDEX IF NOT EXISTS prospect_leads_nome_trgm_idx ON public.prospect_leads USING gin (nome gin_trgm_ops);
CREATE INDEX IF NOT EXISTS prospect_leads_cpf_idx ON public.prospect_leads (cpf);
CREATE INDEX IF NOT EXISTS do_registros_nome_servidor_trgm_idx ON public.do_registros USING gin (nome_servidor gin_trgm_ops);
CREATE INDEX IF NOT EXISTS do_registros_nome_completo_trgm_idx ON public.do_registros USING gin (nome_completo gin_trgm_ops);