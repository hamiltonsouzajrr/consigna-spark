# Painéis com indicadores hierárquicos

## Objetivo
Aplicar a direção visual escolhida aos painéis de consultoras e administradores, mantendo todos os dados, filtros, ações e regras atuais.

## O que será melhorado

1. **Hierarquia dos indicadores**
   - Destacar o indicador principal em um bloco maior e mais escuro.
   - Organizar os demais números por prioridade, evitando vários cartões com o mesmo peso visual.
   - Usar números maiores, rótulos curtos e barras de progresso mais fáceis de comparar.

2. **Painel da consultora**
   - Dar prioridade à meta diária e ao que falta cumprir.
   - Exibir qualidade das ligações como indicador visual de desempenho.
   - Separar pendências e atrasos com cores claras e consistentes.
   - Dar mais espaço aos próximos follow-ups e deixar o estado da fila fácil de identificar.
   - Preservar filtros, histórico, ligação, reagendamento, conclusão e competição.

3. **Painel do administrador**
   - Transformar “Saúde da operação” no principal resumo de fiscalização.
   - Destacar imediatamente clientes sem responsável, contas inativas e incidentes.
   - Separar Saúde, Produção e Equipe em grupos visuais claros.
   - Melhorar a leitura dos totais do CRM, Tomadores, Radar, lotes e consultoras sem remover nenhuma informação.

4. **Cores e gráficos**
   - Azul: informação e ações.
   - Verde: concluído, saudável e meta atingida.
   - Âmbar: atenção ou pendência.
   - Vermelho: somente atraso, risco ou problema.
   - Criar uma paleta consistente para gráficos, com contraste e legendas legíveis nos modos claro e escuro.

5. **Computador e celular**
   - No computador, usar blocos assimétricos para evidenciar prioridades.
   - No celular, empilhar os indicadores na ordem de importância, sem cortar textos ou ações.
   - Manter dimensões estáveis para evitar saltos durante carregamentos e atualizações.

## Detalhes técnicos

- Ajustar os tokens semânticos e as cores de gráficos em `src/styles.css`.
- Refinar `CrmCockpit`, `CrmCockpitAdmin`, `ResumoGeralTab`, `AdminCharts` e `ProspeccaoCharts`.
- Reutilizar os componentes de botões, cartões, seletores e indicadores existentes.
- Não alterar consultas, cálculos, metas, permissões, distribuição ou regras de negócio.
- Validar os dois painéis em computador e celular com dados de uma sessão autenticada.

## Fora de escopo

- Novas métricas ou mudanças nos cálculos atuais.
- Alterações no menu, permissões ou fluxo de trabalho.
- Redesenho de outras páginas fora dos painéis de consultora e administrador.
