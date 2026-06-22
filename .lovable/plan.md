# Radar Diário Oficial — Busca Diária Automática (Alagoas)

Boa notícia técnica: o site **expõe uma API JSON oficial**, então não preciso fazer scraping frágil de HTML.

```text
Listar edições:  GET /apinova/api/editions/published?page=1
  → { editions: [ { id, number, edition_type_name, suplement, publication_date } ] }
Baixar PDF:      GET /apinova/api/editions/downloadPdf/{id}
```

A automação roda **toda a cadeia no servidor** (Cloudflare Workers): consulta a API, baixa o PDF, extrai o texto e aplica a IA já existente (`analisarDiarioAI`, com as regras anti-falso-positivo e priorização de seções que acabamos de implementar).

## Arquitetura (3 serviços)

```text
diarioCrawlerService     → consulta a API, detecta novas edições, baixa PDFs + suplementos, salva no storage
diarioExtractionService  → extrai texto do PDF (server-side), roda IA, classifica e grava registros
diarioSchedulerService   → orquestra a execução diária, grava logs, evita duplicidade, dispara alertas
```

Arquivos:
- `src/lib/radar/diario-crawler.server.ts` — busca na API + download.
- `src/lib/radar/diario-extraction.server.ts` — extração de texto (lib `unpdf`, compatível com Workers) + chamada da IA.
- `src/lib/radar/diario-scheduler.server.ts` — pipeline completo (crawler → extração → registros → logs → alertas).
- `src/lib/radar/diario.functions.ts` — server functions autenticadas (admin) para os botões manuais e leitura do painel.
- `src/routes/api/public/hooks/radar-diario.ts` — endpoint chamado pelo cron diário (autenticado por `apikey`).

> Limitação honesta: OCR de PDF escaneado **não** roda no agendamento (Workers não suporta Tesseract). Se um PDF vier sem texto extraível, o sistema marca a edição como "Requer OCR" e gera um alerta para o admin processar manualmente pela aba Importar (que já tem OCR no navegador).

## Banco de dados

**`fontes_diario_oficial`** (registro de cada PDF encontrado/baixado):
`data_consulta, data_publicacao, numero_edicao, tipo_edicao, titulo, suplemento, edition_id, url_origem, url_pdf, nome_arquivo, caminho_arquivo (storage), hash_arquivo, status_download, status_processamento, total_paginas, total_registros_extraidos, requer_ocr, erro_processamento, arquivo_id (FK→do_arquivos), criado_em, atualizado_em`

Duplicidade: índice único em `(data_publicacao, numero_edicao, tipo_edicao, suplemento)` + verificação por `hash_arquivo`/`url_pdf`. Já baixado não reprocessa, exceto via botão "Reprocessar".

**`diario_automacao_logs`** (log de cada execução):
`executado_em, gatilho (cron/manual/data/intervalo), url_consultada, arquivos_encontrados, arquivos_baixados, registros_extraidos, duracao_ms, erros, detalhe(jsonb)`

**`diario_alertas`** (avisos ao admin, lidos no painel):
`tipo, titulo, mensagem, fonte_id (FK), severidade, lido, criado_em`. Tipos: nova edição baixada, promoção confirmada encontrada, +10 registros numa edição, falha de download, site fora do ar, PDF requer OCR.

Os registros extraídos continuam indo para as tabelas existentes **`do_arquivos`/`do_registros`**, reaproveitando a aba Registros, filtros (potencial, status) e exportação já prontos.

RLS: leitura/edição para `authenticated`; ações destrutivas e "rodar agora" restritas a admin (`has_role`); `service_role` total.

## Painel "Busca Diária do Diário Oficial"

Nova aba em `/radar/busca-diaria` (`src/routes/radar.busca-diaria.tsx`), adicionada ao menu do Radar.

KPIs: última consulta, última edição encontrada, PDFs baixados hoje, PDFs aguardando processamento, registros encontrados hoje, promoções confirmadas, pendentes de revisão, possíveis falsos positivos.

Ações:
- **Rodar busca agora** (admin) — executa o pipeline para hoje.
- **Buscar edição de data específica** (date picker).
- **Buscar últimos 7 dias** / **Buscar últimos 30 dias**.
- Por fonte na lista: **Reprocessar edição**, **Abrir PDF original** (URL assinada do storage).

Seções: lista de edições/fontes (data, nº, tipo, suplemento, status download/processamento, nº registros), painel de alertas não lidos e histórico de logs da automação.

## Agendamento

`pg_cron` + `pg_net` chamando `POST /api/public/hooks/radar-diario` **de segunda a sexta às 06:30** (`30 9 * * 1-5` em UTC, equivalente a 06:30 BRT). Configurado via tool de inserção (contém URL + apikey, fora de migração).

## Boas práticas de acesso (implementadas)
- Intervalo entre requisições (delay) ao baixar múltiplos PDFs.
- Baixa apenas edições ainda não salvas; não repete download (checa hash/edition_id).
- Mantém `url_origem`/`url_pdf` no histórico.
- Reprocessamento sempre manual.
- User-Agent e timeout definidos; se a API falhar, grava log + alerta "site fora do ar".

## Ordem de execução
1. Migração: 3 tabelas + GRANTs + RLS + índice de duplicidade.
2. `bun add unpdf`.
3. Serviços server-side (crawler, extraction, scheduler) + server functions.
4. Rota pública do cron.
5. Painel `/radar/busca-diaria` + item no menu.
6. Agendamento `pg_cron` (06:30, dias úteis).
7. Verificação: rodar o pipeline manualmente uma vez e validar download + extração + registros.

## Pontos a confirmar
- **Alertas ao admin**: começo com **alertas in-app** no painel (sino/lista). Quer também **e-mail**? Posso adicionar depois via conector de e-mail.
- Mantém os registros nas tabelas atuais (`do_registros`) — recomendado, para reaproveitar a tela de Registros. Confirma?
