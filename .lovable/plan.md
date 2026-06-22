# Radar Diário Oficial

> Encontre promoções, progressões e movimentações de servidores em poucos segundos.

Sistema para importar arquivos do Diário Oficial (PDF/TXT/HTML/DOCX), extrair texto, identificar via IA servidores promovidos, revisar manualmente, evitar duplicidades, exportar e acompanhar por dashboard. Será construído sobre a infraestrutura já existente em `/prospeccao/promovidos` (extração de PDF no navegador + IA via Lovable AI Gateway).

## Estrutura de navegação

Novas rotas sob `/radar` (área dedicada), reaproveitando `AppShell` e o controle de acesso já existente (`useRhAccess` / `has_role`):

```text
/radar               Dashboard (KPIs + gráficos)
/radar/importar      Upload + processamento de arquivos
/radar/registros     Painel de resultados (tabela + filtros + revisão)
/radar/arquivos      Histórico de arquivos importados
```

## Banco de dados

Três tabelas novas (migração com GRANTs + RLS conforme padrão):

**`do_arquivos`** — arquivos importados
- nome_arquivo, tipo_arquivo, data_upload, data_publicacao, numero_edicao, orgao_detectado, caminho_arquivo (storage), status_processamento, total_registros_extraidos, total_aprovados, total_erros, uploaded_by

**`do_registros`** — registros extraídos
- arquivo_id (FK), nome_servidor, matricula, cpf_parcial, cargo, orgao, tipo_movimentacao, data_publicacao, data_ato, pagina, classe_anterior, classe_nova, nivel_anterior, nivel_novo, referencia_anterior, referencia_nova, numero_ato, trecho_original, confianca_ia, categoria, status_revisao, duplicado_possivel, created_at, updated_at

Perfis (Administrador / Analista / Visualizador) reusam o sistema atual de papéis (`user_roles` + `has_role`); admin = Administrador. Analista/Visualizador serão tratados como usuários autenticados (todos podem ver/revisar; só admin exclui arquivos e exporta listas grandes). Não criaremos tabela `usuarios` separada — papéis já vivem em `user_roles` (evita escalonamento de privilégio).

**Storage**: bucket privado `diario-oficial` para guardar os arquivos originais.

### RLS
- `do_arquivos` / `do_registros`: SELECT/INSERT/UPDATE para `authenticated`; DELETE só admin (`has_role`); `service_role` ALL.

## Extração de texto (cliente)

Reaproveita `extractPdfLines` (pdfjs + OCR tesseract). Adiciona:
- **TXT**: leitura direta.
- **HTML**: `DOMParser` → `innerText`.
- **DOCX**: `mammoth` (browser build) → texto.

Detecção heurística no cliente: órgão (linhas com "SECRETARIA/PREFEITURA/GOVERNO…"), data de publicação (regex de datas pt-BR), número da edição ("Edição nº", "Nº ...").

## Processamento com IA

Estende `src/lib/prospeccao/promovidos.functions.ts` (ou novo `radar.functions.ts`) com `analisarDiarioAI`:
- Usa `google/gemini-2.5-flash` via gateway, em chunks (como já feito).
- Prompt do extrator especializado fornecido pelo usuário; retorna JSON estruturado com todos os campos, `confianca_ia`, `categoria` e `tipo_movimentacao` ("Possível promoção, precisa revisar" quando ambíguo).
- Schema Zod enxuto (campos curtos) para evitar limite de estados do Gemini; validação/normalização em código.

## Fluxo de importação

1. Admin envia arquivo(s) em `/radar/importar`.
2. Cliente extrai texto + metadados (órgão, data, edição).
3. Upload do original ao storage; cria linha em `do_arquivos`.
4. IA analisa o texto → registros estruturados.
5. Dedup (nome+matrícula+órgão+data+tipo) → marca `duplicado_possivel`.
6. Insere registros com `status_revisao = 'Novo'`; atualiza contadores do arquivo.

## Painel de resultados `/radar/registros`

Tabela com: Nome, Matrícula, Cargo, Órgão, Tipo, Data publicação, Página, Status, Confiança.
- Busca por nome; filtros por órgão, data, tipo, status; ordenar por data recente.
- Linha expansível: trecho original + dados completos + botões Aprovar / Editar / Ignorar / Marcar duplicado / Abrir arquivo original (signed URL).
- Cores: verde aprovado, amarelo pendente, vermelho ignorado/erro.

## Histórico `/radar/arquivos`
Lista de arquivos com métricas (encontrados, aprovados, erros), quem enviou, botão reprocessar (re-roda IA sobre texto salvo) e excluir (admin).

## Dashboard `/radar`
KPIs (arquivos, pessoas, promoções confirmadas, progressões, pendentes) + gráficos (por data de publicação e por tipo de movimentação) usando `recharts`. Órgãos com mais movimentações.

## Exportação
`/radar/registros`: exportar seleção em CSV, Excel (`xlsx`/SheetJS) e PDF (jsPDF), com escolha de campos. Listas grandes (acima de limite) só para admin.

## LGPD / segurança
Aviso fixo no rodapé das telas do Radar:
"Este sistema organiza informações públicas extraídas de publicações oficiais. O uso dos dados deve respeitar a LGPD, finalidade legítima, transparência e boas práticas de tratamento de dados."

## Detalhes técnicos
- Funções de servidor em `src/lib/radar/radar.functions.ts` (CRUD + IA), todas com `requireSupabaseAuth`; mutações destrutivas e export grande verificam `has_role(admin)`.
- Upload ao storage via server function (`supabase` do usuário) ou client storage com RLS no bucket.
- Novas libs: `mammoth` (DOCX), `xlsx` (Excel), `jspdf` (+autotable), `recharts` (se ainda não houver).
- Fases de entrega: (1) DB + storage + importar + IA + registros básicos; (2) revisão/dedup/abrir original; (3) histórico + dashboard + exportação.

## Não incluído / pressupostos
- Reusa papéis existentes em vez de nova tabela `usuarios`.
- Mantém a aba atual `/prospeccao/promovidos` intacta; o Radar é uma área nova e mais completa.
