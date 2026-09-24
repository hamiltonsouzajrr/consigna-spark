# Salvar ficha RockData em Minha carteira e identificar cálculos

## Objetivo
Permitir que a consultora transforme uma ficha RockData em cliente da própria carteira, preservando nome, CPF, endereço e telefones. Esse cliente também poderá ser selecionado nas calculadoras para identificar e guardar seus cálculos.

## Fluxo da consultora
1. Na ficha completa da RockData, exibir o botão **Salvar em Minha carteira**.
2. Ao tocar, mostrar uma confirmação resumida com nome, CPF, endereço principal e telefones.
3. Salvar o cliente na carteira da consultora sem registrar venda, pontuação ou conversão.
4. Se o CPF já estiver na carteira da mesma consultora, atualizar os dados vindos da RockData em vez de duplicar o cliente.
5. Após salvar, trocar o botão para **Salvo em Minha carteira** e oferecer acesso direto à carteira.
6. Nas calculadoras, permitir pesquisar e selecionar um cliente da própria carteira por nome ou CPF.
7. Exibir o cliente selecionado no cálculo e salvar o resultado associado a ele.

## Dados e regras
- O cadastro será feito em Leads/CRM, que já é a base de clientes usada pela carteira.
- Serão gravados: nome, CPF normalizado, telefone principal, todos os telefones, cidade e a ficha completa com endereços no histórico de origem RockData.
- A ficha RockData armazenada por 90 dias continuará sendo o cache externo; salvar na carteira criará um cadastro separado, pertencente à consultora.
- A planilha original, conversões, vendas, metas, pontos e distribuição não serão alterados.
- Uma consultora não poderá sobrescrever o cliente de outra. Se o CPF já pertencer a outra consultora, o sistema avisará quem é a responsável e não fará transferência.
- Administradores manterão a visualização conforme as permissões atuais.

## Calculadoras
- Adicionar um seletor comum de cliente às três abas: Prévia AL, Contracheque GOV AL e Banese.
- O seletor mostrará apenas clientes da carteira da consultora.
- Ao salvar um cálculo, registrar cliente, calculadora utilizada, entradas, resultados e data.
- Mostrar uma confirmação clara de que o cálculo ficou vinculado ao cliente.
- A ficha do cliente em Minha carteira exibirá os cálculos vinculados, sem misturá-los com vendas ou conversões.

## Implementação técnica
- Criar uma função autenticada para salvar/atualizar o lead da RockData, validando CPF, propriedade e duplicidade antes da gravação.
- Reaproveitar `prospect_leads.raw_data` para preservar endereço completo e demais campos da ficha; não é necessário alterar a estrutura dessa tabela.
- Criar uma tabela de cálculos por cliente, com acesso da própria consultora e dos administradores, incluindo permissões e políticas de segurança.
- Integrar o seletor e a ação de salvar cálculo às três calculadoras sem alterar fórmulas, coeficientes ou resultados atuais.
- Exibir o histórico de cálculos na área do cliente em Minha carteira.

## Validação
- Salvar uma ficha nova com nome, CPF, endereço e múltiplos telefones.
- Salvar novamente o mesmo CPF e confirmar atualização sem duplicidade.
- Testar tentativa de salvar CPF já atribuído a outra consultora.
- Confirmar que o cliente aparece em Minha carteira e na busca das calculadoras.
- Vincular e salvar cálculos nas três abas e conferir o histórico do cliente.
- Validar permissões de consultora e administrador em computador e celular.
