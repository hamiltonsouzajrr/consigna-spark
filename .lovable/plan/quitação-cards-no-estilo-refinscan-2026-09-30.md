# Quitação — cards no estilo RefinScan

## Objetivo
Reestilizar os cards de clientes da aba Quitação (visão da consultora e do admin) seguindo o modelo estético das telas do RefinScan enviadas nas fotos: tema escuro, acentos em verde, anel circular de parcelas restantes e destaque para o troco previsto. Apenas aparência — nenhuma regra de distribuição, importação ou dados muda.

## O que muda

### 1. Card do cliente (lista da Quitação)
Cada card passa a ter, como na referência:
- Fundo escuro com borda verde suave e cantos arredondados.
- Nome do servidor em destaque, com matrícula e competência abaixo.
- Selo verde "QUITAÇÃO IMEDIATA" quando faltar 1 parcela (ou "Quase quitado" quando restarem poucas); selo discreto com o perfil (Conservador, Agressivo etc.).
- Anel circular mostrando as parcelas restantes (ex.: "1 RESTANTES"), preenchido conforme o progresso pago.
- Ao lado do anel: banco/contrato principal, "x/y pagas", parcela e saldo.
- Bloco "TROCO PREVISTO" em verde grande, com o banco e prazo previstos (ex.: "Banco Digio 120x").
- Link "Ver ficha →" que abre a ficha já existente (mesmo conteúdo de hoje: contratos, telefones, registro de contato).
- O selo de resultado do contato (Novo, Interessado, Fechado...) continua visível, adaptado ao tema escuro.

### 2. Resumo no topo (estilo dos indicadores RefinScan)
Acima da lista, cartões escuros com números grandes:
- Clientes na fila e contratos ativos.
- Terminam neste mês / até 6 parcelas / até 30 parcelas (com barras verdes).
- Troco previsto total somado.
Para o admin, o painel de planilhas e a tabela por consultora continuam, ganhando o mesmo acabamento escuro.

### 3. Escopo visual
- Os novos tons de verde/fundo escuro entram como tokens em `src/styles.css` (sem quebrar o restante do sistema, que continua claro).
- A ficha (modal) mantém o tema claro atual; só os cards e o resumo da lista ficam escuros — igual às fotos, onde o escuro é da tela de oportunidades.
- Mobile primeiro: os cards ficam em coluna única no celular, como na referência.

## Fora de escopo
- Nada muda na importação da planilha, na distribuição para consultoras, nos telefones ou no registro de contatos.
- Não é uma cópia do RefinScan: é a mesma linguagem visual aplicada aos dados que já existem na Quitação.

## Verificação
- Typecheck e build.
- Captura de tela da aba Quitação no preview (desktop e mobile) para comparar com as fotos enviadas.
