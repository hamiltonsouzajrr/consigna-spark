# Novo modelo de planilha na aba Quitação ("oportunidades")

A planilha tem 764 linhas: são 391 servidores, e cada linha é um contrato (508 cartões e 256 empréstimos). Ela **não tem CPF**. A identificação é feita pelo nome e pela matrícula. As colunas são: Servidor, Matrícula, Competência, Perfil, Ritmo, Banco, Contrato, Tipo, Parcelas, Restantes, Parcela, Saldo, Banco previsto, Crédito previsto e Troco previsto.

## O que muda

1. **Aceitar este modelo na importação da Quitação**, junto com o modelo antigo. O sistema reconhece o formato sozinho. O arquivo pode ser CSV com ";" ou Excel.
2. **Um cliente por servidor**: as linhas com a mesma matrícula viram uma única ficha, com a lista de todos os contratos dele.
3. **Ficha do cliente** mostra:
   - Contratos: banco, tipo, parcelas, restantes, valor da parcela e saldo.
   - Soma das parcelas e do saldo devedor.
   - Proposta: banco previsto (ex.: Digio 120x), crédito previsto e troco previsto.
   - Perfil (Conservador, Moderado, Agressivo ou Sem histórico), ritmo e competência.
4. **Busca do CPF pela matrícula**: o sistema procura o CPF no CRM, em Tomadores AL e em Recém-promovidos para puxar os telefones. Quem não for encontrado fica marcado como "sem CPF", com um botão para Pesquisar cliente pelo nome.
5. **Lista da consultora** ordenada pelo maior troco previsto, com filtros por perfil, tipo (cartão ou empréstimo) e "tem proposta".
6. **Reimportar sem duplicar**: o cliente é reconhecido pela matrícula e pelo nome. Os valores são atualizados e a consultora e o histórico são mantidos. A distribuição continua sendo feita pela menor fila.

## Fora do escopo
- Recalcular o troco. Uso os valores da planilha.

## Detalhes técnicos
- Migração em `quitacao_clientes`: `cpf` passa a ser opcional e são criadas as colunas `matricula`, `perfil`, `ritmo`, `competencia`, `banco_previsto`, `credito_previsto`, `troco_previsto`, `contratos` jsonb (lista) e `formato`. Um novo índice único em (matricula, nome normalizado) vale quando não há CPF. O índice antigo (cpf, cod_ordem) continua para o modelo antigo.
- Parser em `quitacao.tsx`: detecta o cabeçalho "Servidor;Matricula", converte "1.154,20" para número, agrupa por matrícula e soma as parcelas e o saldo.
- `quitacaoImportar`: o upsert usa a chave conforme o formato. O CPF é resolvido pela matrícula em `prospect_leads`, `tomadores_al` e `do_registros`. `quitacaoTelefones` passa a aceitar a matrícula.
