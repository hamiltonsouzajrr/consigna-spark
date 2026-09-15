# Follow-ups, ferramentas unificadas e dados da conversão

## 1. Organizar o aviso de follow-up

- Simplificar o pop-up para mostrar cada cliente com ações claras: **Ligar**, **WhatsApp**, **Reagendar** e **Marcar como visto**.
- **Marcar como visto** concluirá o follow-up, retirará o cliente da lista e impedirá que o mesmo aviso apareça novamente.
- Manter a opção de adiar, mas remover o comportamento de reabrir repetidamente um lembrete já concluído.
- Unificar no aviso os retornos do CRM e de Tomadores, identificando a origem e abrindo a tela correta.
- Atualizar imediatamente o contador e a página de follow-ups após concluir ou reagendar.

## 2. Unificar as calculadoras sem alterar os cálculos

- Criar uma única opção **Calculadoras** no menu.
- Reunir na mesma tela, em abas:
  - Prévia AL — Todos os bancos;
  - Cálculo por contracheque — Governo de AL;
  - Banese.
- Preservar fórmulas, coeficientes, campos, resultados e regras atuais de cada calculadora.
- Manter os endereços antigos funcionando por redirecionamento para a aba correspondente, evitando links quebrados.

## 3. Registrar margem ao converter no CRM ou em Tomadores

- Ao escolher **Convertido**, abrir o cadastro da venda antes de concluir a conversão.
- A consultora escolherá o tipo de margem usado: **Empréstimo**, **Cartão de crédito** ou **Cartão benefício**.
- Registrar **margem usada** e **margem restante**, além dos dados já existentes da venda: data, valor liberado, prazo, parcela, observação e lembrete.
- Reutilizar a tela e o histórico de conversões existentes, vinculando corretamente a venda ao cliente do CRM ou de Tomadores.
- A venda continuará pendente até a confirmação do gerente; as regras de pontuação não serão alteradas.
- Mostrar tipo, margem usada e margem restante no histórico da conversão e na conferência do gerente.  
Ao converter a venda ela aparecerá na aba Minha carteira de clientes na Aba lateral abaixo da calculadora

## 4. Telefone em Tomadores

- Continuar buscando automaticamente telefones no CRM pelo CPF, como já acontece hoje.
- Quando não existir telefone encontrado, permitir que a consultora cadastre um ou mais números diretamente no cliente de Tomadores.
- Exibir juntos os telefones encontrados pelo CPF e os cadastrados manualmente, sem duplicações.
- Permitir ligar e abrir o WhatsApp pelos números salvos.
- Restringir a alteração à consultora responsável pelo cliente; administradores mantêm acesso de gestão.  
  
5. Ajustar todo o site para abrir corretamente e ser possivel utilizar as funcoes sem encobrir ou nao mostrar as funçoes, isso deve acontecer uma revisao em todo site e ser ajustado

## Detalhes técnicos

- Migração em `prospect_conversoes`: adicionar origem da conversão, vínculo opcional com Tomadores, tipo de margem e valor da margem usada; manter `margem_restante_valor` para o saldo.
- Migração em `tomadores_al`: adicionar armazenamento dos telefones informados manualmente, com os GRANTs e políticas atuais preservados.
- Criar funções autenticadas para concluir/reagendar follow-ups e salvar telefones, validando a responsável no servidor.
- Adaptar a lista de follow-ups para consultar CRM e Tomadores; ao concluir, limpar `next_follow_up_at` e concluir a tarefa vinculada quando houver.
- Fazer a conversão de CRM/Tomadores usar o mesmo formulário de conversão e evitar vendas pendentes duplicadas.
- Extrair o conteúdo das três calculadoras para módulos reutilizáveis e montar uma rota única com abas, sem reescrever a lógica financeira.
- Validar em computador e celular: conclusão definitiva do aviso, reagendamento, conversão nas duas origens, telefone por CPF/manual e todas as calculadoras.

## Fora do escopo

- Alterar coeficientes ou fórmulas financeiras.
- Alterar regras, pontos ou confirmação da campanha.
- Apagar históricos existentes de follow-up, vendas ou contatos.