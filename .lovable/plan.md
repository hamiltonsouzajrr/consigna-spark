# Tomadores AL: reposição travada + painel admin de distribuição

## O que está acontecendo (verificado no banco agora)

A base "CLIENTES TOMADORES COM MARGEM - AL" acabou. Números reais:

- 8.376 tomadores no total
- **0 sem responsável** (estoque livre zerado — inclusive zerado nas três faixas: alta, média e baixa)
- 8.012 já finalizados (4.506 "convertido" + 3.506 "sem interesse")
- Somente 364 seguem em aberto (349 novos, 10 contatados, 5 com proposta)

A reposição automática só sabe entregar tomadores **sem responsável**. Como não existe nenhum livre, ao finalizar um lead nada entra no lugar. A "reciclagem" que existe hoje também não resolve: ela só devolve ao estoque leads com status "novo" presos a consultoras inativas ou parados há mais de 14 dias — e praticamente não há mais leads nessa condição.

Efeito prático: várias consultoras estão com menos de 10 em aberto (algumas com 0, 1, 3, 4, 5) e a carteira não completa mais, por mais que finalizem.

Observação para decisão: 4.506 marcados como "convertido" é um volume alto demais para vendas reais — provavelmente há leads marcados como convertidos apenas para limpar o card. Vale revisar depois; não muda o conserto do estoque.

## O que fazer

### 1. Destravar a reposição (raiz do problema)

- **Reciclagem de finalizados antigos**: quando o estoque livre de uma faixa zera, devolver ao pool tomadores marcados como "sem interesse" há mais de X dias (padrão sugerido: 60), preservando o histórico do atendimento anterior (quem atendeu e o motivo ficam registrados) e nunca devolvendo para a mesma consultora que os finalizou. "Convertido" nunca volta ao pool automaticamente.
- **Reposição de verdade em vez de silêncio**: quando não há como completar a carteira, a tela da consultora passa a dizer claramente "estoque esgotado — aguardando nova planilha" em vez de simplesmente mostrar a carteira incompleta.
- **Job diário**: manter a reposição automática já existente, agora capaz de usar o pool reciclado.

### 2. Aba admin de distribuição (dentro de Tomadores AL)

Reorganizar o bloco de administrador em um painel com:

- **Termômetro do estoque**: total, livres por faixa (alta/média/baixa), em aberto, finalizados, e um alerta vermelho quando o estoque livre de qualquer faixa fica abaixo de um limiar (ex.: menos de 1 carteira completa para o time).
- **Tabela por consultora**: em aberto (por faixa), novos, trabalhados, finalizados, última entrega, e um selo "carteira incompleta" para quem está abaixo de 10 por faixa.
- **Ações administrativas**:
  - Repor carteira de todas as consultoras agora (já existe, com resultado detalhado)
  - Repor a carteira de **uma** consultora específica
  - Reciclar "sem interesse" com mais de N dias (com pré-visualização de quantos voltariam antes de confirmar)
  - Liberar a carteira de uma consultora (devolve os não contatados ao estoque) — útil em desligamento
  - Zerar/reatribuir leads presos a consultoras inativas
- **Importar planilha**: manter, com aviso destacado quando o estoque estiver esgotado, já que é a solução definitiva.
- Toda ação destrutiva passa por diálogo de confirmação, como no painel de Prospecção.

### 3. Ajuste de coerência

Contadores de `radar_consultoras.total_leads_atribuidos` estão divergindo dos números reais em alguns cadastros; recalcular no fim de cada distribuição/reciclagem para o painel não mostrar número inflado.

## Detalhes técnicos

- `src/lib/prospeccao/tomadores-al.functions.ts`: estender `reciclarFaixa` com a regra de "sem interesse" antigo; novas server functions `reciclarSemInteresse` (com modo prévia), `reporCarteiraConsultora`, `liberarCarteiraConsultora`; `getDistribuicaoTomadoresAl` passa a retornar livres por faixa e abertos por faixa por consultora (hoje faz N consultas em loop — trocar por agregação única para não ficar lento com 40+ consultoras).
- `src/routes/_authenticated/tomadores-al.tsx`: extrair o bloco admin para `src/components/tomadores/AdminDistribuicaoCard.tsx` (o arquivo já tem ~1.070 linhas) e montar o painel descrito.
- Sem mudança de schema: `motivo_sem_interesse`, `finalizado_em`, `atribuido_em` e `status_abordagem` já cobrem a reciclagem.
- `src/routes/api/public/hooks/tomadores-repor.ts` continua igual (chama `reporTodasCarteiras`).

## Decisão que preciso de você

Ao reciclar, uso "sem interesse" com mais de **60 dias** como padrão (ajustável na tela). Se preferir outro prazo, ou se quiser que "convertido" antigo também possa voltar, me diga antes de eu implementar.
