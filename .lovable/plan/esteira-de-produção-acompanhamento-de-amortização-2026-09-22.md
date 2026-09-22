# Esteira de produção: acompanhamento de amortização

## O que a planilha traz

A aba da esteira tem o cabeçalho na segunda linha e estas colunas:

`STATUS · DATA · CPF · NOME · BANCO · SEGURO? · PRAZO · VALOR BRUTO · PRODUÇÃO · REPASSE · DIGITADOR · CONSULTORA · OBSERVAÇÃO`

Cada linha é uma venda já realizada, com a consultora responsável pelo nome.

## O que vou construir

**1. Nova aba "Carteira / Esteira" (admin) para subir a planilha**

- Você escolhe o arquivo e vê uma prévia com todas as linhas lidas.
- Linhas cujo nome da coluna CONSULTORA não casa com uma conta do sistema aparecem destacadas, com uma lista para você escolher a consultora certa antes de importar.
- Reimportar a mesma planilha atualiza as vendas já existentes (mesma pessoa + mesma data + mesmo banco), sem duplicar.
- Todos os status são importados; o status aparece na ficha do cliente.

**2. Distribuição automática para quem vendeu**

Cada venda importada fica visível apenas para a consultora responsável (e para os administradores).

**3. Acompanhamento mensal de amortização**

- O lembrete cai no mesmo dia do mês da venda (venda no dia 17 → ligar todo dia 17).
- Repete mês a mês até o fim do prazo do contrato (ex.: 84x = 84 meses); quando o dia não existe no mês, usa o último dia.
- O lembrete entra na mesma agenda de tarefas que a consultora já usa, então aparece no pop-up de avisos e em "Minha semana".
- Ao ligar, a consultora registra: falei / amortizou / não atendeu / não quis, com observação. Marcar o mês como feito agenda automaticamente o mês seguinte.
- Ela pode encerrar o acompanhamento de um cliente (contrato quitado, por exemplo).

**4. Tela da consultora "Minha carteira de amortização"**

- Lista do dia, da semana e dos atrasados, com nome, CPF, banco, prazo, valor e parcela.
- Histórico de cada contato dentro da ficha do cliente.
- Funciona no computador e no celular.

**5. Painel do administrador**

No painel de fiscalização: total de contratos na esteira, contratos por consultora, ligações do mês feitas x pendentes e quantos clientes amortizaram.

## Detalhes técnicos

- Migração: tabela `esteira_contratos` (status, data_venda, cpf, nome, banco, seguro, prazo, valor_bruto, producao, repasse, digitador, consultora, consultant_id, observacao, dia_amortizacao, proximo_contato_em, acompanhamento_ativo, lote_id) e `esteira_contatos` (contrato, data, resultado, observação, autor). GRANTs para `authenticated`/`service_role`, RLS: consultora lê/escreve só os próprios registros via `consultant_id`; admin tudo via `has_role`.
- Índice único para o upsert idempotente (cpf + data_venda + banco).
- Leitura da planilha no navegador com a lib `xlsx` já usada em `ImportProducaoDialog`, ignorando as linhas de título e normalizando CPF, valores com R$/vírgula e `PRAZO` "84X" → 84.
- Server functions em `src/lib/prospeccao/esteira.functions.ts` com `requireSupabaseAuth`: importar lote (só admin), listar carteira, registrar contato, encerrar acompanhamento, métricas admin.
- Lembretes criados em `lead_tasks` no padrão já usado pelos follow-ups, para reaproveitar pop-up e agenda.
- Rotas novas: `_authenticated/prospeccao.esteira.tsx` (admin, importar/fiscalizar) e `_authenticated/prospeccao.amortizacao.tsx` (consultora), com link no menu lateral.

## Fora do escopo

Alterar fórmulas financeiras, pontuação da campanha ou os fluxos atuais de CRM, Tomadores e Radar.