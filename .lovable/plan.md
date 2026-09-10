# Minhas conversões (vendas fechadas pela consultora) + correção renda x margem

## Parte 1 — Nova aba "Minhas conversões"

Uma aba própria na prospecção onde a consultora registra o cliente que conseguiu converter.

### Formulário de registro

- Cliente: escolhe um lead da própria carteira (busca por nome/CPF) ou digita o nome à mão, quando o cliente não veio da base.
- Data da operação.
- Valor liberado (retirado).
- Prazo (parcelas).
- Valor da parcela.
- Situação da margem: **"Ainda restou margem"** ou **"Usou toda a margem"**; quando restou, um campo opcional para o valor que sobrou.
- Observação livre (opcional).
- **Lembrar de contatar novamente em:** 2 semanas · 3 semanas · 1 mês · 2 meses · 3 meses · não lembrar.

### Lista de conversões

Cartões/linhas com cliente, data, valor liberado, prazo x parcela, situação da margem, próximo lembrete e o status da venda (aguardando confirmação do gerente / confirmada / recusada). Totais do mês: quantidade e valor liberado.

### Lembretes

A data escolhida gera um follow-up na agenda da consultora (mesma lista de follow-ups que ela já usa), com o título "Retornar ao cliente — pode ter margem nova". Aparece em "Meu dia"/follow-ups e pode ser remarcado ou concluído normalmente.

### Pontuação

Registrar a conversão aqui **cria a venda como pendente**, exatamente como hoje: os pontos só entram quando o gerente confirma na tela de vendas do admin. Nada muda nas regras da campanha.

### Quem vê o quê

- Consultora vê e edita apenas as próprias conversões.
- Administrador/gestor vê todas, com filtro por consultora e período.

## Parte 2 — Renda deixa de ser tratada como margem

Confirmei que a importação aceitava colunas de **renda** e **salário** como se fossem margem, e esse valor era exibido como "margem" e usado na nota do lead. Dos 36.604 leads, 10.664 têm esse valor (média R$ 1.618, máximo R$ 29.824) e nenhum guardou a linha original, então não é possível saber lead por lead o que era.

- Só colunas de margem valem como margem; renda/salário passam a campo próprio.
- Cada valor passa a ser exibido com **o nome da coluna da planilha**, conforme você pediu; nada de estimar margem a partir da renda.
- Crédito liberado aproximado só sobre margem.
- Nos leads antigos o valor ambíguo aparece como "Valor importado da planilha" (com o lote de origem) e deixa de dar pontos na nota. A nomenclatura real volta com a reimportação usando "Atualizar leads existentes".

## Não entra neste trabalho

- Regras da competição, pontos e metas.
- Telas de Tomadores AL e Radar.
- Estimar margem a partir da renda.

## Detalhes técnicos

**Parte 1**
- Migração: tabela `prospect_conversoes` (`user_id`, `lead_id` nullable, `cliente_nome`, `cpf`, `data_operacao`, `valor_liberado`, `prazo`, `valor_parcela`, `margem_restante` bool + `margem_restante_valor`, `observacao`, `lembrete_em`, `venda_id`), GRANT para `authenticated`/`service_role`, RLS: dono lê/escreve o próprio; `has_role(auth.uid(),'admin')` e gestor leem tudo; trigger `set_updated_at`.
- `src/lib/prospeccao/conversoes.functions.ts`: `listarConversoes`, `criarConversao`, `atualizarConversao`, `removerConversao` com `requireSupabaseAuth` + Zod; `criarConversao` chama `registrarVendaPendente` (`origem: 'conversao'`, `ref_tabela: 'prospect_conversoes'`) e insere `lead_tasks` com `due_at` calculado a partir da opção de lembrete.
- Rota `src/routes/_authenticated/prospeccao.conversoes.tsx` + botão na prospecção; formulário em `src/components/prospeccao/ConversaoDialog.tsx`, lista em `ConversoesList.tsx`; leitura via `useSuspenseQuery`/`queryOptions`.
- Quando `lead_id` existir, marcar o lead como `ganho` reutilizando o fluxo atual (sem duplicar pontos).

**Parte 2**
- `src/lib/prospeccao/admin-import.ts`: retirar `renda`/`salario`/`salário` de `MARGIN_ALIASES`, criar `INCOME_ALIASES`, gravar em `raw_data` as chaves `_col_margem`/`_col_renda` com o nome original da coluna.
- Migração: `prospect_leads.renda numeric`; ajustar `compute_prospect_lead` para não pontuar `orcamento` ambíguo (resto do score/SLA intacto) e `update` neutro para recalcular.
- `prospeccao.utils.ts` / `prospeccao.functions.ts`: aceitar e gravar `renda`.
- `src/routes/_authenticated/prospeccao.$leadId.tsx` e a fila (`CrmCockpit.tsx`): rótulo vindo de `_col_margem`/`_col_renda`, fallback "Valor importado da planilha", `valorLiberado` só para margens.
