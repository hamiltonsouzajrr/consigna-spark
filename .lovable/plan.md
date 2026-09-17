# Qualidade da prospecção — corrigir números e abrir para as consultoras

## 1. Corrigir os números errados (prioridade)

Confirmei no banco os três problemas:

- **Taxa de abordagem sempre 100%.** O cálculo usa os recém-promovidos do Radar (1.330 registros, todos com situação "novo") e conta como "abordado" tudo que não está marcado como "pendente" — como ninguém usa essa palavra, todos entram como abordados. Passa a usar os clientes do CRM e a considerar abordado quem realmente teve contato registrado (primeira resposta ou último contato).
- **Tabela "Desempenho real por consultora" sem contatos e sem vendas.** O vínculo entre a pessoa e os números vem do cadastro de colaboradores, que hoje casa com zero consultoras (24.465 contatos em 30 dias, nenhum atribuído a alguém na tela). Passa a usar o próprio vínculo das consultoras do CRM, com nome no perfil e e-mail como reserva.
- **"Leads qualificados" travado em 1.000.** A leitura traz no máximo 1.000 linhas. Passa a contar no banco, mostrando o número real.

Ainda nesta parte: cada número passa a dizer de onde vem e de que período é, e a tela ganha aviso claro quando a leitura falha (hoje ela simplesmente fica vazia).

## 2. Filtro único de período no topo

Um seletor de 7, 30 ou 90 dias que vale para a tela inteira. Todos os blocos passam a responder ao mesmo período, com botão de atualizar e a hora da última leitura.

## 3. Alertas de quem precisa de atenção

Acima da tabela, uma faixa com as consultoras que precisam de ajuda no período escolhido:

- retornos atrasados acima do aceitável;
- poucos contatos em relação à média da equipe;
- carteira grande com muitos clientes nunca abordados.

Cada alerta mostra o nome, o número que disparou o aviso e um atalho para a carteira dessa consultora. A tabela passa a ordenar da melhor para a que mais precisa de apoio, com nome (não e-mail) e destaque visual nas linhas em alerta.

## 4. Fim da repetição na tela

Hoje três blocos mostram as mesmas coisas (contatos, qualificados, follow-ups) com períodos diferentes. Fica:

1. **Resumo do período** — contatos, taxa de abordagem, taxa de conversão, retornos atrasados.
2. **Evolução** — comparação com o período anterior.
3. **Funil** — do cliente entregue à venda fechada.
4. **Quem precisa de atenção** + tabela por consultora.

Títulos e colunas em linguagem simples ("Já falou com", "Retornos atrasados", "Fechou venda").

## 5. Bloco de qualidade dentro de "Minha semana" (consultora)

Na tela que as consultoras já usam, um bloco novo com os números dela: quantos clientes recebeu, com quantos já falou, retornos atrasados, vendas do período e como ela está em relação à média da equipe (sem expor os números individuais das colegas). Admin continua podendo escolher a consultora no seletor que já existe.

## 6. Revisão de tela

Conferir em computador e celular: tabelas com rolagem lateral, gráficos sem cortar e cartões sem estourar a largura.

## Detalhes técnicos

- `src/lib/prospeccao/qualidade.functions.ts`: trocar as leituras em massa (`.limit(50000)` em `do_registros`, `lead_events`, `prospect_leads`, `lead_tasks`) por uma função de banco agregada (`SECURITY DEFINER` com checagem de admin, no padrão de `prospect_dashboard_admin`) que recebe o número de dias e devolve os totais e as linhas por consultora já calculados — resolve de uma vez o teto de 1.000 linhas, o risco de estouro de tempo e a base errada.
- Abordagem passa a sair de `prospect_leads` (`first_response_at`/`last_contact_at`), não de `do_registros`; identificação por `consultant_id` com nome de `profiles.nome_completo` e e-mail via Auth Admin como reserva; abandonar o cruzamento por `rh_employees.full_name`.
- `getCallQualityStats` (`prospeccao.functions.ts`): contagem de qualificados por agregação no banco e recorte de dias vindo do filtro, em vez de 7 dias fixos e leitura completa de `prospect_leads`.
- `getEvolucaoProspeccao`: aceitar o mesmo parâmetro de dias para acompanhar o filtro.
- `prospeccao.qualidade.tsx`: substituir `useEffect`/`useState` por `useQuery` com estado de erro e botão de atualizar; estado do filtro compartilhado com os dois painéis.
- Consultora: nova função autenticada com escopo no próprio `consultant_id` (sem admin), consumida por um bloco novo em `prospeccao.minha-semana.tsx`.
- Índices de apoio, se a medição mostrar necessidade, em `lead_events(consultant_id, created_at)` e `lead_tasks(consultant_id, status, due_at)`.
- Validar com `npx tsgo --noEmit` e conferir no navegador (desktop e celular).

## Fora do escopo

Fórmulas e coeficientes das calculadoras, regras de pontuação e da campanha, confirmação de vendas pelo gerente e qualquer exclusão de histórico.
