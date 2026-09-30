# Fazer o "Reiniciar base do CRM" funcionar com muitos leads

## O que está acontecendo
A prévia mostra cerca de 30 mil leads. Ao tocar em "Reiniciar agora", o sistema tenta mexer em todos de uma vez, um por um, e o banco corta a operação depois de 8 segundos. Como tudo é cancelado junto, nenhum lead foi alterado (o histórico de atendimentos ainda está vazio, o que confirma isso).

## Correção
- O reinício passa a ser feito **em lotes** (ex.: 1.500 leads por vez). O botão repete os lotes sozinho até terminar.
- Durante o processo aparece uma barra de progresso ("12.000 de 30.158"), e o botão fica travado para não rodar duas vezes.
- A divisão entre consultoras passa a ser feita de uma vez por lote (e não lead a lead), mantendo as mesmas regras: por igual, menor fila primeiro e **nunca para quem já atendeu o lead**.
- Se um lote falhar, o que já foi feito fica salvo e o aviso diz quantos foram concluídos; tocar de novo continua de onde parou.

Nada muda nas regras: vendas fechadas continuam de fora e o histórico é preservado.

## Detalhes técnicos
- Migration: recriar `reiniciar_prospect_leads` com `_limite` usado como tamanho do lote; trocar o `FOR ... LOOP` por atribuição set-based (ranking por `row_number()` sobre consultoras elegíveis ordenadas por carga, com `NOT EXISTS` em `prospect_leads_atendimentos`), um único `UPDATE ... FROM` e `SET LOCAL statement_timeout = '60s'` dentro da função não funciona em PostgREST, então manter lote pequeno (1.500) para ficar bem abaixo de 8s. Garantir que o gatilho `trg_prospect_leads_historico_dono` grave o histórico em lote (já é por linha; conferir custo) — se pesado, a função grava o histórico diretamente e o gatilho ignora quando uma flag de sessão estiver ativa.
- `ReiniciarBaseCard.tsx`: loop chamando a função com `_limite: 1500` até `reiniciados = 0`, somando totais e exibindo progresso.
- Conferir o card de Tomadores AL (`ReiniciarTrabalhadosCard`) com a mesma lógica de lotes caso também passe do limite.
