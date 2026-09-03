# O que manter visível na conta de administrador

Hoje o admin enxerga quase o mesmo menu da consultora. A proposta é deixar na conta de administrador apenas o que serve para **gerir o sistema, distribuir leads e acompanhar métricas** — tudo que é execução comercial do dia a dia some do menu do admin (continua intacto para as consultoras).

## Manter no admin

| Item | Por quê |
| --- | --- |
| Administração (`/admin`) | Hub central, saúde do sistema e gráficos. |
| RH → Acessos | Criar/editar/bloquear/desbloquear contas, auditoria. |
| Painel admin de prospecção (`/prospeccao/admin`) | Importação de planilhas, distribuição, base de leads. |
| Radar Diário Oficial | Comando da busca e distribuição automática. |
| Tomadores com Margem – AL | Somente na visão de gestão: cobertura da base, reposição e exportação. |
| Qualidade de leads | Métrica de qualidade da base. |
| Metas, Ranking, Competição | Acompanhamento de desempenho da equipe. |
| RH (módulo completo) | Gestão de pessoas. |
| WhatsApp | Configuração das contas e monitoramento. |

## Ocultar do admin (permanece para consultoras)

| Item | Motivo |
| --- | --- |
| Simulação Prévia AL, Contracheque GOV AL, Banese | Ferramentas de venda, não de gestão. |
| CRM (`/prospeccao`) na visão de fila | Admin já tem a visão gerencial; nada de fila/leads. |
| Promovidos Recentemente | Lista operacional de abordagem. |
| Follow-ups | Agenda pessoal de contato. |
| Servidores sem acesso | Lista de prospecção. |
| QR Codes e Avaliações de pós-venda | Uso operacional; ficam acessíveis pelo hub `/admin` em "Módulos opcionais", fora do menu principal do admin. |

## Limpeza junto

- `/prospeccao/promovidos` e `/prospeccao/promovidos-recentemente` são resquícios (uma tela antiga e um redirecionamento). Manter apenas `/prospeccao/promovidos-recentes` como rota oficial e transformar as outras em redirecionamento único.
- O hub `/admin` passa a ser o ponto de entrada padrão do administrador ao abrir o sistema.

## Detalhes técnicos

- `src/components/AppShell.tsx`: marcar como `consultoraOnly` os itens de Simulação, CRM, Promovidos Recentemente, Follow-ups e Servidores sem acesso; QR Codes e Avaliações também saem do menu do admin.
- `src/routes/_authenticated/admin.tsx`: manter as três seções atuais, garantindo que QR Codes e Avaliações continuem alcançáveis em "Módulos opcionais".
- `/tomadores-al`: para admin, exibir apenas o bloco de gestão (cobertura, reposição, exportação), sem cards de carteira pessoal.
- Redirecionar `/prospeccao/promovidos` para `/prospeccao/promovidos-recentes` e remover a tela antiga.
- Nenhuma alteração de banco, RLS ou permissões — apenas navegação e visibilidade de UI.
