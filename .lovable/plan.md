# Sistema fora do ar: banco de dados sobrecarregado

## O que está acontecendo (verificado agora)

O aplicativo em si está no ar — a página de login carrega normalmente, tanto no preview quanto no endereço publicado. O problema está no **backend**:

- Os registros de autenticação das últimas horas mostram erros contínuos:
  `context deadline exceeded` (504) e
  `failed to connect ... database=postgres` (500).
- Um login de teste levou mais de 14 segundos e outro nem completou em 30 segundos.
- Consultas diretas ao banco retornam "connection pooler unavailable" e as métricas do servidor não respondem.

Ou seja: o banco de dados não está aceitando novas conexões, então o serviço de login trava. Para a consultora isso aparece como **tela branca ou login que fica girando** — que é exatamente o relato.

Observação à parte: na tentativa de login capturada, a senha foi digitada como `Prosperidadesempre10.` (com ponto final). A senha correta termina em `10`, sem ponto. Isso é um problema separado, não a causa da queda.

## Plano de recuperação

1. **Reiniciar o backend** (banco + autenticação) para liberar as conexões travadas e voltar ao estado saudável. Leva alguns minutos, durante os quais o sistema fica indisponível.
2. **Confirmar a recuperação**: checar o status do backend, rodar uma consulta simples e fazer um login real de ponta a ponta pelo endereço publicado.
3. **Verificar a causa da saturação** — ler as conexões ativas e as consultas lentas para identificar o que consumiu o pool (rotinas automáticas do Radar/reposição de tomadores, o heartbeat de sessão a cada 30s por usuário, ou consultas pesadas sem índice).

## Prevenção (depois que voltar)

Conforme o que a etapa 3 apontar, aplicar as medidas cabíveis:

- Reduzir a frequência do heartbeat de sessão (`AccessGuard`) e das consultas em tempo real, que hoje batem no banco a cada 30 segundos por usuário conectado.
- Garantir que as rotinas automáticas (Radar Diário Oficial, reposição de carteiras) não rodem em paralelo nem em laço.
- Adicionar índices nas colunas usadas pelas consultas mais lentas.
- Se a saturação for de capacidade real e não de código, recomendar o aumento do tamanho do servidor de banco.

## Detalhes técnicos

- Evidência: `auth_logs` com `status 504 / context deadline exceeded` em `/token` e `/user`; erros `dial tcp [::1]:5432: operation was canceled`.
- `read_query` e o endpoint de métricas retornam indisponibilidade do pooler.
- Nenhuma alteração de código é necessária para restabelecer o serviço — a ação é operacional (restart), seguida de diagnóstico com `pg_stat_activity` e consultas lentas.
