# Quitação NG: foco em quem está perto de quitar, data dos dados e duas formas de quitar

## Problema que as fotos mostram
- Hoje a lista mostra 1.645 clientes, quase todos. A ideia é mostrar só quem tem **poucas parcelas faltando**.
- Os cards de resumo em cinza estão difíceis de ler no celular (texto claro sobre fundo cinza).
- O card mostra um traço "—" no lugar do banco e o texto "RESTANTES" fica cortado dentro do anel.
- Não aparece de quando são os dados, e não há comparação entre o cliente quitar sozinho e a empresa quitar.

## O que muda

**1. Lista só com quem está perto de quitar**
- Filtro padrão: "Faltam até X parcelas". Começa em **até 6**, e a consultora pode escolher 1, 3, 6, 12 ou "Todos".
- Faixas no topo, que também servem de filtro ao tocar: "Quitação imediata (1)", "Até 3", "Até 6", "Até 12".
- Ordem da lista: menos parcelas faltando primeiro. Em caso de empate, o maior troco vem antes.
- O administrador define o limite padrão para todas as consultoras.

**2. Data das informações**
- Se a planilha tiver uma coluna de data (data base, competência ou referência), ela aparece no card e na ficha como "Dados de dd/mm/aaaa".
- Se não tiver, aparece a data da importação.
- Aviso "Dados com mais de 30 dias: confirme o saldo antes de oferecer".

**3. Duas formas de quitar (bloco novo na ficha)**
- **Cliente quita com dinheiro próprio**: mostra o valor para quitar (saldo devedor) e a margem que fica livre depois (a parcela atual). Também mostra quanto ele poderia pegar depois com essa margem livre, como estimativa.
- **Empresa quita e refaz a margem**: mostra o troco estimado por prazo, igual à tabela atual. Exige o botão **"Solicitar validação da gerência"**.
  - A solicitação cria um pedido que chega ao administrador com aviso e som, como os alertas que já existem.
  - Etapas do pedido: Aguardando validação → Aprovado ou Recusado, com observação da gerência.
  - A consultora só consegue marcar "Digitada" depois da aprovação.
- Os valores são sempre apresentados como estimativa, com a taxa da planilha indicada.

**4. Ajustes no card, a partir das fotos**
- Resumo do topo com fundo escuro e letras legíveis, no mesmo padrão do card "Quitação imediata".
- O traço no lugar do banco é trocado por "Transfer NG · Ordem 112041".
- O anel mostra "8 restantes" sem cortar o texto.
- Mais destaque para "Faltam 8 parcelas · quitar hoje R$ 6.274,79".
- Selo "Aguardando gerência" quando houver um pedido de validação aberto.

**5. Ajustes na ficha**
- Os botões de etapa ficam agrupados em um seletor único. Hoje são 8 botões, e "Liberada" em azul chama atenção sem motivo.
- O campo "Valor líquido simulado" ganha um rótulo e deixa de aparecer cortado.
- A ordem da ficha passa a ser: resumo, duas formas de quitar, telefones, roteiro e checklist.

## Fora do escopo
- Recalcular saldo ou taxa. Os valores da planilha continuam sendo usados.
- Integração com o sistema de digitação.

## Detalhes técnicos
- `quitacao_clientes`: adicionar a coluna `data_base date`, preenchida pelo parser quando a planilha tiver uma coluna de data. Se não tiver, usar `created_at` do lote.
- Nova tabela `quitacao_validacoes`, com os campos cliente_id, consultant_id, modalidade ('proprio' ou 'empresa'), valores, status, observacao e decidido_por. Com GRANT e RLS: a consultora vê só os próprios pedidos e o admin vê e decide todos.
- Filtro `maxAbertas` em `quitacaoListar`, com padrão salvo em uma configuração do admin.
- Mudanças em `QuitacaoPage.tsx` (resumo, card, ficha, seletor de etapa) e em `quitacao.functions.ts` (solicitar e decidir validação). O alerta ao admin reutiliza o mecanismo de pop-up com som.
