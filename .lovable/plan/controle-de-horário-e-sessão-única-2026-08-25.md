# Controle de horário e sessão única

Duas travas novas no sistema, ambas com administradores 100% isentos.

## 1. Janela de funcionamento (fuso de Maceió, UTC-3)

- Segunda a quinta: 08:00 às 18:00
- Sexta: 08:00 às 17:00
- Sábado e domingo: acesso bloqueado
- Fora da janela, o usuário vê uma tela "Sistema fora do horário de funcionamento" com o próximo horário de liberação e botão de sair. Nenhuma tela interna carrega.
- Se o horário virar com a pessoa logada, um aviso aparece 10 minutos antes do corte e, na hora exata, a sessão é encerrada automaticamente.
- A verificação é feita no servidor (não dá para burlar mudando o relógio do computador).
- Administradores entram a qualquer hora, incluindo fim de semana.

## 2. Bloqueio de acesso simultâneo

- Cada conta passa a registrar a sessão ativa (dispositivo/navegador) com um "sinal de vida" a cada 30 segundos.
- Quando a mesma conta aparece em dois dispositivos ao mesmo tempo, **as duas sessões são travadas** imediatamente: as duas telas exibem um bloqueio em tela cheia informando que a conta está suspensa por uso simultâneo e que um administrador precisa liberar.
- O incidente é gravado com data/hora, usuário, IPs e navegadores das duas sessões.
- Administradores podem usar vários dispositivos sem restrição.

### Sua notificação

- **Pop-up urgente**: todo admin logado recebe na hora um alerta vermelho em tela ("Acesso simultâneo detectado — conta X"), com botões "Liberar conta" e "Manter bloqueada".
- **Histórico**: nova aba de incidentes no painel administrativo (dentro de Acessos), com lista, filtro por usuário/data e botão de liberar.
- **E-mail**: para enviar e-mail é preciso primeiro cadastrar um domínio de envio próprio no projeto (ex.: `positive.com.br`). Vou implementar o disparo de e-mail já preparado; ele começa a funcionar assim que o domínio for configurado. Se você preferir, configuramos o domínio antes de eu ligar essa parte.

## Detalhes técnicos

- Nova tabela `public.app_sessions` (user_id, session_id, ip, user_agent, last_seen_at, blocked_at) e `public.security_incidents` (tipo, user_id, detalhes, resolvido_por, resolvido_em), com RLS: o usuário lê só as próprias linhas, admin lê tudo, escrita via server functions.
- Server functions em `src/lib/security/session.functions.ts`:
  - `heartbeatSession` — registra/atualiza a sessão, detecta duplicidade (outra sessão com `last_seen_at` nos últimos 90s), marca as duas como `blocked_at`, cria o incidente e dispara o e-mail.
  - `getAccessState` — retorna `{ withinHours, nextOpen, closesAt, sessionBlocked, isAdmin }` usando a hora do servidor convertida para `America/Maceio`.
  - `releaseAccount` / `listIncidents` — admin apenas, com `has_role(auth.uid(),'admin')`.
- Novo `AccessGuard` montado dentro do `AppShell` (que já envolve todas as rotas `_authenticated`): consulta `getAccessState` no mount e a cada 30s via TanStack Query, renderiza a tela de bloqueio de horário ou o overlay de sessão simultânea, e chama `signOut` no corte de horário.
- `SimultaneousAccessAlert` para admins: Realtime na tabela de incidentes + `sonner`/dialog urgente.
- Aba "Incidentes" adicionada em `src/routes/_authenticated/rh.acessos.tsx` reutilizando os componentes de tabela já existentes.
- Sem alteração nas regras de negócio de CRM/prospecção.
