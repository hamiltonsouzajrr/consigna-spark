# Metas por consultora e progresso da semana (tela do gestor)

Uma tela só para administradores: define quanto cada consultora precisa fazer na semana e mostra, ao lado, o que ela já fez de verdade — para acompanhar a campanha em um lugar só.

## O que o gestor define

Três metas semanais:

- Contatos na semana (ligações/WhatsApp reais registrados)
- Vendas confirmadas na semana (as aprovadas pelo gestor)
- Tempo ativo na semana (em horas realmente ativas no sistema)

Funciona com meta padrão + ajuste individual: o gestor define um valor padrão que vale para todas, e pode sobrescrever a meta de quem quiser. A meta continua valendo nas semanas seguintes até ele mudar (não precisa redigitar toda semana).

## O que a tela mostra

1. **Resumo no topo**: total de consultoras acompanhadas, quantas estão dentro da meta, quantas estão atrasadas, e o realizado x meta somado da equipe (contatos, vendas, horas ativas).
2. **Tabela por consultora**, uma linha cada: nome, contatos feitos / meta, vendas confirmadas / meta, horas ativas / meta, e uma barra de progresso por coluna com o percentual. Cor calma quando está no ritmo esperado do dia da semana, cor de alerta quando está atrasada.
3. **Ritmo esperado**: como a semana vai de segunda a sexta 16h, o percentual esperado até hoje é calculado e usado para marcar "atrasada" — não basta comparar com 100%.
4. **Edição inline**: campo numérico em cada linha para ajustar a meta daquela consultora, e um bloco no topo para mudar o padrão da equipe. Salvar é imediato, com aviso de confirmação.
5. **Seletor de semana** (semana atual e anteriores) e link para "Minha semana" de cada consultora.
6. **Acesso**: rota `/prospeccao/admin/metas`, apenas administradores; card de atalho no painel administrativo e na aba da competição.

## Detalhes técnicos

- **Banco (nova migração)**:
  - `public.prospect_metas` — `user_id` (único), `meta_contatos int`, `meta_vendas int`, `meta_horas numeric`, timestamps + trigger de `updated_at`. Metas recorrentes (sem coluna de semana), sobrescrevendo o padrão.
  - `public.prospect_metas_padrao` — linha única (`id boolean primary key default true`) com os três valores padrão da equipe.
  - GRANT `SELECT` para `authenticated` (a consultora pode ver a própria meta), `ALL` para `service_role`; RLS ligada com política de leitura para autenticados e escrita apenas via `has_role(auth.uid(),'admin')`.
- **Server functions** em `src/lib/prospeccao/metas.functions.ts`, todas com `requireSupabaseAuth`:
  - `getMetasSemana({ weekStart? })` — `assertAdmin`, então monta por consultora: metas efetivas (individual ?? padrão), contatos da semana (`lead_events` com `kind in ('ligacao','whatsapp')` a partir de `weekStart`, agrupados por `consultant_id`), vendas confirmadas (`prospect_vendas` status confirmado na semana), segundos ativos (`app_uso_ativo` somando `ref_date` da semana), nomes de `profiles`. Retorna também `padrao`, `weekStart`, `pctEsperado`.
  - `salvarMetaConsultora({ userId, meta_contatos, meta_vendas, meta_horas })` e `salvarMetaPadrao({...})` — `assertAdmin` + upsert.
  - Leituras com `supabaseAdmin` carregado dentro do handler, depois da checagem de admin; sem `count: "exact"` (evita os timeouts já corrigidos).
  - Semana e fuso reutilizam `weekStart()` de `competicao.server.ts` e a virada 03:00 UTC (Maceió) já usada nas outras telas.
- **UI**: nova rota `src/routes/_authenticated/prospeccao.admin.metas.tsx` com `head()` próprio e `noindex`, envolvida pelo `AdminGate`, usando `useServerFn` + `useQuery` (refetch a cada 60s) e mutations para salvar. Componentes em `src/components/prospeccao/admin/MetasTable.tsx` e `MetasResumo.tsx`, reaproveitando cartões/tabelas e tokens de cor já existentes.
- Nada muda nas regras de pontuação da competição, nos dados importados nem nas telas das consultoras.
