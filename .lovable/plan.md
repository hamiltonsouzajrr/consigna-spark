# Vendas fechadas em stand-by até o admin confirmar

Hoje, quando uma consultora marca um lead como **Ganho** (CRM) ou um tomador como **Convertido** (Tomadores AL), os 25 pontos entram na competição na hora. A mudança: a venda entra em **stand-by** e só vale pontos depois que um administrador conferir e confirmar no painel.

## Como vai funcionar

Para a consultora:
- Ela marca a venda normalmente. O status do lead muda como sempre.
- Em vez de "+25 pontos", ela vê: "Venda registrada. Aguardando conferência do administrador."
- No ranking/extrato, a venda aparece como pendente e não soma nos pontos.

Para o administrador (aba Competição do painel):
- Novo bloco **Vendas aguardando conferência**, com: consultora, cliente, origem (CRM ou Tomadores AL), valor/observação e quando foi registrada.
- Botões **Confirmar** (credita os 25 pontos naquela semana) e **Recusar** (com motivo; nada é creditado e a consultora fica sem os pontos).
- Vendas já confirmadas/recusadas ficam listadas em histórico curto, com quem confirmou e quando.
- Se a venda já tinha sido confirmada e depois é recusada, os pontos são estornados automaticamente.

Regras mantidas: teto diário de vendas, competição pausada não credita, e voltar o lead para "novo" ou "sem interesse" cancela a venda pendente.

## Detalhes técnicos

1. **Migração** — nova tabela `public.prospect_vendas`:
   - `user_id`, `origem` ('crm' | 'tomadores_al'), `ref_tabela`, `ref_id`, `week_start`, `status` ('pendente' | 'confirmada' | 'recusada'), `pontos_creditados`, `motivo_recusa`, `revisado_por`, `revisado_em`, `created_at`/`updated_at` + trigger.
   - Índice único parcial em (`ref_tabela`, `ref_id`) para status 'pendente' (evita duplicar a mesma venda).
   - GRANTs: `SELECT` para `authenticated`, `ALL` para `service_role`; RLS com política de leitura própria (`user_id = auth.uid()`) e política total para `has_role(auth.uid(),'admin')`. Escritas passam pelas server functions com client admin.

2. **`competicao.server.ts`** — novo helper `registrarVendaPendente(userId, origem, refTabela, refId, motivo)` que insere/reaproveita a linha pendente, e `confirmarVenda` / `recusarVenda` (o confirmar chama `creditar(...,'ganho',...)` com o `week_start` da venda; o recusar chama `estornar`).

3. **`competicao.functions.ts`** — em `registrarQualificacao`, o ramo `status === "ganho"` deixa de chamar `creditar` e passa a chamar `registrarVendaPendente`, retornando `{ pontos: 0, motivo: "Venda em stand-by até a conferência do administrador." }`. Novas server functions admin: `adminVendasPendentes`, `adminConfirmarVenda`, `adminRecusarVenda` (todas checando `has_role`).

4. **`tomadores-al.functions.ts`** — o ramo `status === "convertido"` troca `creditar` por `registrarVendaPendente`; `novo`/`sem_interesse` cancelam a pendência além de estornar.

5. **`CompeticaoTab.tsx`** — card "Vendas aguardando conferência" com a lista, botões Confirmar/Recusar (motivo via dialog) e invalidação das queries `competicao-extrato`/`competicao-alertas`/`vendas-pendentes`.

6. **UI da consultora** — ajustar os toasts em `prospeccao.index.tsx` e `prospeccao.$leadId.tsx` para exibir a mensagem de stand-by quando a resposta vier com `pontos: 0` e motivo de conferência.
