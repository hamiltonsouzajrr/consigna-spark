# Painel de admin só com gestão e métricas

O acesso de administrador deixa de mostrar telas de trabalho de consultora (fila de leads, meta diária de ligações, follow-ups, busca/filtros de lead) e passa a mostrar apenas o que serve para gerenciar o sistema e medir a operação. O acesso de consultora continua exatamente como está hoje.

## 1. CRM (`/prospeccao`) no acesso de admin

Hoje, mesmo com o cockpit administrativo no topo, o admin ainda recebe abaixo: os 5 cartões da fila (Leads de hoje, Follow-ups atrasados, Leads quentes, conversão, 1ª resposta), a barra de filtros (Todos/Hoje/Quentes/Atrasados + filtros avançados de sexo, idade e score), a busca por nome/telefone/cidade e a lista de cards de lead com botões de ligar/WhatsApp.

Mudança: no acesso de admin nada disso é renderizado. O admin vê só o painel gerencial:
- Saúde da operação (Radar, leads/promovidos sem consultora, tomadores livres, consultoras ativas/inativas, incidentes, contas bloqueadas, nº de admins).
- Cobertura da carteira (total de leads, sem tratativa, esquecidos, distribuição por status, origens por conversão).
- Desempenho: top consultoras por ganhos/volume e ranking da competição.
- Atalhos de gestão: distribuir, importar, qualidade, acessos.

Título e subtítulo da página passam a refletir a visão gerencial quando o usuário é admin ("Gestão da prospecção — métricas e distribuição").

## 2. Hub `/admin`

Sai o que é ferramenta de consultora e fica o que é gestão/métrica:
- Remover o cartão "Servidores sem acesso" (lista de leads para abordagem).
- "Tomadores com margem — AL" deixa de apontar para a tela de trabalho e passa a descrever/abrir apenas a visão de estoque e distribuição; o card é reposicionado em "Gestão do sistema" com texto de estoque, não de abordagem.
- Reorganizar os blocos em: "Sistema e acessos", "Métricas e desempenho" (metas, ranking, competição, qualidade das ligações) e "Módulos opcionais" (RH completo, WhatsApp, QR Codes, avaliações).
- Manter o painel de Saúde da operação e as Ações rápidas (revogar inativos, senha/e-mail, repor carteiras, redistribuir).

Nenhuma rota é apagada: as telas de consultora continuam existindo e acessíveis por URL/menu, apenas não são mais oferecidas dentro do painel administrativo.

## Detalhes técnicos

- `src/routes/_authenticated/prospeccao.index.tsx`: envolver o bloco de cartões da fila, filtros, busca e lista de leads em `{!isAdmin && ( ... )}`; textos do cabeçalho condicionais a `isAdmin`. Nenhuma consulta de fila é disparada para admin (o carregamento de leads também passa a ser ignorado nesse caso, evitando puxar a base inteira).
- `src/components/prospeccao/CrmCockpitAdmin.tsx`: permanece como está (já é 100% métrica/gestão).
- `src/routes/_authenticated/admin.tsx`: ajustar o array `sections` (remover/realocar cards e retitular blocos). Sem alterações em server functions, RLS ou banco.
