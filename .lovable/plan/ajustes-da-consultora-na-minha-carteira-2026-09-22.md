# Ajustes da consultora na Minha carteira

## Objetivo
Permitir que cada consultora atualize, em seus próprios clientes, a margem utilizada, a margem restante e o prazo, mantendo intactos os dados importados da planilha.

## Implementação
- Criar um registro separado de ajustes por cliente e consultora, sem sobrescrever prazo ou demais campos importados.
- Proteger os ajustes para que cada consultora altere somente clientes atribuídos a ela; administradores poderão consultar e corrigir todos.
- Na leitura da carteira, exibir primeiro o valor ajustado pela consultora e, quando ainda não houver ajuste, usar o valor original ou já disponível no CRM.
- Adicionar ação “Atualizar margem e prazo” nos cards e na lista completa de Minha carteira.
- Exibir no formulário os valores atuais e informar claramente que a planilha original será preservada.
- Recalcular o término dos lembretes mensais quando o prazo ajustado mudar, sem apagar o histórico de contatos.
- Atualizar imediatamente os cards, a lista e o pop-up de amortização após salvar.

## Validação
- Confirmar permissões por responsável no servidor.
- Testar campos vazios, valores zero, prazo válido e atualização repetida.
- Verificar a tela em computador e celular e executar a checagem de tipos.

## Fora do escopo
- Alterar os dados brutos já importados.
- Mudar fórmulas financeiras, distribuição de clientes ou histórico de contatos.
