# Distribuição não aparece para as consultoras — causa e correção

## O que eu verifiquei no banco

A distribuição **está gravando**: nos últimos 40 minutos entraram 4.371 clientes do CRM, 875 tomadores e 1.330 recém-promovidos nas carteiras. O problema não é a gravação, é o que a tela da consultora aceita mostrar.

- **CRM:** dos 4.371 entregues agora, só **42** aparecem na fila dela. A fila mostra apenas cliente com situação "ainda não falei", nunca aberto e sem resposta registrada — e a entrega mandou 4.086 já trabalhados e 2.566 já abertos por outra pessoa. Exemplo real: uma consultora tem 3.039 clientes na carteira e a fila mostra 2.
- **Tomadores AL:** a carteira só mostra os que estão em aberto, e a reposição automática trava em 10 por faixa (30 no total). A entrega do admin não consegue passar disso, e há consultora com 0 tomadores em aberto mesmo depois da distribuição.
- **Recém-promovidos:** aqui os números estão certos (44 a 45 por consultora, todos liberados). Se a tela dela aparece vazia, é a mesma regra de "já contatado" escondendo o que foi entregue.
- **Bônus encontrado:** 743 clientes do CRM estão atribuídos a contas de administrador, que não trabalham fila.

## O que vou corrigir

1. **Entregar o que serve para trabalhar.** A distribuição do CRM passa a priorizar os clientes realmente novos (nunca abertos, sem contato registrado). Os já trabalhados só entram quando o admin marcar a opção "incluir clientes já trabalhados" — e, nesse caso, eles são reiniciados para "ainda não falei" e voltam a aparecer na fila, sem perder o histórico de contatos e anotações.
2. **Avisar quando o estoque de clientes novos acabar.** Antes de entregar, a tela mostra quantos clientes novos existem de fato e quanto cada consultora vai receber; se não houver novos suficientes, ela avisa em vez de "entregar" clientes invisíveis.
3. **Nunca entregar para administrador.** A entrega passa a ignorar contas de administrador e a tela ganha um botão para devolver ao estoque os 743 clientes hoje presos em contas de admin.
4. **Tomadores AL sem teto travado.** A entrega do admin passa a poder elevar a carteira em aberto além dos 10 por faixa (com um número escolhido na tela, padrão 10 por faixa), e a mensagem final informa quanto cada uma recebeu e se o estoque acabou. As regras de reciclagem e de não repetir cliente para a mesma consultora continuam.
5. **A consultora enxerga o que recebeu.** No CRM, além da fila, um bloco "Chegaram para você" listando o que entrou na carteira nas últimas 24 horas, mesmo o que já tinha sido trabalhado antes, com atalho para abrir a ficha. Mesmo aviso na aba Tomadores e em Recém-promovidos.
6. **Conferência real.** Depois das mudanças, entro como consultora e confirmo que o que o admin distribuiu aparece na tela dela, em computador e celular.

## Detalhes técnicos

- `src/lib/prospeccao/prospeccao.functions.ts` — `adminDistributeLeads`: pool de candidatos passa a filtrar `status = 'novo' AND opened_at IS NULL AND first_response_at IS NULL` por padrão; nova opção `incluirTrabalhados` que, quando ligada, também seleciona trabalhados e grava `status='novo'`, `opened_at=null`, `first_response_at=null`, `next_follow_up_at=null` junto da atribuição (histórico em `lead_events`/`notes` intacto). `adminPreviewDistribution` devolve `disponiveisNovos` e `disponiveisTrabalhados` separados.
- Excluir administradores em `listConsultantUsers`/`assertConsultantIds` (já filtra `user_roles`, revisar por que 743 leads têm dono admin) e nova função `adminLiberarLeadsDeAdmins` que zera `consultant_id` desses registros.
- `src/lib/prospeccao/tomadores-al.functions.ts` — `distribuirTomadoresIgualmente(alvoPorFaixa)` repassa o alvo para `garantirPoolFaixa` sem o clamp em `POOL_ALVO`; `garantirPoolFaixa` aceita alvo maior que `POOL_ALVO`. Rodízio por lead/faixa preservado; `reporTodasCarteirasInterno` (job diário) continua chamando com `POOL_ALVO`.
- `src/components/prospeccao/admin/DistribuicaoTab.tsx` — checkbox "incluir clientes já trabalhados (reinicia para 'ainda não falei')", campo de alvo por faixa em Tomadores, prévia mostrando novos vs. trabalhados, aviso de estoque insuficiente, botão para liberar leads presos em contas de admin.
- Novo `chegaramParaMim` (server fn autenticada, escopo `consultant_id`/nome da consultora) somando CRM (`updated_at` nas últimas 24h), `tomadores_al.atribuido_em` e `do_registros.atribuido_em`; bloco em `prospeccao.index.tsx`, aba Tomadores e Recém-promovidos.
- Validar com `npx tsgo --noEmit` e testar no navegador com sessão de consultora (`lovable auth-session --json --user <uuid>`).

## Fora do escopo

Fórmulas e coeficientes das calculadoras, regras de pontuação e da campanha, e qualquer exclusão de histórico de contatos, vendas ou follow-ups.
