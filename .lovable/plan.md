# Prospecção unificada: Tomadores AL + CRM no mesmo histórico e na campanha da semana

Hoje as abordagens em **Tomadores AL** só mudam o status do lead: não entram no histórico de prospecção, não contam na meta de 250 do dia e não pontuam na competição da semana. Só o CRM registra eventos e pontos.

A ideia é ter **um único histórico** e **um único volume**: falar com um tomador vale exatamente o mesmo que falar com um lead do CRM.

## O que muda para a consultora

- Ligar ou chamar no WhatsApp em Tomadores AL passa a **gravar no histórico de prospecção**, junto com os contatos do CRM.
- O contador do topo (Ritmo / meta de 250 por dia) soma **CRM + Tomadores** num total só.
- Na **Competição da Semana**, contato em tomador vale os mesmos **10 pontos**, com as mesmas travas anti-burla: 1 ponto por pessoa por semana, intervalo mínimo de 90 segundos entre contatos contados e o mesmo teto diário compartilhado com o CRM.
- Marcar o tomador como **convertido** vale o bônus de venda (25 pontos), igual ao "ganho" do CRM.
- Na tela do CRM, a linha do tempo de atividade passa a mostrar as duas origens, com etiqueta indicando se veio do CRM ou de Tomadores AL.

## O que muda para o administrador

- Métricas de qualidade, dashboard por consultora e gráficos passam a considerar o volume unificado (sem contar duas vezes).
- Extrato de pontos da competição mostra a origem de cada ponto (lead do CRM ou tomador).

## Detalhes técnicos

**Banco (uma migração):**

- `lead_events`: tornar `lead_id` nulo permitido, adicionar `tomador_id uuid REFERENCES public.tomadores_al(id) ON DELETE CASCADE` e `origem text NOT NULL DEFAULT 'crm'` (`crm` | `tomadores_al`), com CHECK garantindo exatamente uma das duas referências preenchida.
- Índices: `(consultant_id, created_at)` e `(tomador_id, created_at)` para as contagens do dia.
- Políticas de `lead_events` revisadas para cobrir as linhas com `tomador_id` (leitura da própria consultora / admin; escrita continua só via servidor).
- Nenhuma alteração em `prospect_pontos`: o ledger já aceita `ref_tabela = 'tomadores_al'`, e o índice único `(user_id, week_start, categoria, ref_tabela, ref_id)` garante o "um ponto por pessoa por semana" também para tomadores.

**Server functions:**

- Nova `registrarContatoTomador` em `src/lib/prospeccao/tomadores-al.functions.ts` (ou arquivo próprio de eventos), que: valida que o tomador é da carteira da consultora, exige telefone conhecido, grava o evento em `lead_events` com `origem = 'tomadores_al'`, marca `contatado_em`/`status_abordagem = 'contatado'` e chama `creditar(userId, 'contato', 'tomadores_al', id)` reaproveitando `cooldownLiberado` e o teto diário de `competicao.server.ts`.
- `marcarAbordagemTomador`: ao marcar `convertido`, creditar `ganho` (`ref_tabela = 'tomadores_al'`); ao voltar para `novo` ou marcar `sem_interesse` logo após pontuar, chamar `estornar` — mesma reversão já usada no CRM.
- `getJornadaHoje` (`jornada.functions.ts`): a contagem do dia deixa de filtrar por lead do CRM e passa a contar todos os `lead_events` de `kind in ('ligacao','whatsapp')` da consultora, independente da origem.
- Funções de qualidade / dashboard por consultora / gráficos: passam a agregar por `origem` além do total.

**Frontend:**

- `/tomadores-al`: os botões **Ligar** e **WhatsApp** passam a chamar `registrarContatoTomador` antes de abrir o discador/WhatsApp, com feedback de pontos ganhos (mesmo padrão do CRM).
- Histórico/linha do tempo no CRM e no Meu Dia: exibir eventos das duas origens com etiqueta de origem.
- Card da competição: nenhuma mudança estrutural — o total já vem somado do ranking.

**Fora de escopo:** manter as duas telas separadas (não haverá fila única misturando CRM e tomadores).
