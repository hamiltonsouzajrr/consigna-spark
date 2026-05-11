UPDATE public.consultas_margem
SET erro_tipo = CASE
  WHEN erro IS NULL THEN NULL
  WHEN erro ~* 'Credenciais.*ausentes' THEN 'credenciais_ausentes'
  WHEN erro ~* 'Falha de login' THEN 'login_falhou'
  WHEN erro ~* 'Nenhum órgão' THEN 'sem_orgaos'
  WHEN erro ~* 'sessao_expirada|sess[ãa]o expirou' THEN 'sessao_expirada'
  WHEN erro ~* 'Margem não localizada' AND erro !~* 'popup_alerta|sem_resultado|falha_trocar_orgao|excecao' AND erro ~* 'sem_link_margem' THEN 'sem_link_margem'
  WHEN erro ~* 'popup_alerta' THEN 'popup_alerta'
  WHEN erro ~* 'sem_resultado' THEN 'sem_resultado'
  WHEN erro ~* 'falha_trocar_orgao' THEN 'falha_trocar_orgao'
  WHEN erro ~* 'excecao' THEN 'excecao_consulta'
  WHEN erro ~* 'Margem não localizada' THEN 'margem_nao_localizada'
  ELSE 'outro'
END
WHERE status = 'erro' AND erro_tipo IS NULL;