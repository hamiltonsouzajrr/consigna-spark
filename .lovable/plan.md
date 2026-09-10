# Corrigir a confusão entre renda e margem

Confirmei o problema: na leitura das planilhas, colunas de **renda** e **salário** eram aceitas como se fossem margem. O valor caía no mesmo campo usado como "margem" na ficha, no cartão da fila e no cálculo da nota do lead.

Também confirmei o tamanho do estrago: dos 36.604 leads, 10.664 têm esse valor gravado (média R$ 1.618, máximo R$ 29.824) e **nenhum** guardou a linha original da planilha, então não há como saber, lead por lead, se aquele número era renda ou margem.

## O que vou fazer

**1. Leitura das planilhas (daqui pra frente)**

- Só aceitar como margem colunas que realmente falam de margem (margem, margem disponível, margem para empréstimo, margem cartão de crédito, margem cartão benefício).
- Renda e salário passam a ser lidos em campo próprio, nunca como margem.
- Guardar junto do lead **o nome exato da coluna** de onde cada valor veio, para a ficha poder usar essa nomenclatura.
- Nada de estimar margem a partir da renda — conforme sua decisão.

**2. Ficha do lead**

- Cada valor aparece com o nome da coluna da planilha (ex.: "MARGEM DISP. EMPRÉSTIMO", "RENDA BRUTA"), sem inventar rótulo.
- O crédito liberado aproximado só é calculado sobre margem. Renda aparece como informação, sem valor liberado.
- Onde não há margem: continua "Consultar no app do servidor".

**3. Leads já importados**

- O valor único desses leads deixa de ser chamado de "margem". Passa a aparecer como **"Valor importado da planilha"**, com o nome do lote de origem, e sem gerar crédito liberado.
- A nota (score) deixa de ganhar pontos por esse valor ambíguo, para não privilegiar leads por um número que talvez seja só o salário.
- A nomenclatura real da coluna volta para esses leads apenas com a reimportação do arquivo usando "Atualizar leads existentes".

## Não entra neste trabalho

- Regras da competição, pontos e metas.
- Telas de Tomadores AL e Radar.
- Estimar margem a partir da renda.

## Detalhes técnicos

- `src/lib/prospeccao/admin-import.ts`: remover `renda`/`salario`/`salário` de `MARGIN_ALIASES`; novo `INCOME_ALIASES`; registrar em `raw_data` as chaves `_col_margem` e `_col_renda` com o nome original da coluna usada.
- `src/lib/prospeccao/prospeccao.utils.ts` / `prospeccao.functions.ts`: aceitar e gravar `renda` (nova coluna numérica em `prospect_leads`).
- Migração: `alter table prospect_leads add column renda numeric`; ajustar `compute_prospect_lead` para pontuar por margem confirmada, não por `orcamento` ambíguo, mantendo o resto do score e do SLA intacto; `update` neutro para recalcular.
- `src/routes/_authenticated/prospeccao.$leadId.tsx`: bloco de margens usa o rótulo vindo de `_col_margem`/`_col_renda` quando existir, com fallback "Valor importado da planilha"; `valorLiberado` só para margens.
- `src/components/prospeccao/CrmCockpit.tsx` e a fila: trocar o rótulo "Margem" pelo mesmo critério.
