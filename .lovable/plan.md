# 1) Diagnóstico: promovidos recentes chegam às consultoras?

Verificado no banco agora (somente leitura):

- 1.240 registros do Radar, **todos liberados** e **todos com consultora responsável** (52 nomes).
- Permissão de leitura das consultoras está correta (lead liberado + nome igual ao da conta); nenhum responsável fora do cadastro.
- A aba mostra apenas publicações dos **últimos 15 dias**, e nessa janela existem só **24 registros**:
  - Willyanealves 19; Emellyelisa, Fernanda, Hemelynathalia, Itamara 1 cada
  - `rnannoella3012` 1 — **sem conta no sistema**, esse lead está invisível
- Última publicação capturada: **01/09/2026**. 56 consultoras cadastradas, **34 com conta**.

Conclusão: não é bug de permissão nem de distribuição — falta volume novo na janela e o pouco que entrou ficou concentrado em uma consultora. Por isso a maioria abre a aba e vê vazio.

Correções previstas:
1. Rebalancear igualmente os registros dos últimos 15 dias entre consultoras com conta ativa, e reatribuir o lead órfão.
2. Fallback: se a consultora não tem nada na janela, mostrar os promovidos mais recentes dela com selo de idade, em vez de tela vazia.
3. Mostrar na aba a data da última publicação e da última entrega.
4. Rodar repescagem/varredura de lacunas de 02–03/09 e conferir o cartão de saúde do Radar; destravar fila se houver pendências.
5. Listar no admin as consultoras cadastradas sem conta (22 hoje).

# 2) Tomadores: reiniciar e redistribuir leads já trabalhados

Novo botão no painel admin de Tomadores AL: **"Reiniciar trabalhados e redistribuir"**, que devolve ao estoque leads já finalizados (convertidos/sem interesse, e opcionalmente contatados sem retorno) e os entrega novamente — **nunca para quem já atendeu aquele lead**.

Como garantir isso: hoje `tomadores_al` guarda só o responsável atual, então o histórico se perde ao reatribuir. Será criada uma tabela de histórico de atendimento por lead; a distribuição passa a excluir qualquer consultora que já apareça no histórico daquele lead.

Fluxo do botão:
- Admin escolhe o que reiniciar (finalizados, sem interesse antigos, contatados sem evolução) e a idade mínima em dias.
- Prévia mostra quantos leads serão reiniciados antes de confirmar (confirmação por texto).
- Ao confirmar: registra o atendimento atual no histórico, zera status/datas e libera o lead; a próxima entrega por faixa de margem já respeita o bloqueio de repetição.
- Se um lead só tiver histórico com todas as consultoras, ele fica no estoque sem dono em vez de repetir.

## Detalhes técnicos

- Migração: tabela `public.tomadores_al_atendimentos` (`tomador_id`, `consultora_nome`, `status_final`, `finalizado_em`), com GRANTs e RLS (admin total; consultora lê o próprio histórico); backfill dos responsáveis atuais já finalizados.
- Nova RPC `reiniciar_tomadores_trabalhados(_status text[], _dias_min int, _limite int)`: grava histórico, limpa `consultora_responsavel`, `atribuido_em`, `contatado_em`, `finalizado_em`, `motivo_sem_interesse` e volta `status_abordagem = 'novo'`; retorna total reiniciado.
- `garantir_pool_tomadores_faixa` passa a excluir candidatos com histórico da consultora solicitante (`NOT EXISTS` no histórico), inclusive nos ramos de reciclagem.
- Server fns em `src/lib/prospeccao/tomadores-al.functions.ts`: `previewReiniciarTrabalhados` e `reiniciarTrabalhadosTomadoresAl`, ambas com checagem de admin e auditoria.
- UI: card de gestão na visão admin de `/tomadores-al` usando `ConfirmDialog` com `requireText`.
- Registro das duas frentes em `roadmap.md`.
