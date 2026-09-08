# Revisão geral do sistema: falhas encontradas e correções propostas

Verifiquei o banco (verificador de segurança, consultas mais lentas, índices, tabelas) e passei o código inteiro em revisão. O que está bem: os endereços automáticos (cron e WhatsApp) todos exigem segredo/assinatura, o verificador de segurança do banco não achou nada em aberto, e as telas de Tomadores AL já receberam índices e estão rápidas agora.

Encontrei os pontos abaixo, do mais grave ao menor.

## 1. Falha de acesso na importação de planilhas (grave)

Quatro funções da área de importação de leads (criar lote, enviar linhas, listar lotes, ver leads do lote) só checam se a pessoa está logada — não checam se é administradora. Como a tela é de admin, a proteção ficou só na tela: uma consultora comum conseguiria, por fora da tela, listar lotes e ler os dados brutos importados (nome, CPF, telefone) de qualquer lote, além de criar lotes e inserir linhas.

Correção: exigir administradora nas quatro funções, igual já é feito na função que atribui o lote a uma consultora.

## 2. A nova busca de cliente pode travar quando a base crescer

A busca por nome varre as tabelas de leads e de promovidos sem índice de texto (Tomadores AL já tem). Também não há índice no CPF dos leads. Com 42 mil leads ainda responde, mas é o mesmo tipo de consulta que causou as telas travadas de Tomadores AL.

Correção: criar índices de texto para nome (leads e promovidos) e índice de CPF nos leads.

## 3. Contagens totais caras em telas que abrem toda hora

A tela de promovidos conta a tabela inteira a cada carregamento, além de trazer a página. O mesmo padrão aparece em rotinas de reciclagem de Tomadores AL. É exatamente o padrão que gerava "consulta cancelada por tempo limite".

Correção: trocar a contagem exata por contagem só quando muda o filtro (e não a cada página) nas telas de promovidos, e remover a contagem exata das rotinas internas de reciclagem.

## 4. Tela antiga duplicada: "Recentes Prospectados"

Existem duas telas com o mesmo assunto de promovidos/recentes. Duas rotas antigas já foram transformadas em atalho para a tela oficial, mas "Recentes Prospectados" ficou como tela própria, com busca de dados por caminho diferente — ou seja, pode mostrar números diferentes da tela oficial.

Correção: escolher uma. Proposta: manter a oficial ("Promovidos Recentemente") e transformar "Recentes Prospectados" em atalho para ela, removendo o item duplicado do menu. Se o conteúdo dela for realmente diferente, faço o contrário: mantenho as duas e passo as duas a usar a mesma fonte de dados.

## 5. Ajustes menores

- A tela de importação de leads não tem título/descrição de página (todas as outras têm).
- Alguns pontos engolem erros silenciosamente (na tela do lead e na vinculação de promovidos), o que dificulta descobrir problema depois. Passam a registrar o erro.
- A consulta que descobre "qual consultora é este e-mail" é feita 32 mil vezes; passa a ser guardada em memória por alguns minutos por requisição, reduzindo idas ao banco.

## O que não vou mexer

Regras da competição, pontuação, importação de dados já corrigida e Radar/Diário Oficial continuam como estão. Nenhuma alteração visual.

## Detalhes técnicos

- `src/lib/prospeccao/leads-admin.functions.ts`: adicionar `await assertAdmin(supabase, userId)` (padrão de `assignBatchToConsultant`) em `createLeadBatch`, `processLeadChunk`, `getLeadBatches`, `getLeadsByBatch`; incluir `requireSupabaseAuth` context (`supabase`, `userId`) nas handlers que hoje só recebem `data`.
- Migração de índices: `CREATE INDEX ... USING gin (nome gin_trgm_ops)` em `prospect_leads`; `gin (nome_servidor gin_trgm_ops)` e `gin (nome_completo gin_trgm_ops)` em `do_registros`; `CREATE INDEX ON prospect_leads (cpf)`. `pg_trgm` já instalado.
- `src/lib/radar/promovidos-recentes.functions.ts:121,156`: contagem exata apenas quando `page === 0` (ou head-count separado por filtro), reaproveitando total no cliente; `src/lib/prospeccao/tomadores-al.functions.ts:189,436`: substituir `count: "exact"` por leitura limitada/`head` sem contagem total nas rotinas internas.
- `src/routes/_authenticated/prospeccao.recentes.tsx`: converter em `beforeLoad` + `redirect` para `/prospeccao/promovidos-recentes` e remover a entrada em `src/components/AppShell.tsx:47`.
- `src/routes/_authenticated/prospeccao.admin.leads.tsx`: adicionar `head()` com título/descrição próprios.
- `catch {}` em `prospeccao.$leadId.tsx:296` e `promovidos-recentes.functions.ts:84`: registrar via `console.error` com contexto.
- `minhaConsultoraNome`/lookup de `radar_consultoras` por e-mail: memoizar por `userId` dentro da requisição (cache em `Map` de curta duração) em `src/lib/prospeccao/prospeccao.server.ts`.
