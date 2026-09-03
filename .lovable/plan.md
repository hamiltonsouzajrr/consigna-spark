# Promovidos recentes + Tomadores: o que já está feito e o que falta

A maior parte deste escopo foi entregue no turno anterior. Este plano fecha os itens restantes.

## Já concluído

- Rebalanceamento igualitário dos promovidos dos últimos 15 dias entre consultoras com conta ativa (24 leads redistribuídos entre 31 contas, incluindo o lead órfão).
- Fallback na aba de promovidos recentes: quando não há publicação na janela de 15 dias, aparecem os promovidos mais recentes da carteira com aviso e selo de idade, em vez de tela vazia.
- Datas de última publicação capturada e última entrega exibidas no topo da aba.
- Tomadores AL: histórico de atendimento por lead, RPC de reinício, bloqueio de reentrega para quem já atendeu, e card admin "Reiniciar trabalhados e redistribuir" com prévia e confirmação por texto.

## O que falta fazer

### 1. Repescagem e varredura de lacunas (02–03/09)

Rodar a repescagem e a varredura de lacunas do Radar para os dias sem captura, conferir o cartão de saúde e destravar a fila se houver itens presos (o job antigo ainda tinha duas pendências). Usar as funções administrativas já existentes de saúde e destravamento, sem criar rotina nova.

### 2. Consultoras cadastradas sem conta no sistema

Hoje existem 56 consultoras cadastradas e 34 com conta de acesso; as 22 restantes nunca recebem leads e um lead atribuído a elas fica invisível. Adicionar ao painel administrativo:

- Lista das consultoras sem conta correspondente, com nome, e-mail cadastrado e quantidade de leads presos com elas.
- Ação para devolver os leads dessas consultoras ao rateio igualitário, para nada ficar invisível.
- Aviso no cartão de saúde quando existir qualquer lead atribuído a nome sem conta.

### 3. Fechamento

Atualizar `roadmap.md` com os dois itens acima quando concluídos.

## Detalhes técnicos

- Repescagem/lacunas/destravamento: usar `getRadarSaude` e `destravarFilaRadar` em `src/lib/radar/diario.functions.ts` e os modos já suportados pelo hook `radar-diario`; nenhuma migração necessária.
- Consultoras sem conta: novo server fn admin em `src/lib/radar/promovidos-recentes.functions.ts` (ou módulo admin equivalente) cruzando `radar_consultoras` com `auth.users` via cliente de serviço, retornando nome, e-mail e contagem em `do_registros`; a devolução reutiliza `redistribuir_do_registros_igualmente`.
- UI: novo card na área administrativa do Radar / hub admin, reaproveitando `ConfirmDialog` para a ação de devolver leads.
- As 5 pendências do linter de segurança do banco são anteriores a este trabalho (tabela sem política, extensão em `public`, funções `SECURITY DEFINER` de outros módulos) e podem ser tratadas em frente separada.
