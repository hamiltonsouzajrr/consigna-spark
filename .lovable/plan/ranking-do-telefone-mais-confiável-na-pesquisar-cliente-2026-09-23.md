# Ranking do telefone mais confiável na Pesquisar Cliente

## O que descobrimos

A RockData já tem, na lista de telefones, as colunas **Tipo, WhatsApp, Restrição, Válido, Inválido e Qualificação**. Hoje essas colunas chegam vazias no nosso sistema porque o site deles só preenche depois, telefone por telefone ("buscando..."). Ou seja: dá para rankear, buscando essas informações extras.

## Como vai funcionar

- Na ficha do cliente, os telefones passam a aparecer **em ordem de confiança**, com o melhor no topo e um selo: "Mais confiável", "Bom", "Duvidoso", "Inválido".
- Cada telefone mostra: celular ou fixo, se tem WhatsApp, se tem restrição e a qualificação da RockData.
- A nota combina duas fontes:
  1. **RockData**: válido, WhatsApp, celular, sem restrição, qualificação alta sobem a nota; inválido ou com restrição descem.
  2. **Nosso próprio histórico**: se alguma consultora já ligou e o cliente atendeu, ou conversou no WhatsApp por esse número, ele sobe; se ficou registrado "não atende"/"número errado", desce.
- Telefones inválidos ficam no fim, apagados, mas ainda visíveis.
- A qualificação fica guardada junto com a ficha (mesma regra dos 90 dias), sem nova consulta a cada busca.
- Botão "Ligar" e "WhatsApp" já vêm no número mais confiável. E ao clicar e ligar deve compultar no sistema como prospecção 
  &nbsp;

## Ponto de atenção

Preciso confirmar no site da RockData de onde vêm essas informações extras (é uma chamada separada por telefone). Se alguma delas consumir crédito adicional na RockData, aviso antes de ativar, e podemos deixar a qualificação só para quando a consultora clicar.

## Detalhes técnicos

- Investigar no HTML/JS de `LocalizadorPf_View` as chamadas assíncronas das colunas de telefone e reproduzi-las em `rockdata.server.ts` (com limite de paralelismo e timeout; falha em uma não derruba a ficha).
- Novo tipo `RockdataTelefone { numero, tipo, whatsapp, restricao, valido, qualificacao, score, origemSinais }` salvo em `resultado.telefonesDetalhe`; fichas antigas continuam funcionando.
- Função `pontuarTelefone` pura (pesos simples e documentados) + sinais internos lidos de `lead_events`/`prospect_leads`/`tomadores_al` pelo telefone normalizado.
- UI em `consulta-servidor.tsx`: lista ordenada, selos com tokens semânticos (verde/azul/âmbar/vermelho).

## Fora do escopo

- Alterar a regra dos 90 dias, pontuação da campanha ou distribuição de leads.