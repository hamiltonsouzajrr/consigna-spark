# Quitação: usar a planilha "Clientes Aptos – ALAGOAS COMPRA" a seu favor

A planilha tem 1.876 servidores com **CPF**, saldo devedor, parcela, parcelas pagas/em aberto e o troco em 96, 84, 72, 60, 48 e 36x. A aba Quitação já sabe ler esse formato. O que falta é aproveitar melhor esses dados.

## O que vou fazer

**1. Importar e juntar com a base atual**
- Envio pela tela de Quitação, com prévia antes de confirmar.
- Os 391 clientes da planilha "oportunidades" que já estão lá não têm CPF. Quando o nome bater com esta planilha, o cliente passa a ter CPF, sem duplicar, e continua com a mesma consultora.

**2. Telefones automáticos pelo CPF**
- Com o CPF, o sistema busca os telefones no CRM, no Tomadores AL e nas consultas já salvas da RockData.
- Na prévia aparece quantos clientes já têm telefone e quantos não têm.

**3. Prioridade inteligente (quem ligar primeiro)**
Cada cliente ganha uma nota de prioridade de 0 a 100, que considera:
- Troco no melhor prazo (quanto maior, melhor).
- Proporção de parcelas pagas (quanto mais perto de quitar, mais fácil convencer).
- Se tem telefone.
- Status "PRÉ ANÁLISE - APROVADO".
A lista da consultora já abre nessa ordem, com as etiquetas "Prioridade alta", "média" ou "baixa".

**4. Melhor prazo sugerido**
- O card mostra o prazo com o maior troco e avisa quando um prazo curto ainda compensa, por exemplo "48x ainda rende R$ 428".
- Prazos com troco negativo continuam aparecendo em vermelho.

**5. Distribuição equilibrada por valor**
- Nova opção na distribuição: dividir os clientes não só pela quantidade, mas também pelo **troco total**. Assim nenhuma consultora fica só com clientes de valor baixo.

**6. Painel do administrador**
- Troco potencial total, quantos clientes têm telefone, divisão por faixa de troco e o potencial de cada consultora.

## Fora do escopo
- Recalcular taxas: os valores da planilha são usados como vieram.
- Buscar telefones em massa na RockData, porque cada consulta tem custo. Continua uma busca por cliente, feita quando a consultora pedir.

## Detalhes técnicos
- Juntar com os clientes sem CPF: comparar o nome normalizado, sem acentos e com espaços ajustados, com clientes `formato='oportunidades'` que tenham cpf vazio. Só vincular quando o nome bater com um único cliente, e então preencher o cpf.
- Adicionar a coluna `prioridade int` em `quitacao_clientes`, calculada no servidor ao importar, e um índice por (consultant_id, prioridade).
- Telefones: incluir o cache `rockdata_consultas` no `quitacaoTelefonesLote`.
- Distribuição por valor: guloso. Clientes ordenados pelo troco, do maior para o menor, e cada um vai para a consultora com menor soma de troco, desempatando pela menor fila. Aplicar em `quitacaoImportar` e em `quitacaoDistribuirPendentes` com `modo: 'quantidade'|'valor'`.
