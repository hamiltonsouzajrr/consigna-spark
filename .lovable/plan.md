# Radar Diário Oficial automático + Promovidos recentemente

## Situação atual (verificada)
- `do_registros` tem 1.221 registros, **nenhum** com responsável (a limpeza geral zerou tudo) e 502 sem CPF parcial.
- A tabela de consultoras está **vazia** (0 linhas), então o gatilho de atribuição automática nunca encontra alguém para receber o lead — hoje nada é distribuído.
- Existem 26 contas no sistema, 1 admin.
- Já há duas rotinas automáticas: busca diária (dias úteis, 06:30 local) e um trabalhador a cada 2 minutos que processa a fila.

## O que vai ser feito

### 1. Consultoras = contas do sistema (não-admin)
- Toda conta que não é administrador passa a ser automaticamente uma consultora elegível, identificada pelo e-mail da conta.
- Sincronização automática: ao rodar a distribuição, contas novas entram no rodízio e contas removidas saem, sem cadastro manual.
- O admin continua vendo tudo e pode desativar uma consultora pontualmente na aba de acessos.

### 2. Distribuição automática e justa
- Todo registro novo do Diário Oficial recebe um responsável na hora, em rodízio (quem tem menos leads recebe primeiro), respeitando as preferências (idade/sexo/score) quando existirem.
- Todos os registros são distribuídos; Alto potencial ganha destaque visual e prioridade de ordenação.
- Uma rotina de "varredura" atribui também o que ficou sem dono (os 1.221 atuais), em lotes, mantendo o equilíbrio entre consultoras.

### 3. Rodando sozinho, sem comandos
- Mantém a busca diária existente.
- Nova rotina **semanal** (segunda, 06:00): varre os últimos 7 dias, garante que nenhuma edição ficou de fora, distribui tudo que estiver sem dono e gera um resumo.
- Nova rotina de distribuição a cada 10 minutos: pega o que entrou e ainda não tem dono. Assim o lead chega à consultora mesmo que a busca tenha vindo de um upload manual.
- Cada consultora recebe uma notificação no sistema ("X novos promovidos na sua carteira") quando recebe leads novos.

### 4. Aba PROMOVIDOS RECENTEMENTE no CRM
- Nova aba no menu do CRM, separada da atual "Recém promovidos": lista só os leads do Diário Oficial dos últimos 15 dias, ordenados por potencial e data.
- Cartão com: data de publicação, nome, CPF parcial, órgão, cargo anterior → novo, tipo de movimentação, status e ações (Abordar, WhatsApp, Ligar quando houver telefone).
- Contador de "novos hoje/na semana" no topo e selo de urgência (verde nas primeiras 48h, amarelo até 7 dias, cinza depois).

### 5. Pop-up de prioridade (alta conversão)
- Ao entrar no CRM, se a consultora tem promovidos novos ainda não abordados, abre um pop-up:
  - "Você tem N promovidos recentes — janela de ouro de 48h, chance de conversão muito maior."
  - Lista os 3 mais recentes com botão direto para abordar.
  - Botões: "Ver todos" e "Depois" (não reaparece no mesmo dia).
- Reaproveita o padrão já usado no pop-up de follow-ups.

### 6. Instrução de CPF (quando não vier no Diário)
- Bloco fixo de instrução na aba e dentro do cartão quando o CPF está incompleto/ausente:
  1. Copiar o **nome completo** do lead (botão de copiar).
  2. Consultar pelo nome no **Congonhas**.
  3. Conferir os **3 dígitos do CPF** que o Diário publicou com o resultado, para confirmar que é a pessoa certa.
  4. Se houver mais de um homônimo, usar órgão/cargo como segundo critério e registrar o CPF confirmado no lead.
- Campo para a consultora salvar o CPF completo confirmado, marcando o lead como "CPF validado".

### Melhorias sugeridas incluídas
- Ordenação por "janela de ouro" (mais recente primeiro) em vez de ordem de importação.
- Selo de "sem CPF — validar no Congonhas" para a consultora priorizar corretamente.
- Registro de quem abordou e quando, para o admin medir conversão dos promovidos.

## Detalhes técnicos
- Migração: função de sincronização de consultoras a partir de `auth.users` (excluindo `admin` via `user_roles`); revisão de `atribuir_consultora_automatico` para nunca deixar registro órfão; índices em `do_registros(data_publicacao, consultora_responsavel, status_abordagem)`.
- Novo agendamento `pg_cron`: semanal chamando `/api/public/hooks/radar-diario` com período de 7 dias, e um `/api/public/hooks/radar-distribuir` (autenticado por `apikey`) a cada 10 min para atribuição em lote.
- Server functions novas em `src/lib/radar/`: `getPromovidosRecentes`, `confirmarCpf`, `distribuirPendentes` (helper `.server.ts` reutilizado pelo hook público).
- Nova rota `src/routes/_authenticated/prospeccao.promovidos-recentes.tsx` + item no `AppShell`; pop-up em `src/components/prospeccao/PromovidosPopup.tsx`.
- Notificações via `rh_notifications` (já existente).
- Coluna nova em `do_registros`: `cpf_confirmado` + `cpf_validado_em`.
