# Painéis de métricas travando por tempo limite do banco

## O problema (confirmado)

Os painéis de métricas leem dezenas de milhares de linhas de uma vez e somam tudo dentro do aplicativo. Conforme a base cresceu, o banco passou a cancelar essas leituras por tempo limite — resultado: gráficos vazios, carregamento infinito ou erro.

Telas afetadas: Evolução da Prospecção, gráficos do administrador, gráficos da prospecção e o painel de consultoras.

## O que fazer

1. Criar contadores no próprio banco (funções que já devolvem os totais agrupados por consultora, por dia, por origem e por período), em vez de trazer as linhas cruas.
2. Criar os índices que essas contagens precisam (data de criação, consultora, data de atribuição).
3. Ajustar as quatro telas para usar esses contadores, mantendo exatamente os mesmos números e o mesmo formato de gráfico já exibido hoje.
4. Reduzir a janela padrão da Evolução da Prospecção para o período realmente mostrado, em vez de varrer seis meses inteiros a cada abertura.
5. Manter um caminho de segurança: se um contador falhar, a tela mostra aviso claro em vez de ficar carregando para sempre.

## Detalhes técnicos

- Novas funções SQL `security definer` com `GROUP BY` para: contatos/follow-ups por período (`lead_events`, `lead_tasks`), ranking por consultora (`do_registros`), follow-ups por origem, série diária de `tomadores_al.atribuido_em`, e os cinco agregados do painel de consultoras.
- Índices: `lead_events(created_at, kind)`, `lead_events(consultant_id, created_at)`, `lead_tasks(created_at)`, `lead_tasks(consultant_id, status, due_at)`, `do_registros(consultora_responsavel)`, `tomadores_al(consultora_responsavel, atribuido_em)`.
- Substituir os `.limit(50000)`/`.limit(100000)` em `evolucao.functions.ts`, `charts.functions.ts`, `admin/charts.functions.ts` e `dashboard-consultoras.functions.ts` por chamadas `rpc(...)`.
- Verificação: `EXPLAIN (ANALYZE)` antes/depois em cada agregado e comparação dos números atuais com os novos.

## Fora de escopo

Competição, Tomadores AL, Radar e importação de leads não mudam.
