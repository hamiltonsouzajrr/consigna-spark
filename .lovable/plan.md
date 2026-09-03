# Revisão das funções de administrador

Auditoria do que existe hoje no painel admin (`/admin`, `/prospeccao/admin`, `/rh/acessos`, `/radar`, `/tomadores-al`), separando o que faz sentido, o que virou peso morto e o que melhorar.

## O que faz sentido e está em uso real

- **Acessos e segurança** (`/rh/acessos`): criação de contas, permissões por aba, bloqueio/desbloqueio, histórico e incidentes. Há dados reais (45 sessões, 9 incidentes, 6 registros de auditoria). Núcleo do painel.
- **Prospecção** (`/prospeccao/admin`): abas Visão, Importar, Distribuir, Lotes e Acessos. Base viva: 42.440 leads em prospecção, 8.376 tomadores, 4.500 lançamentos de pontos.
- **Radar Diário Oficial** (`/radar`): 1.240 registros extraídos e 9 jobs executados; distribuição automática para 56 consultoras cadastradas.
- **Tomadores com margem — AL** (`/tomadores-al`): pool por faixa com reposição automática.
- **Ações rápidas do `/admin`**: revogar acessos inativos e repor todas as carteiras — atalhos legítimos das rotinas mais usadas.

## O que hoje não faz sentido

1. **Módulo de RH quase todo vazio.** O `/admin` aponta para um "Painel de RH" com ~30 telas (vagas, candidatos, produção, clima, ocorrências, onboarding, férias, holerites, equipamentos, PDI, OKRs, organograma…) e as tabelas correspondentes estão com 0 registros; só existe 1 colaborador cadastrado. Isso infla o menu e distrai de Acessos, que é o que realmente se usa.
2. **Três rotas para a mesma tela de promovidos.** `/prospeccao/promovidos` e `/prospeccao/promovidos-recentemente` são apenas redirects para `/prospeccao/promovidos-recentes`, mas ainda aparecem espalhados em links e no menu.
3. **Resíduo do SafeConsig.** A tabela `safeconsig_leads` tem 386 registros de uma função já removida do sistema — dado órfão sem tela.
4. **`promovidos`, `lead_batches`, `leads_raw`, `legal_approvals` vazias.** Correspondem a fluxos antigos (importação PDF manual, lotes de leads, aprovação jurídica) que foram substituídos; os controles ainda existem na UI de importação.
5. **Comunicação/ferramentas com pouco lastro.** WhatsApp tem 1 conta configurada e as avaliações de pós-venda não têm uso; ocupam o mesmo peso visual de módulos críticos no hub admin.
6. **Só existe 1 usuário com papel de admin.** Nenhum administrador reserva — se essa conta for bloqueada ou perder a senha, ninguém administra o sistema.
7. **Verificação de admin repetida à mão em 21 rotas.** Cada tela reimplementa `isAdmin` + `Navigate`, com variações de comportamento e telas em branco durante o carregamento.

## Melhorias propostas

### Fase 1 — Limpeza (baixo risco)
- Reorganizar o hub `/admin` em três blocos por frequência de uso: **Operação diária** (Acessos, Prospecção, Radar, Tomadores), **Gestão** (Metas, Ranking, Competição) e **Arquivo/Opcional** (RH completo, WhatsApp, QR Codes, Avaliações) — este último recolhido por padrão.
- Ocultar do menu as telas de RH sem nenhum dado, mantendo as rotas acessíveis por link direto.
- Remover as duas rotas-atalho de promovidos e apontar todos os links diretamente para `/prospeccao/promovidos-recentes`.
- Remover da UI de importação os controles ligados a fluxos mortos (lotes/PDF), mantendo o importador de planilha atual.

### Fase 2 — Robustez de acesso
- Criar um gate único de admin (layout ou hook) usado por todas as rotas administrativas, com estado de carregamento e mensagem de "sem permissão" em vez de tela branca.
- Adicionar na aba de Acessos um controle explícito para conceder/revogar o papel de administrador, com registro na auditoria, e promover pelo menos um admin reserva.
- Exigir confirmação por texto nas ações destrutivas (revogar acessos inativos, redistribuições em massa, exclusão de conta).

### Fase 3 — Visibilidade operacional
- Painel de saúde no topo de `/admin`: última execução do Radar, leads sem consultora, carteiras incompletas, consultoras inativas há 7+ dias, incidentes de acesso simultâneo em aberto — cada item com link para a ação correspondente.
- Registrar na auditoria também as ações de distribuição/reposição (hoje só acessos são auditados), com quem executou e o resultado.
- Arquivar os dados órfãos do SafeConsig e das tabelas de fluxos descontinuados.

## Detalhes técnicos

- Gate de admin: rota pathless `_authenticated/_admin/` reaproveitando `useRhAccess`, eliminando as checagens duplicadas em 21 arquivos.
- Painel de saúde: uma única server function agregadora (contagens por RPC) em vez de várias consultas na tela, seguindo o padrão de `src/lib/radar/rpc.server.ts`.
- Auditoria de distribuição: reutilizar `public.rh_access_audit` com novos valores de `action`, sem nova tabela.
- Limpeza de dados órfãos por migração, com `DROP TABLE` apenas após confirmação sua — nada é apagado nesta fase sem seu aval.
