# Diagnóstico Técnico — Plataforma Grupo Positive

## 1) Arquitetura

**Tecnologias:** TanStack Start v1 (React 19, SSR), TanStack Router + Query, Vite 7, Tailwind v4, Radix/shadcn, Supabase (Lovable Cloud, RLS), Vercel AI SDK, pdfjs/mammoth, jsPDF, recharts, sonner. Deploy em Cloudflare Workers.

**Organização de pastas:**
```text
src/
  routes/        68 rotas (page + api/public/*)
  lib/           server functions (*.functions.ts) por domínio
    radar/ prospeccao/ rh/ positiva/ legal/ wa/ al/ ai/ server/
  components/     ui (shadcn), rh, prospeccao, legal, ai-elements
  hooks/          use-rh-access, use-rh-notifications, use-mobile
  integrations/   supabase/ (client, client.server, auth-*, types)
supabase/         12 edge functions, 61 migrations
```

**Rotas principais:** `/` `/login` `/dashboard`, `radar.*`, `prospeccao.*`, `rh.*` (layout + ~30 subrotas), `positiva-ia.*`, `aprovacao.$token`, `api/public/*` (webhooks WhatsApp, radar-diário).

**Componentes:** `AppShell`, `RhLayout`, `NotificationBell`, `PromovidosPdfImport`, `CentralAprovacao`, `PositivaCoachWidget`, ai-elements.

**Hooks/contexts:** `AuthProvider`/`useAuth` (`src/lib/auth.tsx`), `useRhAccess`, `useRhNotifications`.

**Serviços/APIs:** server functions com `requireSupabaseAuth`; crawlers em `*.server.ts`; AI Gateway (`ai-gateway.server.ts`); integrações Nova Vida, ConsigUp, WhatsApp.

**Banco:** ~45 tabelas com RLS. Funções `has_role`, `atribuir_consultora_automatico`, `compute_prospect_lead`, etc.

## 2) Análise por módulo (resumo)

- **`auth.tsx` (AuthProvider/useAuth):** gerencia sessão. Risco: não invalida router/Query em login/logout → dados stale; só repassa `error.message`.
- **`use-rh-access.ts`:** bem implementado, cache 60s, baixo risco.
- **`radar.functions.ts` (22 fns):** todas com `requireSupabaseAuth`. `getLeadsPromovidos` falha silenciosa (lista vazia) se e-mail não está em `radar_consultoras`. `distribuirLeadsAutomatico` com risco de race condition.
- **`prospeccao.functions.ts`:** funções `admin*` precisam de checagem estrita de role.
- **`legal.functions.ts` `getApprovalByToken`:** público intencional (acesso por token).
- **`diario.*.server.ts`:** operações longas no Worker, sem OCR para PDFs escaneados.
- **`radar.busca-diaria.tsx`:** múltiplos `useServerFn` em `useEffect` → causa erro de Suspense no SSR.
- **`RhLayout`:** proteção de abas client-side via `useRhAccess`.

## 3) Notas (0–100)

| Critério | Nota |
|---|---|
| Funcionalidade | 82 |
| Estabilidade | 62 |
| Organização | 80 |
| Segurança | 45 |
| Performance | 60 |
| UX/UI | 75 |
| Manutenibilidade | 74 |
| Tratamento de erros | 55 |
| Integração backend | 80 |

## 4) Problemas por prioridade

**CRÍTICO**
- `do_registros` (PII: nome, CPF parcial) — RLS de escrita permissiva (`USING true`). Impacto: qualquer usuário autenticado adultera/insere. Correção: restringir INSERT/UPDATE a admin.
- `radar_consultoras` — INSERT/UPDATE/DELETE com `true`. Impacto: corrupção da distribuição de leads. Correção: política admin.

**ALTO**
- Sem layout `_authenticated/` — proteção só client-side (`useAuth`+`<Navigate>`). Impacto: flash de conteúdo no SSR, padrão não recomendado. Correção: criar `src/routes/_authenticated/route.tsx` e migrar rotas logadas.
- Erro de Suspense em `/radar/busca-diaria`. Impacto: fallback para client render, flicker. Correção: migrar fetches para `loader`+`useSuspenseQuery`.
- `do_arquivos`/`fontes_diario_oficial` — RLS de escrita permissiva. Correção: escrita só admin.

**MÉDIO**
- Padrão `useEffect`+`useState`+`useServerFn` em vez de `loader`+TanStack Query (sem cache/SSR). 
- `AuthProvider` não invalida router/Query em troca de sessão.
- Round-robin de distribuição não atômico (race). Correção: `UPDATE … RETURNING`.
- `catch` silenciosos sem feedback ao usuário.

**BAIXO**
- Rotas dinâmicas sem `errorComponent`/`notFoundComponent`.
- ARIA ausente em tabs/nav customizados; tabelas densas sem scroll no mobile.
- Dados mock no RH; TODOs pendentes.

## 5) Plano de ação em 4 fases

**Fase 1 — Correções seguras**
- Endurecer RLS de escrita: `do_registros`, `radar_consultoras`, `do_arquivos`, `fontes_diario_oficial` (escrita só admin via `has_role`).
- Adicionar `errorComponent`/`notFoundComponent` nas rotas com loader/params.
- Substituir `catch` silenciosos por toasts/log.

**Fase 2 — Melhorias importantes**
- Criar `_authenticated/route.tsx` e migrar rotas logadas.
- Corrigir erro de Suspense em `/radar/busca-diaria`.
- Invalidar router/Query em `onAuthStateChange` no `__root.tsx`.

**Fase 3 — Refatorações**
- Migrar telas críticas para `loader`+`useSuspenseQuery`.
- Tornar round-robin atômico.
- Hook reutilizável de carregamento de dados.

**Fase 4 — Melhorias avançadas**
- Acessibilidade/ARIA, responsividade de tabelas.
- Code-splitting, padronização de formulários.
- Substituir mocks do RH por dados reais; limpar TODOs.

Diagnóstico concluído. Aguardando aprovação.