# Todas as margens na ficha do lead

Hoje a ficha mostra apenas uma "Margem informada". Quando a planilha traz mais de um tipo de margem (empréstimo, cartão de crédito, cartão benefício, margem bruta/utilizada), nada disso aparece. E quando o dado não existe, o campo diz "Não veio na planilha", que não ajuda a consultora.

## O que muda

1. **Bloco "Margens" na ficha do lead**, logo abaixo dos telefones, com um cartão por tipo:
  - Margem disponível para empréstimo
  - Margem disponível cartão de crédito
  - Margem cartão benefício
  - &nbsp;
  - &nbsp;
2. **Texto quando falta a informação:** onde não houver valor, aparece **"Consultar no app do servidor"** em vez de "Não veio na planilha".
3. Cada valor é exibido em reais (R$ 1.234,56) utilizando o coeficiente de cada produto e banco, lido da planilha aceitando variações de nome de coluna, acento e maiúsculas.

## Importante sobre os leads já cadastrados

Os 36.604 leads atuais foram importados antes de guardarmos a linha original da planilha, então nenhum deles tem os tipos de margem separados — só 10.664 têm a "margem informada". Para esses, os cartões de margem vão mostrar "Consultar no app do servidor" até que a planilha seja reimportada com "Atualizar leads existentes". Nas importações novas os valores já aparecem.

## Detalhes técnicos

- `src/routes/_authenticated/prospeccao.$leadId.tsx`: novo bloco de margens usando `rawField` com aliases (`margem_disp_emprestimo`, `margem disponivel emprestimo`, `margem_disp_cartao_credito`, `margem cartao credito`, `margem_util_cartao_beneficio`, `margem bruta`, `margem utilizada`), parse numérico pt-BR reaproveitando `parseNumeroBr` de `src/lib/prospeccao/admin-import.ts`, formatação com o `BRL` já existente; fallback textual único ("Consultar no app do servidor"). Excluir esses campos de `extrasPlanilha` para não duplicar.
- Sem mudanças de banco, de importação, de pontuação ou em outras telas (Tomadores AL e Radar ficam fora).