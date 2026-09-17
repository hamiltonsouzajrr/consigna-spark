# Situação das melhorias pedidas

## Já entregues

1. **Aviso de follow-up organizado** — lista única com clientes do CRM e de Tomadores, identificando a origem, com Ligar, WhatsApp, Reagendar e "Marcar como visto". Marcar como visto encerra o retorno de vez e o contador e a página de Follow-ups atualizam na hora.
2. **Calculadoras unificadas** — uma única opção "Calculadoras" no menu, com as abas Prévia AL (todos os bancos), Contracheque GOV AL e Banese. Fórmulas e coeficientes intactos, e os endereços antigos redirecionam para a aba certa.
3. **Margem ao converter** — ao marcar Convertido no CRM ou em Tomadores abre o cadastro da venda com tipo de margem (empréstimo, cartão de crédito, cartão benefício), margem usada e restante, data, valor liberado, prazo, parcela, observação e lembrete. A venda fica pendente até o gerente confirmar, e tipo/usada/restante aparecem no histórico e na conferência.
4. **Telefone em Tomadores** — telefones encontrados pelo CPF e os cadastrados manualmente aparecem juntos, sem repetição, com ligar e WhatsApp; só a responsável (e administradores) pode alterar.

## Pendentes

5. **"Minha carteira de clientes" no menu lateral, logo abaixo de Calculadoras** — hoje ela existe, mas só por um botão dentro do CRM.
6. **Revisão geral de tela (computador e celular)** — abrir todas as telas e conferir que nada fica encoberto ou fora de alcance, ajustando o que estiver atrapalhando o uso.

## Bloqueio no momento

O banco de dados e o login estão pausados, então não é possível entrar no sistema para fazer a revisão de tela nem testar os fluxos. Assim que o backend voltar a funcionar, eu executo os dois itens pendentes.

## Detalhes técnicos

- Adicionar item de navegação `/prospeccao/conversoes` em `src/components/AppShell.tsx`, na seção de prospecção imediatamente após `/calculadoras`, com `consultoraOnly`.
- Revisão de layout: percorrer as rotas em `src/routes/_authenticated/` em 390px e 1280px verificando sobreposição de barras fixas, tabelas sem rolagem horizontal, diálogos maiores que a viewport e botões cobertos pelo rodapé/pop-ups; corrigir só em CSS/estrutura de apresentação.
- Nenhuma mudança em fórmulas, pontuação, campanha ou histórico.
