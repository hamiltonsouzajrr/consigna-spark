# Radar do Diário Oficial — diagnóstico e melhorias

## Como está hoje (verificado agora no banco)

- Coleta funcionando: 155 edições registradas, última em 02/09/2026, nenhuma fonte em erro, nenhuma pendente de OCR.
- 1.240 registros extraídos e **todos com consultora responsável** (nenhum lead órfão).
- Agendamentos ativos: busca diária (seg–sex 06:30 Maceió), semanal (segunda), worker da fila a cada 2 min, distribuição a cada 10 min.

## Problemas encontrados

1. **Job travado desde 27/08.** A busca de período `24/08 → 27/08` está `running` com 73 de 75 edições. As 2 restantes ficaram presas em "processando" (a reserva do item nunca expira), então o job nunca conclui.
2. **Efeito colateral do job travado.** Enquanto existe job "running", a entrega imediata após cada extração é adiada de propósito — hoje os leads só chegam pela rodada de 10 em 10 minutos, e o worker gasta uma execução a cada 2 minutos sem fazer nada.
3. **Busca diária sem repescagem.** Uma única tentativa por dia às 06:30; quando a edição ainda não foi publicada, o dia passa em branco. Os logs mostram vários dias com 0 edições encontradas e uma falha HTTP 500 do site em 25/08 sem nova tentativa.
4. **Sem alerta de silêncio.** Se o radar passar dias sem trazer nenhum registro, ninguém é avisado; só se percebe olhando o painel.
5. **Painel sem visão de saúde.** A tela do Radar mostra execuções, mas não responde de imediato "está saudável?" (dias sem edição, itens presos, última entrega às consultoras).

## O que fazer

### Fase 1 — Destravar e evitar que trave de novo

- Liberar os 2 itens presos e concluir o job de 27/08.
- Reserva com expiração: item em "processando" há mais de 15 minutos volta para a fila automaticamente, com contador de tentativas (após 3 falhas vira "erro" e gera alerta) — assim nenhum job fica eterno.
- Fechamento automático de jobs sem itens pendentes e de jobs parados há mais de 24h.

### Fase 2 — Coleta mais confiável

- Repescagem da busca diária: além das 06:30, tentativas às 09:00 e 13:00 (horário de Maceió) que só rodam se ainda não houver edição do dia registrada.
- Retentativa com espera progressiva quando o site do Diário responde erro/timeout, em vez de desistir na primeira falha.
- Varredura de lacunas: uma vez por dia, conferir os últimos 15 dias úteis e reprocessar datas sem edição registrada.

### Fase 3 — Visibilidade e alerta

- Alerta automático quando passar 48h úteis sem nenhuma edição nova ou sem nenhum registro extraído.
- Cartão "Saúde do Radar" no painel administrativo: última edição capturada, última execução, itens presos, leads distribuídos nas últimas 24h e dias em branco recentes.
- Botão "Destravar fila" no painel, para o administrador liberar itens presos sem depender de suporte.

## Detalhes técnicos

- Reserva com expiração e retentativa dentro da função `claim_diario_fila_item` (colunas `claimed_at` e `tentativas` em `diario_busca_fila`), mais uma rotina de recuperação chamada pelo worker atual.
- Fechamento de jobs órfãos em `atualizarProgressoJob` / `processarJobsPendentes` (`src/lib/radar/diario-scheduler.server.ts`).
- Repescagem via novos agendamentos pg_cron apontando para o hook já protegido por segredo, com verificação prévia de edição do dia.
- Retentativas com espera progressiva em `listarEdicoes`/`baixarPdf` (`src/lib/radar/diario-crawler.server.ts`).
- Alertas gravados em `diario_alertas`; cartão de saúde alimentado por uma server function administrativa nova e exibido na rota do Radar.  
  
Crie uma parte que eu como admin consiga liberar para que apareça para a consultora os leads recem promovidos de uma forma organizada e nunca misturar os leads do CRM com os Tomadores e os promovidos , arquitete.
- &nbsp;