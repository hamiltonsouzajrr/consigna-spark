# Ficha do lead mais organizada + margens com valor liberado

## Como fica a ficha

Blocos claros, na ordem:

1. **Contato** — telefones válidos, cada um com Ligar / WhatsApp / Copiar. Se houver muitos, mostra os 3 primeiros e um "Ver mais telefones".
2. **Margens e crédito estimado** — destaque da tela (detalhe abaixo).
3. **Dados do servidor** — município, órgão / lotação, cargo, matrícula.
4. **Cadastro** — CPF, origem, lote de importação, datas.

## Bloco de margens

Um cartão por margem, com o valor da margem e, logo abaixo, o **valor aproximado liberado**:

- Margem para empréstimo
- Margem cartão de crédito
- Margem cartão benefício

Regras:

- O valor liberado usa os coeficientes da calculadora de margem do próprio sistema (tabela Banese já existente na tela de simulação).
- Empréstimo: prazo padrão de 96 parcelas, com seletor de prazo na própria ficha para recalcular.
- Cartão de crédito e cartão benefício: prazo fixo de 90 parcelas.
- Cada valor liberado aparece com a marca de estimativa ("aprox.").
- Soma total estimada exibida no rodapé do bloco quando houver pelo menos uma margem.
- Quando a margem não veio na planilha: **"Consultar no app do servidor"**, sem valor liberado.
- A "margem informada" antiga continua aparecendo quando é o único dado disponível.

## Sobre os leads já importados

Os 36.604 leads atuais não guardaram a linha original da planilha, e só 10.664 têm a margem informada. Para os demais os três cartões vão dizer "Consultar no app do servidor" até a planilha ser reimportada com "Atualizar leads existentes"; nas importações novas as três margens já aparecem com o valor liberado.

## Detalhes técnicos

- `src/routes/_authenticated/prospeccao.$leadId.tsx`: reorganizar as seções, reaproveitar `rawField`/`margemPlanilha`, novo bloco de margens com estado local de prazo.
- Novo módulo `src/lib/prospeccao/coeficientes.ts` (ou export da tabela existente em `simulacao-alagoas.tsx`) para a tabela de coeficientes ser usada nas duas telas sem duplicação.
- Só apresentação: nada de banco, importação, pontuação, Tomadores AL ou Radar.
