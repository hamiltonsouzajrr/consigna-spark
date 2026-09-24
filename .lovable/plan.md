# Unificar a busca de clientes

## Objetivo
Transformar **Pesquisar Cliente** em uma única tela: primeiro procurar nas bases internas e, somente quando solicitado, usar a **Busca Plus RockData** para complementar ou comparar os dados.

## Como ficará para a consultora
1. Um único campo aceitará **CPF, nome completo, primeiro nome ou telefone com DDD**.
2. A primeira resposta virá das bases internas:
   - Leads do CRM;
   - Tomadores AL;
   - Recém-promovidos;
   - Clientes importados da Esteira/Minha carteira;
   - Fichas RockData já armazenadas no sistema.
3. Resultados repetidos serão agrupados por CPF, mantendo as origens identificadas.
4. Cada resultado mostrará uma ficha resumida com nome, CPF, telefones, endereço disponível, responsável, situação e margens.
5. A ficha completa reunirá, em uma única visão:
   - dados encontrados nas planilhas e no CRM;
   - margens da base e margens reais salvas em Minha carteira;
   - valores aproximados liberados com os coeficientes atuais;
   - telefones ordenados por confiança, com estrelas de 0 a 5;
   - endereço completo, bairro, cidade, estado e CEP;
   - origem e data de cada informação.
6. A **Busca Plus** ficará recolhida e opcional. Ao abrir, a consultora poderá consultar a RockData e comparar os dados lado a lado, sem substituir silenciosamente os dados internos.
7. Consultas RockData por CPF já salvas continuarão sendo reaproveitadas por 90 dias. O botão **Atualizar na RockData** fará nova consulta quando necessário.
8. Se a RockData estiver indisponível, a ficha interna continuará funcionando e exibirá a última ficha externa salva, quando existir.

## Organização e segurança
- Manter a busca interna ampla para avisar quando o cliente já pertence a outra consultora, exibindo a responsável sem transferir o cliente.
- Mostrar margens reais editáveis apenas da carteira da consultora responsável; administradores poderão visualizar conforme o acesso atual.
- Padronizar CPF e telefone para que o mesmo cliente não seja interpretado de formas diferentes nas duas buscas atuais.
- Limitar listas grandes e informar quando houver mais resultados, evitando travamentos.
- Separar ações de **Ligar/WhatsApp** do histórico de pesquisas, para que contatos não ocupem as 20 pesquisas recentes.
- Preservar o registro de contato, o histórico do lead e a pontuação já existente, incluindo as regras atuais de intervalo e teto.

## Navegação
- Manter `/consulta-servidor` como endereço principal de **Pesquisar Cliente**.
- Atualizar os atalhos do CRM para abrir essa tela única.
- Fazer o endereço antigo `/prospeccao/pesquisar-cliente` encaminhar para a nova tela, preservando o termo digitado.
- Remover a duplicidade de nomes e telas sem apagar dados ou históricos.

## Detalhes técnicos
- Consolidar a leitura autenticada em uma função de busca interna por CPF, nome e telefone.
- Consultar as bases internas em paralelo e montar uma resposta normalizada por pessoa.
- Manter a integração RockData isolada como enriquecimento sob demanda e o cache existente de 90 dias.
- Reutilizar o cálculo `valorLiberado` e os prazos atuais; não alterar coeficientes nem fórmulas financeiras.
- Manter a planilha original intacta; ajustes de margem e prazo continuam armazenados separadamente.
- Tratar cancelamentos de navegação para que o erro técnico `aborted` não apareça como falha da pesquisa.

## Validação
- Testar como consultora e administrador buscas por CPF com zeros, CPF formatado, primeiro nome, nome completo e telefone.
- Conferir resultados vindos de cada base e a união de um mesmo CPF presente em várias origens.
- Comparar dados internos e RockData, incluindo cache válido, atualização manual e indisponibilidade externa.
- Validar margens reais versus estimativas, endereços, ranking de telefones, Ligar/WhatsApp, histórico e pontos.
- Revisar a tela em computador e celular, garantindo leitura sem cortes ou sobreposição.

## Fora do escopo
- Alterar coeficientes ou fórmulas das calculadoras.
- Alterar regras de distribuição, pontuação ou propriedade dos leads.
- Apagar fichas RockData, pesquisas, contatos, vendas ou históricos existentes.
