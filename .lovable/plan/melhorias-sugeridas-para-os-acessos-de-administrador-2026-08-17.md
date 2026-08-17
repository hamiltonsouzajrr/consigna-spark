# Melhorias sugeridas para os acessos de administrador

O painel `/rh/acessos` já cobre criação/edição/exclusão de usuários, abas por usuário, bloqueio, link de senha, ações em massa, perfis prontos, auditoria e sincronização de consultoras. As lacunas restantes são de **segurança do próprio papel de admin** e de **granularidade de permissão**.

## 1. Proteções no papel de admin (prioridade alta)

Hoje qualquer admin pode rebaixar ou excluir outro admin, e pode remover o próprio papel de admin (a exclusão do próprio usuário é bloqueada, mas a remoção do papel não). Isso permite ficar sem nenhum administrador no sistema.

- Bloquear a remoção do próprio papel de admin ("você não pode remover seu próprio acesso de administrador").
- Bloquear remoção/rebaixamento/bloqueio quando resultaria em **zero admins ativos**.
- Confirmação com digitação do e-mail para promover alguém a admin e para excluir usuário.
- Registrar na auditoria promoções/rebaixamentos com destaque (já são logados, mas sem rótulo próprio: criar ações `promoveu_admin` / `rebaixou_admin`).

## 2. Admin com escopo limitado (permissões finas)

Hoje existe só um papel: admin = tudo. Sugestão de dois níveis extras, mantendo `user_roles`:

- `gestor_acessos`: pode conceder/remover abas e vincular colaboradores, mas **não** cria/exclui usuários nem promove admins.
- `admin`: total.

Isso permite delegar a rotina de liberação de abas sem entregar as chaves do sistema.

## 3. Visibilidade do que o admin enxerga

- Mostrar no detalhe do usuário quais abas ele veria **de fato** (incluindo as sempre liberadas: Dashboard) para evitar dúvida de "concedi e não aparece".
- Aviso visual quando o usuário é admin: "admin vê todas as abas; as marcações abaixo são ignoradas".
- Contador de admins no painel de resumo do topo.

## 4. Rastreio e reversão

- Botão "reverter" em entradas de auditoria de acesso (restaura o conjunto de abas anterior) — exige gravar o estado anterior no `detail` do log.
- Filtro de auditoria por ator, por usuário-alvo e por tipo de ação, com intervalo de datas.
- Retenção/limpeza da auditoria (ex.: manter 12 meses).

## 5. Sessões e segurança operacional

- Botão "encerrar sessões" (revoga refresh tokens) junto ao bloqueio — hoje bloquear não desconecta quem já está logado.
- Exigir troca de senha no primeiro acesso para usuários criados pelo admin.
- Alerta no resumo para usuários admin sem acesso há mais de 60 dias.

## Detalhes técnicos

- Backend: `src/lib/rh/access.functions.ts` — adicionar guardas em `updateRhUser` (auto-rebaixamento, último admin), `deleteRhUser` e `setRhUserBlocked`; nova função `revokeRhUserSessions` usando `supabaseAdmin.auth.admin.signOut`; contagem de admins via `user_roles`.
- Papéis: migração adicionando valor `gestor_acessos` ao enum `app_role` e um helper `assertAccessManager` que aceita `admin` ou `gestor_acessos`, mantendo `assertAdmin` nas operações destrutivas.
- Auditoria: gravar `detail.before`/`detail.after` das abas em `setRhUserAccess`/`bulkSetRhAccess` para viabilizar reversão; novos rótulos em `src/lib/rh/access-presets.ts`.
- UI: `src/routes/_authenticated/rh.acessos.tsx` — confirmação por digitação, aviso de admin, contador de admins, filtros de auditoria, botão de encerrar sessões.

## Sugestão de execução

Começar pelo bloco 1 (guardas de admin + confirmações) e pelo botão de encerrar sessões do bloco 5 — são rápidos e fecham os riscos reais. Blocos 2 e 4 depois, por serem mudanças de modelo de dados.
