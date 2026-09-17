# Distribuição igualitária de leads + limpeza da aba de administração

## O que você pediz e o que eu encontrei

**No CRM (botão "Distribuir agora")**: hoje a divisão é feita só sobre os clientes que estão sem responsável, na ordem em que aparecem no banco, uma para cada consultora em rodízio. Resultado: quem já tinha uma fila grande fica com fila ainda maior, porque a carteira que cada uma já tem não entra na conta. Não há sorteio: a ordem da lista influencia quem recebe os melhores.

**Na aba Tomadores (botão de distribuir)**: o sistema completa a carteira de uma consultora por vez, na ordem alfabética, até 10 clientes por faixa (alta, média, baixa). Quando o estoque acaba no meio, as primeiras da lista saem com carteira cheia e as últimas ficam sem nada.

## O que vou fazer

### 1. Divisão realmente igual no CRM
- Antes de dividir, contar quantos clientes em aberto cada consultora selecionada já tem.
- Entregar sempre para quem está com a fila menor, até todas ficarem com o mesmo total (a sobra que não divide exato vai para as menores filas).
- Embaralhar a lista antes de dividir, para ninguém receber sempre os mesmos tipos de cliente.
- A tela vai mostrar, antes de confirmar, uma prévia por consultora: fila atual, quanto vai receber, fila final.
- Os critérios "por score" e "por cidade" continuam existindo, mas também passam a respeitar o equilíbrio de fila.

### 2. Divisão realmente igual em Tomadores
- Em vez de completar uma consultora por vez, o sistema passa a distribuir cliente por cliente em rodízio entre todas as consultoras ativas, alternando as faixas.
- Quando o estoque for menor que o necessário, a diferença entre as carteiras nunca passa de um cliente.
- Mensagem final informando quantos cada uma recebeu, e aviso claro quando o estoque acabar.

### 3. Revisão da aba de administração (o que funciona, o que sai, o que melhora)
A tela "Distribuição de Leads" tem hoje **oito** ações diferentes, várias fazendo quase a mesma coisa. Proposta de organização:

Fica (funcionando e útil):
- Distribuir clientes sem responsável (com a divisão igual nova)
- Reciclar clientes parados
- Redistribuir clientes já trabalhados
- Reiniciar recém-promovidos
- Encerrar acesso de quem está sem entrar há 10 dias
- Quadro com a carteira de cada consultora

Sai ou vira uma coisa só:
- "Sorteio aleatório geral" e "Distribuir agora" viram uma única ação de distribuição, com uma opção "embaralhar tudo, inclusive o que já está atribuído".
- "Redistribuir igualmente (Radar)" passa a ser a mesma ação de distribuição, escolhendo a base (CRM, Radar, Tomadores) — deixa de ser um bloco separado.
- "Entrega por desempenho (meritocracia)" fica escondida atrás de um link "opções avançadas", porque ela contraria a divisão igual que você pediu (posso remover de vez, se preferir).
- "Limpar todos os vínculos" sai da tela principal e vai para o fim, em área de risco, com confirmação por texto.

Também na aba:
- Nomes mais simples nas abas e nos blocos, uma linha explicando cada ação.
- Ajuste para celular: os blocos hoje passam da largura e o quadro de carteiras fica cortado.

## Detalhes técnicos
- `adminDistributeLeads` (`prospeccao.functions.ts`): carregar carga atual por `consultant_id` (status fora de ganho/perdido), embaralhar os leads livres e atribuir sempre à consultora de menor carga, reaproveitando `applyAssignments`/`reattachLeadHistory`. Nova função de prévia (sem gravar) para a tela.
- Tomadores: substituir o laço sequencial de `reporTodasCarteirasInterno` por rodízio por lead/faixa, reutilizando a RPC `garantir_pool_tomadores_faixa` com alvo incremental (1 por vez por consultora) — sem alterar as regras de reciclagem e travas já existentes na RPC.
- `DistribuicaoTab.tsx`: consolidar cards, adicionar prévia por consultora, mover ações destrutivas para bloco separado, revisar grid responsivo.
- Sem migração de banco. Nenhuma mudança em pontuação, campanha, coeficientes ou histórico.

## Fora do escopo
Fórmulas e coeficientes, regras de pontuação/campanha, exclusão de históricos.
