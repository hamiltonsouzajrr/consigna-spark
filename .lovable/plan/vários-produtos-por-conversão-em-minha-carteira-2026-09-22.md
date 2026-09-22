# Vários produtos por conversão em Minha carteira

## Objetivo
Permitir que a consultora registre, numa mesma conversão, mais de um produto — Empréstimo novo, Cartão de crédito, Cartão benefício e Refinanciamento — informando o banco de cada um. E permitir salvar o cliente digitado à mão quando ele não estiver no CRM.

## Como vai funcionar
- No formulário "Nova conversão", abaixo dos dados do cliente, entra a lista "Produtos vendidos".
- Cada produto é uma linha com: tipo do produto, banco (texto livre), valor liberado, prazo, valor da parcela e margem usada.
- Botão "Adicionar produto" para incluir quantas linhas forem necessárias; cada linha pode ser removida.
- O total do valor liberado e da margem usada é a soma das linhas e aparece em destaque no formulário e no card.
- Continua existindo uma única escolha por conversão para: cliente, data da operação, "usou toda a margem / ainda restou margem" e valor que sobrou, lembrete e observação.
- O cliente pode ser escolhido da carteira (como hoje) ou digitado à mão. Quando digitado, a conversão é salva com nome e CPF informados, sem vínculo com o CRM, e fica marcada como "cliente avulso" para o gerente saber.
- O card da conversão passa a listar os produtos (produto · banco · valor · prazo · parcela) e o status de confirmação continua igual.
- Conversões já registradas continuam aparecendo: viram uma conversão com um único produto.

## Detalhes técnicos
- Migração: nova tabela `prospect_conversao_itens` (conversao_id, produto enum texto validado, banco, valor_liberado, prazo, valor_parcela, margem_usada, created_at/updated_at + trigger), com GRANTs e RLS — consultora lê/grava apenas itens de conversões suas; admin/gestor lê todas. Índice por `conversao_id`.
- Migração: coluna `origem` passa a aceitar `manual`; `prospect_conversoes` ganha `cliente_manual boolean default false`. Totais de `valor_liberado` e `margem_usada` no registro-pai continuam preenchidos com a soma dos itens, para não quebrar dashboards, vendas pendentes e pontuação.
- Backfill: para cada conversão existente, criar um item a partir de `tipo_margem`, `valor_liberado`, `prazo`, `valor_parcela`, `margem_usada`.
- `conversoes.functions.ts`: schema passa a aceitar `itens: [{ produto, banco, valorLiberado, prazo, valorParcela, margemUsada }]` (mínimo 1); criação/edição gravam pai + itens em transação lógica (substitui itens na edição); listagem devolve `itens` por conversão. A exigência de `leadId`/`tomadorId` só vale quando a origem for `crm`/`tomadores_al`; origem `manual` exige nome e aceita CPF opcional.
- Preserva o comportamento atual de lembrete (`lembrete_em`, tarefa vinculada, `next_follow_up_at`) e de venda pendente para confirmação do gerente.
- `prospeccao.conversoes.tsx`: formulário com lista dinâmica de produtos, totais somados, seletor de cliente com opção "usar o nome digitado", e cards exibindo os produtos.

## Validação
- Salvar conversão com 1, 2 e 4 produtos; editar removendo e adicionando linhas.
- Salvar com cliente do CRM e com cliente digitado à mão.
- Conferir que uma conversão antiga continua abrindo corretamente na edição.
- Conferir tela em computador e celular e rodar a checagem de tipos.

## Fora do escopo
- Alterar coeficientes, fórmulas financeiras ou regras de pontuação.
- Mudar a confirmação de vendas pelo gerente.
- Apagar históricos de contatos, follow-ups ou vendas.
