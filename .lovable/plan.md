# Pesquisar cliente

Nova aba "Pesquisar cliente", disponível para consultoras e administradores, que procura uma pessoa em todas as bases do sistema a partir do CPF ou do nome.

## Como vai funcionar

- Um campo único de busca. O sistema entende sozinho se você digitou CPF (só números/pontuação) ou nome.
- **CPF:** aceita com ou sem os zeros da frente, com ou sem ponto e traço. O sistema completa até 11 dígitos e procura nas duas formas de gravação (com e sem pontuação).
- **Nome:** funciona com o nome completo ou só o primeiro nome; a busca é sem diferenciar acento/maiúsculas e traz todos os parecidos, ordenados pelos mais próximos primeiro.
- Resultados agrupados por base, com contagem em cada grupo:
  - **Leads da prospecção** — nome, CPF, telefone, cidade, situação, status, margem informada e quem é a consultora responsável.
  - **Tomadores AL** — nome, CPF, órgão, cargo, margens disponíveis e responsável.
  - **Recém promovidos (Diário Oficial)** — nome, cargo/promoção, órgão, data e responsável.
- Cada resultado tem um botão para abrir o registro na tela correspondente (lead, Tomadores AL ou recém promovidos).
- Toda consultora vê qualquer pessoa da base, mesmo que esteja com outra consultora — o nome da responsável aparece sempre, para evitar abordagem duplicada.
- Se nada for encontrado, aparece uma mensagem clara dizendo em quais bases foi procurado.
- Limite de 50 resultados por base, com aviso quando houver mais, para a tela não travar.

## Onde fica

Botão "Pesquisar cliente" na tela de Prospecção, ao lado de "Minha semana", e página própria em `/prospeccao/pesquisar-cliente`.

## Detalhes técnicos

- Nova rota `src/routes/_authenticated/prospeccao.pesquisar-cliente.tsx` (`createFileRoute("/_authenticated/prospeccao/pesquisar-cliente")`), com `head()` próprio, campo de busca via search param (`q`) usando `zodValidator` + `fallback`, e `useQuery` disparado por `useServerFn`.
- Nova função `src/lib/prospeccao/busca-cliente.functions.ts`: `buscarCliente` com `createServerFn({ method: "GET" })` + `.middleware([requireSupabaseAuth])`, `inputValidator` Zod (`termo` 3–120 chars).
  - Detecta CPF: `normalizeCpf(termo)`; se 8–11 dígitos, aplica `padStart(11, "0")` e monta as variantes (dígitos e `000.000.000-00`) usando `formatCpf` de `src/lib/cpf.ts`.
  - Consulta em paralelo (`Promise.all`), com `context.supabase` (RLS do usuário) quando as políticas permitem leitura ampla; caso as políticas de `prospect_leads`/`tomadores_al`/`do_registros` restrinjam por consultora, usa `supabaseAdmin` (importado dentro do handler) apenas para leitura, já que a decisão de produto é "todas veem tudo". Confirmar as políticas atuais antes de escolher o client em cada tabela.
  - CPF: `.in("cpf", variantes)` em `prospect_leads`, `.in("documento", variantes)` em `tomadores_al`, `.in("cpf_confirmado", variantes)` + `cpf_parcial` (últimos dígitos) em `do_registros`.
  - Nome: `.ilike("nome", "%termo%")` em `prospect_leads`/`tomadores_al` e `ilike` em `nome_servidor`/`nome_completo` em `do_registros`, com `.limit(50)` e sem `count: "exact"` (evita os timeouts já corrigidos). Aproveita os índices trigram existentes; se faltar índice trigram para `tomadores_al.nome`/`do_registros.nome_servidor`, incluir migração só com `CREATE INDEX ... USING gin (... gin_trgm_ops)`.
  - Resposta normalizada: `{ leads: [...], tomadores: [...], promovidos: [...], truncado: {...} }`, sem devolver dados sensíveis além dos campos listados.
- Componente de resultados em `src/components/prospeccao/BuscaClienteResultados.tsx`, usando Card/Badge/Table existentes e os tokens do tema; links via `<Link to="/prospeccao/$leadId" params={...}>`, `/tomadores-al` e `/prospeccao/promovidos-recentes` (com o termo pré-preenchido quando a tela de destino não tiver rota por id).
- Botão adicionado em `src/routes/_authenticated/prospeccao.index.tsx` perto de "Minha semana".

**Fora de escopo:** editar registros pela tela de busca, exportação e mudanças nas regras de distribuição/pontuação.
