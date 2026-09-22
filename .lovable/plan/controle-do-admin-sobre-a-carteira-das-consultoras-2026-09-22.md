# Controle do admin sobre a carteira das consultoras

O admin passa a decidir, em cada planilha importada, quais informações a consultora vê em **Minha carteira**, e pode corrigir ou remover clientes direto do painel.

## 1. Escolher o que aparece (por planilha importada)

Na tela de importação, depois da prévia, aparece o bloco **O que as consultoras vão ver**, com chaves de liga/desliga:

- Status da venda
- Banco
- Data da venda e prazo
- Valor bruto
- Produção
- Digitador
- Observação da planilha

Regras fixas:

- Nome, CPF, telefone, dia da ligação e margem usada/restante sempre aparecem — são o essencial do acompanhamento.
- **Repasse nunca aparece para a consultora**, em nenhuma configuração.
- Padrão ao importar: status, banco, data, prazo e observação ligados; valor bruto, produção e digitador desligados.
- A mesma configuração pode ser revista depois, na lista de planilhas importadas, e passa a valer imediatamente para os clientes daquele lote.

O admin continua vendo tudo, sempre.

## 2. Editar cliente no painel

Cada cliente da esteira ganha um botão **Editar** que abre um formulário com:

- Cliente: nome, CPF, telefone
- Venda: banco, data da venda, prazo, valor bruto, seguro, status, observação
- Acompanhamento: dia da ligação, próxima ligação, acompanhar sim/não
- Responsável: trocar a consultora

Ao salvar, o lembrete/tarefa da consultora é recalculado com os novos dados (sem apagar o histórico de ligações).

## 3. Remover cliente da carteira

Botão **Remover da carteira**, com confirmação. O cliente deixa de aparecer para a consultora e sai dos avisos de amortização, mas continua visível para o admin num filtro **Removidos**, com todo o histórico de ligações preservado — e pode ser restaurado.

## Detalhes técnicos

**Banco (uma migração)**
- Nova tabela `esteira_lotes` (`lote_id` PK, `nome`, `campos_visiveis jsonb`, timestamps) com GRANTs, RLS (leitura para `authenticated`, escrita só admin) e trigger de `updated_at`. `campos_visiveis` guarda as chaves `status`, `banco`, `data_prazo`, `valor_bruto`, `producao`, `digitador`, `observacao`.
- `esteira_contratos`: colunas `removido_em timestamptz`, `removido_por uuid`.
- Índice parcial em `esteira_contratos (consultant_id, proximo_contato_em) WHERE removido_em IS NULL`.
- Backfill: cria uma linha em `esteira_lotes` para cada `lote_id` existente com o padrão acima.

**Servidor (`esteira.functions.ts`)**
- `esteiraImportar`: grava a linha de `esteira_lotes` com a configuração escolhida (novo campo opcional no input; usa o padrão se ausente).
- `esteiraListar`: filtra `removido_em IS NULL` por padrão (novo parâmetro `incluirRemovidos`, só admin); quando o chamador não é admin, aplica a máscara do lote — devolve `null` nos campos desligados e **sempre** `null` em `repasse`. Máscara aplicada no servidor, não no cliente.
- Novas funções admin: `esteiraAtualizarContrato` (valida campos, recalcula `dia_amortizacao`/`proximo_contato_em`/limite pelo prazo e chama `sincronizarTarefa`), `esteiraRemoverContrato` / `esteiraRestaurarContrato` (marca/limpa `removido_em` e cancela ou recria a tarefa pendente), `esteiraLotes` e `esteiraAtualizarLote`.
- `esteiraHistorico`, `esteiraRegistrarContato` e `esteiraMetricas` passam a ignorar contratos removidos para consultoras; métricas contam apenas ativos.

**Telas**
- `EsteiraTab.tsx`: bloco de chaves de exibição na importação, lista de planilhas com edição da configuração, filtro Ativos/Removidos, e por cliente os botões Editar / Remover / Restaurar (diálogo de edição em componente novo `EditarContratoDialog.tsx`).
- `ClientesPlanilhaCards.tsx` e `AmortizacaoPopup.tsx`: renderizam só os campos que vierem preenchidos, sem layout quebrado quando algo está oculto.

## Fora do escopo

- Fórmulas e coeficientes financeiros.
- Regras, pontuação e confirmação da campanha.
- Apagar históricos de ligações, contatos ou vendas.
