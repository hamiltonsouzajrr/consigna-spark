# Salvar ficha RockData em Minha carteira, comparar dados e identificar cálculos

## Objetivo
Permitir que a consultora compare a ficha RockData com os dados internos, salve o cliente na própria carteira com nome, CPF, endereço e telefones, e vincule os cálculos realizados a esse cliente.

## Comparação RockData × planilha
- Na tela **Pesquisar Cliente**, após abrir a Busca Plus, mostrar uma tabela única com as colunas **Dado**, **Planilha/Carteira**, **RockData** e **Diferença**.
- Comparar nome, CPF, telefone principal, demais telefones, endereço, cidade e margens quando esses dados existirem nas duas fontes.
- Classificar cada linha como **Igual**, **Diferente**, **Só na planilha** ou **Só na RockData**, usando cores semânticas e texto legível.
- Normalizar CPF e telefones antes da comparação para não marcar apenas diferenças de máscara ou formatação.
- Para listas, destacar quais telefones existem nas duas fontes e quais aparecem somente em uma delas.
- Manter a planilha original intacta: a tabela será apenas visual e não substituirá dados automaticamente.

## Fluxo da consultora
1. Pesquisar o cliente primeiro nas bases internas e abrir a **Busca Plus RockData** quando desejar comparar.
2. Conferir na mesma tela a tabela de diferenças entre planilha/carteira e RockData.
3. Na ficha completa da RockData, tocar em **Salvar em Minha carteira**.
4. Confirmar nome, CPF, endereço principal e telefones antes da inclusão.
5. Salvar o cliente na carteira sem registrar venda, pontuação ou conversão.
6. Se o CPF já estiver na carteira da mesma consultora, atualizar os dados RockData em vez de duplicar.
7. Após salvar, mostrar **Salvo em Minha carteira** e oferecer acesso direto à carteira.

## Dados e regras
- O cadastro será feito em Leads/CRM, que já é a base de clientes usada pela carteira.
- Serão gravados nome, CPF normalizado, telefone principal, todos os telefones, cidade e a ficha completa com endereços e origem RockData.
- A ficha RockData armazenada por 90 dias continuará sendo o cache externo; salvar na carteira criará um cadastro separado, pertencente à consultora.
- A planilha original, conversões, vendas, metas, pontos e distribuição não serão alterados.
- Uma consultora não poderá sobrescrever o cliente de outra. Se o CPF já pertencer a outra consultora, o sistema avisará quem é a responsável e não fará transferência.
- Administradores manterão a visualização conforme as permissões atuais.

## Calculadoras
- Adicionar um seletor comum de cliente às três abas: Prévia AL, Contracheque GOV AL e Banese.
- O seletor mostrará apenas clientes da carteira da consultora.
- Exibir o cliente selecionado durante o cálculo e permitir salvar o resultado associado a ele.
- Registrar cliente, calculadora utilizada, entradas, resultados e data.
- Mostrar uma confirmação clara de que o cálculo ficou vinculado ao cliente.
- A ficha do cliente em Minha carteira exibirá os cálculos vinculados, sem misturá-los com vendas ou conversões.

## Implementação técnica
- Criar uma função autenticada para salvar/atualizar o lead da RockData, validando CPF, propriedade e duplicidade antes da gravação.
- Reaproveitar `prospect_leads.raw_data` para preservar endereço completo e demais campos da ficha; não é necessário alterar a estrutura dessa tabela.
- Consolidar os dados internos do resultado selecionado e os dados RockData em uma estrutura de comparação no servidor.
- Criar uma tabela de cálculos por cliente, com acesso da própria consultora e dos administradores, incluindo permissões e políticas de segurança.
- Integrar o seletor e a ação de salvar cálculo às três calculadoras sem alterar fórmulas, coeficientes ou resultados atuais.
- Exibir o histórico de cálculos na área do cliente em Minha carteira.

## Validação
- Comparar fichas com dados iguais, divergentes e ausentes, incluindo telefones com máscaras diferentes.
- Confirmar que a comparação não altera a planilha original.
- Salvar uma ficha nova com nome, CPF, endereço e múltiplos telefones.
- Salvar novamente o mesmo CPF e confirmar atualização sem duplicidade.
- Testar tentativa de salvar CPF já atribuído a outra consultora.
- Confirmar que o cliente aparece em Minha carteira e na busca das calculadoras.
- Vincular e salvar cálculos nas três abas e conferir o histórico do cliente.
- Validar permissões de consultora e administrador em computador e celular.