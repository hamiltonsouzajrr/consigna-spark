# Nova aba "Quitação - Cartão de Crédito (NG)": compra de dívida Transfer NG

A planilha tem 1.876 servidores, todos com "PRÉ ANÁLISE - APROVADO". Desses, **1.835 têm troco de R$ 50 ou mais no prazo de 96x**, com potencial total de cerca de **R$ 3,9 milhões**. Outros 410 clientes têm 2 ou mais contratos.
O roteiro Transfer NG exige: troco mínimo de R$ 50, somente clientes novos, taxas de 4,25%, 4,50%, 4,80% ou 4,99%, "Carta Saldo", banco 999 (Vem Benefícios), corte da mesa às 14h e do financeiro às 15h, liberação em 48h e três documentos.

## O que vou construir

**1. Item novo no menu: "Quitação - Cartão de Crédito (NG)"**
- A aba de Quitação atual continua como está.
- Na aba NG, o administrador envia a planilha e vê uma prévia com o total, quantos atingem o troco mínimo, quantos ficam abaixo, quantos já existem e quantos têm telefone. Depois confirma.
- Os clientes abaixo de R$ 50 de troco são importados, mas ficam marcados como "Não atende o roteiro" e não são distribuídos.
- Se a planilha for reenviada, os valores são atualizados sem duplicar. A consultora e o histórico continuam os mesmos.

**2. Distribuição equilibrada**
- Pode ser feita por quantidade ou por troco total, para que nenhuma consultora fique só com os clientes de valor baixo.

**3. Card e ficha do cliente**
- Mostram saldo devedor, parcela, parcelas pagas e em aberto, número de contratos, prazo com o maior troco e a tabela de 96x a 36x. Prazos com troco abaixo de R$ 50 aparecem em vermelho.
- Aviso **"Selecione TODOS os X contratos"** para quem tem mais de um contrato.
- Prioridade alta, média ou baixa, calculada pelo troco, pelas parcelas pagas e por ter telefone. A lista abre nessa ordem.
- Telefones puxados pelo CPF do CRM, do Tomadores AL e das fichas RockData já salvas, com botões de ligar e WhatsApp.

**4. Roteiro de digitação na própria ficha (checklist)**
Um botão "Digitar proposta" abre os passos do roteiro, com botões para copiar os dados:
1. Empregador 000191, produto 59 e tipo "Cartão – Compra de Dívida".
2. Histórico de liberação "Carta Saldo" (boleto não é permitido) e banco 999 – Vem Benefícios.
3. Consultar pela lupa e marcar todos os contratos.
4. Escolher a tabela: NG00419 (4,25%), NG00359 (4,50%), NG00386 (4,80%) ou NG00360 (4,99%). Depois "Simular Saque" e "Solicitar Proposta".
5. Documentos: termo de confissão de dívida, solicitação de saldo devedor e autorização de quitação de saldo.
6. Confirmar que o cliente é novo, como o roteiro exige.

**5. Avisos de horário**
- Faixa no topo com o horário de corte: "Mesa fecha às 14h" e "Financeiro fecha às 15h", com contagem regressiva no horário de Maceió.
- Depois das 15h: "Proposta entra no próximo dia útil".
- Ao marcar como fechado, aparece a previsão de liberação em 48h.

**6. Andamento da proposta**
Status: Novo → Contatado → Interessado → Documentos pendentes → Digitada → Aguardando validação do órgão → Liberada / Recusada. Cada mudança de status fica no histórico e pode ter uma data de retorno.

**7. Painel do administrador**
- Troco potencial total e de cada consultora.
- Clientes em cada etapa do andamento.
- Clientes abaixo do mínimo e clientes sem telefone.

## Ponto de atenção
Os valores da planilha foram calculados a **3,89%**, mas o roteiro usa **4,25% a 4,99%**. Por isso o troco real tende a ser menor. Vou mostrar os valores da planilha com o aviso "estimado a 3,89% – confirme na simulação". Quando a consultora digitar o valor líquido que saiu na simulação, ele fica salvo e passa a valer.

## Fora do escopo
- Recalcular as taxas automaticamente.
- Integração direta com o sistema de digitação.
- Buscar telefones de todos os clientes na RockData de uma vez, porque cada consulta tem custo.

## Detalhes técnicos
- Reaproveitar `quitacao_clientes` com a coluna `produto text default 'geral'` ('ng' para esta aba). Adicionar também: `etapa text`, `prioridade int`, `apto_roteiro bool`, `troco_simulado numeric`, `taxa_simulada text`, `liberacao_prevista timestamptz` e `checklist jsonb`. Único por (produto, cpf, cod_ordem).
- Nova rota `src/routes/_authenticated/quitacao-ng.tsx`, com os componentes de card e anel extraídos da tela atual. Item novo no `AppShell.tsx`.
- As funções atuais recebem o filtro `produto`. Distribuição com `modo: 'quantidade'|'valor'`, gulosa pelo menor troco somado. Constantes do roteiro em `src/lib/prospeccao/ng-roteiro.ts`.
- Telefones: incluir o cache `rockdata_consultas` na busca em lote.
