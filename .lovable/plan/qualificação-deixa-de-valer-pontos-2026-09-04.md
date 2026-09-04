# Qualificação deixa de valer pontos

Hoje qualquer lead marcado como "qualificado" com uma situação escrita rende 10 pontos, o que é fácil de inflar. A qualificação passa a ser apenas registro de trabalho, sem pontos, e a venda conferida pelo gerente passa a valer mais.

## O que muda

1. **Qualificar não pontua mais**
   - Marcar um lead como qualificado/proposta continua salvando situação, status e histórico, mas não gera pontos.
   - No lugar do aviso "+10 pontos", a consultora vê uma mensagem simples de que a qualificação foi registrada e que os pontos vêm de contatos, follow-ups cumpridos e vendas confirmadas.

2. **Venda confirmada vale mais**
   - Venda conferida pelo gerente sobe de 25 para 40 pontos.
   - O limite diário dessa categoria sobe de 40 para 120 pontos, para caber até três vendas confirmadas no mesmo dia.

3. **Pontos de qualificação desta semana são zerados**
   - Removo os lançamentos de qualificação da semana atual; o ranking recalcula na hora com contatos, follow-ups e vendas.

4. **Coluna "qualificações" sai do ranking**
   - O ranking (cartão e tabela) mostra contatos, follow-ups e vendas. Nada mais fica visível sobre qualificações.

## Detalhes técnicos

- `src/lib/prospeccao/competicao.server.ts`: remover `qualificacao` de `PONTOS` e de `TETO_DIARIO`, `ganho: 25 → 40`, teto de `ganho: 40 → 120`; ajustar o tipo `Categoria`. Manter `estornar(...)` aceitando `"qualificacao"` para não quebrar históricos antigos.
- `src/lib/prospeccao/competicao.functions.ts` (`registrarQualificacao`): retirar a chamada `creditar(..., "qualificacao", ...)` e as checagens só existentes para ela (telefone/situação, janela de 5 minutos após o contato); retornar `{ pontos: 0, motivo: "Qualificação registrada. Pontos vêm de contatos, follow-ups e vendas confirmadas." }`. Ramo `ganho` e `cancelarVenda` seguem iguais; o estorno em `status === "novo"` mantém `["qualificacao","ganho"]` para limpar registros legados.
- Remover a constante `QUALIFICACAO_MIN_APOS_CONTATO_MS` e o helper `primeiroContatoEm` se ficarem sem uso.
- `src/components/prospeccao/CompeticaoRanking.tsx`: remover a coluna e o chip de `qualificacoes`. A função de ranking do banco continua devolvendo o campo, apenas não é exibido.
- Zerar a semana atual com operação de dados: apagar de `prospect_pontos` as linhas com `categoria = 'qualificacao'` e `week_start = competicao_week_start(now())`.
- Rodar checagem de tipos e abrir `/prospeccao` e um lead para confirmar as mensagens.
