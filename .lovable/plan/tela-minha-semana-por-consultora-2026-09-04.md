# Tela "Minha semana" por consultora

Uma página só dela: quantos pontos fez na semana, quanto tempo ficou realmente ativa no sistema, o ritmo dia a dia e a lista de tudo que pontuou (ou deixou de pontuar). O gerente abre a mesma tela para qualquer consultora.

## O que a tela mostra

1. **Resumo da semana** (cartões no topo)
  - Pontos totais da semana e posição no ranking.
  - Pontos por tipo de ação: contatos, follow-ups cumpridos e vendas confirmadas.
  - Tempo ativo na semana e tempo ativo de hoje (o tempo já medido por cliques/digitação, não só janela aberta).
  - Contatos de hoje x meta diária da jornada dela, com barra de progresso.
  - Compare em um gráfico em linhas limpo e de fácil visualização,   todas as semanas da consultora e adicione a média de crescimento ou baixo rendimento ( use as palavras corretas)
2. **Ritmo da semana**
  - Uma linha por dia (segunda a hoje): pontos do dia, contatos do dia, tempo ativo do dia e pontos por hora ativa.
  - Destaque simples do melhor dia e aviso quando um dia tem tempo ativo alto e poucos pontos.
3. **Histórico de pontuação por ação**
  - Tabela com data/hora, ação (contato, follow-up, venda), lead/cliente, motivo e pontos.
  - Marca em cinza os lançamentos anulados pelo gerente e mostra "0 pt" com o motivo.
  - Junto, uma aba com as vendas em stand-by aguardando conferência do gerente, para ela ver o que ainda não virou ponto.
4. **Acesso**
  - Consultora abre `/prospeccao/minha-semana` e vê só os próprios dados.
  - Gerente pode escolher a consultora num seletor no topo (só admin vê o seletor).
  - Link para a tela no painel de prospecção e, para o gerente, na aba da competição.

## Detalhes técnicos

- Nova função de servidor `getMinhaSemana` em `src/lib/prospeccao/minha-semana.functions.ts`, com `requireSupabaseAuth` e entrada opcional `{ userId, weekStart }`. Se `userId` vier diferente do próprio, valida admin com `assertAdmin` (de `prospeccao.server`) antes de continuar.
- Retorno único e serializável: `{ nome, weekStart, isAdmin, totais: { pontos, contatos, followups, ganhos }, posicao, usoSemanaSegundos, usoHojeSegundos, metaDiaria, contatosHoje, dias: [{ data, pontos, contatos, usoSegundos }], extrato: [{ id, categoria, pontos, motivo, ref_tabela, ref_id, created_at, anulado_em, cliente }], vendasPendentes: [...] }`.
- Fontes: `prospect_pontos` (semana, por categoria/dia), `app_uso_ativo` (semana, por `ref_date`), `prospect_jornada` (meta diária), `lead_events` (contatos do dia/dia a dia), `prospect_vendas` (status pendente), `ranking_competicao` (posição) e `profiles` para o nome. Leitura com `supabaseAdmin` carregado dentro do handler, após a checagem de permissão.
- Nomes de cliente: `prospect_leads.nome` e `tomadores_al.nome`, resolvidos em lote pelos `ref_id` do extrato.
- Semana e fuso reutilizam `weekStart()` de `competicao.server.ts` e a virada 03:00 UTC (Maceió) já usada em `jornada.functions.ts`.
- Nova rota `src/routes/_authenticated/prospeccao.minha-semana.tsx` com `head()` próprio, `useServerFn` + `useQuery` (refetch a cada 60s) e seletor de consultora só quando `isAdmin`. Componentes de UI em `src/components/prospeccao/minha-semana/` (cartões de resumo, tabela de ritmo, tabela de extrato), usando os cartões/tabelas já existentes do projeto.
- Nenhuma mudança de banco é necessária.

## Ainda em andamento (etapa anterior, já aprovada)

Fechar a remoção dos pontos de qualificação: coluna "Qualificados" saindo da tabela do ranking, checagem de tipos e limpeza dos pontos de qualificação da semana atual.