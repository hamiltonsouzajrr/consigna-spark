# Organizar CRM, Tomadores, reciclagem e painel do administrador

## 1. Palavras simples no CRM e nos Tomadores

Trocar os nomes técnicos por frases que a consultora entende, nas duas telas e na ficha do cliente:

| Hoje | Passa a ser |
| --- | --- |
| Novo | Ainda não falei |
| Qualificado | Já falei, tem interesse |
| Proposta | Proposta enviada |
| Ganho | Fechou (venda) |
| Perdido | Não quer agora |

Também: "Follow-up" passa a "Retornar contato", "Score" passa a "Chance de fechar", "Situação" passa a "O que aconteceu". Cada bloco da tela ganha uma linha curta explicando para que serve. Nada de regra, cálculo ou pontuação muda — só o texto que aparece.

## 2. Reciclar clientes já trabalhados (só o administrador)

Nova área "Reciclar clientes" dentro do painel do administrador, para CRM e para Tomadores:

- O administrador escolhe o tempo sem movimento: 7, 15 ou 30 dias.
- A tela mostra antes quantos clientes entram na conta, separados por consultora, e permite escolher quais consultoras vão receber.
- Ao confirmar, os clientes voltam para a fila das consultoras selecionadas, com aviso na ficha de que já foi trabalhado antes e por quem, mantendo todo o histórico de contatos, anotações e vendas.
- Clientes com venda fechada não voltam.
- Fica registrado cada reciclagem (quem fez, quando, quantos, quantos dias), para conferência.

## 3. Aviso com pop-up e som quando a base estiver acabando

Para o administrador, em qualquer tela do sistema:

- Aviso amarelo quando faltar pouco: menos de 20 clientes livres na fila de uma consultora.
- Aviso vermelho quando zerar: nenhum cliente livre.
- Toca um som curto junto com o pop-up; o administrador pode desligar o som num botão que fica lembrado.
- Vale para CRM e para Tomadores, com o nome da consultora e um atalho para distribuir ou reciclar.
- Cada aviso só aparece uma vez a cada seis horas por consultora, para não incomodar.

## 4. Painel do administrador em uma tela só, com abas

Uma tela "Administração da prospecção" com abas:

- Resumo: números do dia, filas por consultora e alertas.
- Clientes (leads): o que hoje é painel de leads e leads sem consultora.
- Distribuir e reciclar: entrega de lotes e a reciclagem do item 2.
- Vendas: conferência das vendas pendentes.
- Metas: metas por consultora.
- Qualidade: qualidade e evolução da base.

O menu lateral fica com um item só, "Administração da prospecção", em lugar de cinco. Os endereços antigos continuam funcionando, abrindo a aba correspondente.

## 5. Revisão de tela (computador e celular)

Passar por CRM, Tomadores, ficha do cliente e painel do administrador conferindo que nada fica escondido atrás de barras ou fora da tela no celular, com botões grandes o suficiente para o dedo.

## Detalhes técnicos

- Textos: mapa único de rótulos em `src/lib/prospeccao/constants.ts` (rótulo por status/etapa), consumido por `prospeccao.index.tsx`, `prospeccao.$leadId.tsx`, `tomadores-al.tsx` e telas admin. Valores gravados no banco não mudam.
- Reciclagem: reaproveitar `trabalhados.functions.ts`, ampliando o núcleo para aceitar `dias` de 7/15/30, prévia (contagem sem gravar) e origem `crm` | `tomadores_al`; excluir `status = ganho`; manter `applyAssignments`/`reattachLeadHistory`. Nova tabela `prospect_reciclagens` (admin, origem, dias, total, criado_em) com GRANTs e RLS só para admin. Equivalente para `tomadores_al` liberando `consultora_responsavel` e redistribuindo em round-robin.
- Marca de já trabalhado: coluna `reciclado_em` + `reciclado_de` (consultora anterior) em `prospect_leads` e `tomadores_al`, exibida na ficha.
- Alertas: generalizar `tomadores-al.notificacoes.ts` numa função `verificarFilasProspeccao` que conta filas livres por consultora nas duas bases e grava em `diario_alertas` com tipos `fila_baixa` / `fila_zerada`, dedup de 6h por consultora. Componente `AlertaFilaPopup` no `AppShell`, polling de 60s, som via elemento de áudio curto e preferência em `localStorage`.
- Painel: nova rota `prospeccao.admin.tsx` com abas por parâmetro `aba` na URL, importando o conteúdo atual de `admin.leads`, `admin.orfaos`, `admin.vendas`, `admin.metas` e `qualidade` como componentes com prop `embedded`; rotas antigas ganham `beforeLoad` redirecionando para a aba. `AppShell` reduz os itens admin de prospecção a um.
- Validação: `npx tsgo --noEmit` e conferência em desktop e mobile.

## Fora do escopo

Fórmulas e coeficientes das calculadoras, regras de pontuação e da campanha, confirmação de vendas pelo gerente, e qualquer exclusão de histórico.
