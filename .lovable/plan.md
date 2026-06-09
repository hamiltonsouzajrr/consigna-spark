
# Área de Prospecção (CRM inteligente)

Admin sobe planilha de leads; consultoras trabalham a carteira com fila priorizada, follow-ups, timeline e scripts. Entrego primeiro os **4 pilares** (timeline, follow-up, score, dashboard) e depois os complementos.

## Modelo de dados

No app, "consultora" = usuário autenticado. Roles já existem (`admin`/`user`); admin sobe e distribui, `user` (consultora) trabalha sua carteira.

```text
prospect_leads
  id, nome, telefone, cpf, cidade, origem, orcamento,
  status (novo|qualificado|proposta|ganho|perdido)
  consultant_id (auth.users)      -- responsável
  score int, quality_score int
  loss_reason text
  first_response_at, sla_status (ok|atencao|atrasado)
  next_follow_up_at, last_contact_at
  notes, created_by (admin), created_at, updated_at

lead_events            -- TIMELINE (append-only)
  id, lead_id, consultant_id, kind (ligacao|whatsapp|nota|status|followup|sistema)
  body, meta jsonb, created_at

lead_tasks             -- FOLLOW-UP
  id, lead_id, consultant_id, title, due_at,
  status (pending|done|canceled), created_at
```

RLS: admin gerencia tudo; consultora vê/edita apenas leads onde `consultant_id = auth.uid()` (e seus events/tasks). GRANTs para `authenticated` e `service_role`. Trigger de `updated_at`. Função `has_role` já existe.

## Score automático (regras)

Calculado em trigger no banco a cada insert/update de campos relevantes:
- Origem (indicação > WhatsApp > planilha fria)
- Orçamento / margem disponível
- Cidade (lista prioritária configurável — começo com peso neutro)
- Urgência declarada
- Engajamento: respondeu WhatsApp, nº de eventos recentes
- Recência do último contato
Score 0–100 → ordena a fila (quente no topo).

## SLA por etapa (trigger + cálculo)

- Lead `novo` sem `first_response_at` há >5 min → `atencao`; agrava para `atrasado`.
- Follow-up quente vencido no dia → `atrasado`.
- Sem contato há 3 dias → `atrasado` (alerta vermelho).
`sla_status` recalculado por trigger e na leitura (campo derivado por tempo).

## Telas

```text
/prospeccao            -> Fila da consultora (cards priorizados por score + SLA)
/prospeccao/$leadId    -> Detalhe: timeline, ações, follow-up, playbook do status
/prospeccao/admin      -> Painel admin: ranking, gargalos, upload de planilha
```

### Fila da consultora (`/prospeccao`)
KPIs no topo: Leads de hoje · Follow-ups atrasados · Leads quentes · Taxa de conversão · Tempo médio 1ª resposta. Lista ordenada por score, com badge de SLA (verde/amarelo/vermelho) e botão de follow-up.

### Detalhe do lead (`/prospeccao/$leadId`)
- **Timeline** cronológica (ligação, WhatsApp, nota, status, follow-up).
- Ações rápidas: registrar contato, nota, agendar follow-up, mudar status.
- Ao mudar para `perdido` → **motivo obrigatório** (Preço, Sem resposta, Fora do perfil, Comprou concorrente, Sem urgência).
- **Playbook por status**: Novo=script de abordagem; Qualificado=checklist de necessidade; Proposta=objeções comuns; Perdido=motivo.
- **IA assistente** (Lovable AI): resume histórico, sugere próxima mensagem, identifica objeção, sugere próxima ação.

### Painel admin (`/prospeccao/admin`)
Upload CSV/XLSX (reusa parser do `/upload`), atribuição a consultoras, ranking por consultora, leads sem tratativa, origem com melhor conversão, gargalo por etapa, leads esquecidos.

## IA assistente

Server function (`createServerFn`) → Lovable AI Gateway (`google/gemini-3-flash-preview`), recebe timeline + dados do lead, retorna resumo/sugestões. Sem chave do usuário.

## Ordem de entrega

1. **Fase 1 (pilares):** schema + RLS + score/SLA triggers; fila da consultora; detalhe com timeline + follow-up + status/motivo; dashboard da consultora. Item de menu em "Prospecção".
2. **Fase 2:** painel admin completo (upload, atribuição, ranking, gargalos).
3. **Fase 3:** playbooks ricos + IA assistente.

## Teste (cenário do pedido)
Criar lead quente, atribuir a uma consultora, gerar follow-up e validar que aparece no topo da fila com alerta de prazo.

## Detalhes técnicos
- TanStack Start: leituras via `createServerFn`/queries client com RLS; mutações por componente. Rotas em `src/routes/prospeccao*.tsx`.
- Migrations via ferramenta de migração (com GRANTs). Updates de dados via insert tool.
- Realtime opcional na fila (como já feito em `safeconsig_leads`).
