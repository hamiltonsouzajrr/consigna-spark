# Reiniciar a base de leads do CRM sem repetir consultora

## O que muda para você
No painel admin, na aba Distribuição, entra um botão novo: **"Reiniciar base do CRM"**. Antes de confirmar, você escolhe:
- Quais leads voltam: "Não quer agora", "Sem resposta / em aberto parado há X dias" (7/15/30) ou todos, exceto os que fecharam venda.
- Uma prévia mostra quantos leads voltam e para quantas consultoras eles podem ir.

Depois de confirmar:
1. O sistema guarda quem já atendeu cada lead e o resultado.
2. O lead volta como "Novo", sem responsável e sem tarefas pendentes.
3. A redistribuição é feita por igual e **nunca devolve o lead a quem já o atendeu**, nem nesta nem em reinícios futuros.
4. Se todas as consultoras ativas já atenderam um lead, ele fica "Sem responsável" e aparece contado como "esgotado" no resumo.

Vendas fechadas, anotações e o histórico de contatos continuam guardados. Pontos da competição não são alterados.

## Detalhes técnicos
- Nova tabela `prospect_leads_atendimentos` (lead_id, consultant_id, status_final, atendido_em), com índice único (lead_id, consultant_id), GRANTs, RLS: somente administradores leem.
- Registrar histórico também sempre que o dono de um lead mudar (gatilho em `prospect_leads` quando `consultant_id` muda), para cobrir redistribuições manuais.
- Função `reiniciar_prospect_leads(_status[], _dias_min, _limite)`, security definer e restrita a administradores: grava histórico, limpa `consultant_id`/`atribuido_em`/`next_follow_up_at`, status "novo", cancela tarefas pendentes, redistribui por menor fila excluindo consultoras presentes no histórico do lead; retorna reiniciados/atribuidos/esgotados.
- Ajustar a distribuição normal do CRM para também pular consultoras que já atenderam o lead.
- Função de prévia (contagem) e botão com confirmação em `DistribuicaoTab.tsx`.
