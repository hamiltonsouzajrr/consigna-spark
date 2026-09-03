# Diagnóstico: promovidos recentes chegam às consultoras?

## Resultado da verificação (somente leitura)

O encanamento está correto, mas na prática **quase nenhuma consultora vê leads hoje**.

Verificado no banco agora:

- 1.240 registros do Radar, **todos liberados** e **todos com consultora responsável** (52 nomes distintos).
- Permissões: a política de leitura das consultoras exige lead liberado + nome igual ao da conta; nenhum responsável está fora do cadastro, então o vínculo por e-mail está funcionando.
- A aba mostra apenas publicações dos **últimos 15 dias**. Nessa janela existem só **24 registros**:
  - Willyanealves: 19
  - Emellyelisa, Fernanda, Hemelynathalia, Itamara: 1 cada
  - rnannoella3012: 1 — este nome **não tem conta no sistema**, então esse lead está invisível para todos
- Última publicação capturada: **01/09/2026** (nada novo nos últimos 2 dias).
- 56 consultoras cadastradas, **34 com conta**. Ou seja: ~29 consultoras com conta abrem a aba e veem vazio.

Conclusão: não é bug de RLS nem de distribuição — é **falta de volume novo na janela de 15 dias** e **concentração desigual** do pouco que entrou.

## O que corrigir

1. **Rebalancear a janela atual**: redistribuir igualmente os registros dos últimos 15 dias entre as consultoras com conta ativa (hoje 19 de 24 estão em uma só), e reatribuir o lead órfão de `rnannoella3012` para alguém com conta.
2. **Fallback quando a janela está vazia**: se a consultora não tem nenhum promovido nos últimos 15 dias, exibir os promovidos mais recentes atribuídos a ela (com selo de idade) em vez de tela vazia, mantendo o destaque de "janela de ouro 48h" para os recentes.
3. **Aviso honesto na aba**: quando não houver captura nova, mostrar a data da última publicação disponível e a data da última entrega, para a consultora não achar que o sistema quebrou.
4. **Checagem da captura**: rodar repescagem/varredura de lacunas de 02–03/09 e conferir no cartão de saúde do Radar se as buscas diárias estão realmente concluindo; se houver edições pendentes, destravar a fila.
5. **Cobertura de contas**: listar no painel admin as consultoras cadastradas **sem conta** (22 hoje) para não receberem leads em vão.

## Detalhes técnicos

- Rebalanceamento via RPC existente de redistribuição igualitária, restrita a `data_publicacao >= current_date - 15` e a consultoras com e-mail que existe em `auth.users`.
- Fallback e avisos em `src/lib/radar/promovidos-recentes.functions.ts` (nova consulta secundária sem o `gte` de 15 dias, com flag `foraDaJanela`) e na UI de `src/routes/_authenticated/prospeccao.promovidos-recentes.tsx`.
- Repescagem/lacunas pelos fluxos já implementados em `diario-scheduler.server.ts` e pelos cartões `RadarSaudeCard` / `LiberacaoPromovidosCard` em `/radar`.
- Lista de consultoras sem conta como consulta adicional no painel de acessos, sem alterar cadastros existentes.
