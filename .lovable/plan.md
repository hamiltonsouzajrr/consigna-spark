# Categoria e faixa de idade para receber leads no CRM

## O que muda para a consultora
- Nova opção "Minhas preferências de leads" no CRM.
- Ela marca uma ou mais categorias: **PM Ativos - AL**, **PM Inativos - AL**, **Aposentados e Pensionistas - AL**.
- Ela escolhe a faixa de idade (ex.: de 30 a 60 anos).
- Os próximos leads distribuídos para ela seguem essa escolha. Os leads que ela já tem continuam com ela.
- Se não marcar nada, continua recebendo de tudo, como hoje.

## Na importação da planilha (admin)
- O sistema lê a coluna de categoria (nomes aceitos: Categoria, Situação funcional, Vínculo, Tipo, Status do servidor) e a coluna de idade.
- Os textos são padronizados nas três categorias (ex.: "ATIVO", "PM ATIVO" viram PM Ativos; "INATIVO", "RESERVA", "REFORMADO" viram PM Inativos; "APOSENTADO", "PENSIONISTA" viram Aposentados e Pensionistas).
- A prévia da importação mostra quantos leads ficaram em cada categoria e quantos ficaram sem categoria ou sem idade.

## Distribuição
- Continua dividindo por igual, pela menor fila, mas cada lead vai só para quem aceita a categoria e a idade dele.
- Lead sem categoria ou sem idade vai para quem não tem restrição. Se ninguém servir, vai pelo modo normal para não ficar parado.
- O painel admin mostra a preferência de cada consultora e quantos leads disponíveis existem para ela.

## Limitação atual
- Os leads que já estão na base quase não têm idade nem categoria (menos de 10 de 37 mil). O filtro só vai funcionar para as próximas planilhas, ou para as antigas se forem importadas de novo.

## Detalhes técnicos
- Migração: coluna `categoria` (texto: pm_ativo, pm_inativo, aposentado_pensionista) em `prospect_leads`, com índice; tabela `prospect_preferencias_lead` (user_id, categorias text[], idade_min, idade_max) com GRANTs, RLS (a consultora gerencia a própria preferência, admin lê todas) e trigger de updated_at.
- `leads-admin.functions.ts`: extrair categoria/idade no parse e fazer a contagem na prévia.
- Funções de distribuição (`distribuir`/round-robin/trigger `atribuir_consultora_automatico`): escolher entre as consultoras elegíveis de acordo com a preferência, com fallback para a regra atual.
- Nova tela/diálogo em `/prospeccao` com server functions autenticadas para ler e salvar a preferência; coluna de preferência no DistribuicaoTab.
