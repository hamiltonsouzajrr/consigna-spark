# Recém promovidos não aparecem — vínculo e distribuição igualitária

## Diagnóstico (verificado no banco)

- Existem 1.221 registros do Diário Oficial e **todos já têm responsável**, mas 100% deles estão presos a **19 cadastros antigos/duplicados de consultora que estão inativos** (nomes no formato de login: `positivecred2026`, `steh`, `mariajulia`, ...), cada um com ~58 leads.
- Os **21 cadastros de consultora ativos hoje** (os que correspondem às contas reais, com nome próprio, ex.: `Joycebarbosa`, `Mannoella`) têm **0 leads**.
- Resultado: a consultora entra na aba, o sistema encontra o cadastro dela (ou nenhum), mas não há nenhum lead com o nome dela → tela zerada, exatamente como no print.
- Além disso, de 44 contas ativas, **5 não têm nenhum cadastro de consultora** — para essas aparece a mensagem "sua conta ainda não foi vinculada".
- Há duplicidade real de cadastro (ex.: `Hemelynathalia` aparece duas vezes com o mesmo e-mail).

## O que vai ser feito

### 1. Limpar e unificar o cadastro de consultoras
- Um único cadastro por conta, identificado pelo e-mail da conta.
- Cadastros duplicados e os antigos em formato de login são fundidos no cadastro correto (mesmo e-mail) ou marcados como legado.
- Toda conta não-administradora passa a ter cadastro ativo automaticamente, inclusive as 5 que hoje ficam sem vínculo.
- Se a consultora entrar na aba e ainda não tiver cadastro, ele é criado na hora — ninguém mais vê "conta não vinculada".

### 2. Redistribuição igualitária de tudo que já existe
- Os 1.221 registros são redistribuídos entre **todas as consultoras ativas com conta**, em partes iguais (mesma quantidade para cada uma; a sobra vai para as primeiras da fila).
- A redistribuição respeita a "janela de ouro": os promovidos mais recentes são espalhados primeiro, para que todas recebam leads novos, não só antigos.
- Leads já abordados/contatados permanecem com quem os trabalhou (não se perde histórico).

### 3. Distribuição igual sempre que o Radar encontrar algo novo
- A regra de rodízio passa a contar os leads **realmente na carteira de cada uma** (contagem ao vivo), em vez de um contador armazenado que pode ficar defasado — é isso que garante igualdade ao longo do tempo.
- Somente consultoras ativas **com conta no sistema** entram no rodízio; administradores ficam de fora.
- Cada rodada distribui em blocos iguais: enquanto houver lead sem dono, cada consultora recebe um por vez, em ordem de quem tem menos.
- Continuam valendo as rotinas automáticas já existentes (busca diária, varredura semanal e distribuição a cada 10 minutos) — elas passam a usar a nova regra.

### 4. Visibilidade e conferência
- Painel do admin em Prospecção → Admin → Distribuição ganha um resumo "leads por consultora (últimos 15 dias / total)" e o botão "Redistribuir igualmente agora".
- A aba Promovidos recentemente mostra quantos leads a consultora recebeu na janela e a data da última entrega.

## Detalhes técnicos

- Migração:
  - `sync_radar_consultoras` reescrita: deduplica por e-mail (um cadastro por conta), reativa cadastros correspondentes a contas existentes e desativa cadastros sem conta.
  - Nova função `redistribuir_do_registros_igualmente(_janela_dias, _incluir_abordados boolean)` — round-robin determinístico sobre consultoras ativas com conta, ordenando por `data_publicacao desc`, atualizando `consultora_responsavel` e `atribuido_em`.
  - `distribuir_do_registros_pendentes` passa a calcular a carga por `count(*)` em `do_registros` (não por `total_leads_atribuidos`) e a exigir e-mail com conta em `auth.users`.
  - Índice em `do_registros(consultora_responsavel, data_publicacao desc)`.
- `identificar()` em `src/lib/radar/promovidos-recentes.functions.ts`: fallback que chama a sincronização e tenta novamente antes de devolver `vinculada: false`.
- `src/lib/radar/distribuicao.server.ts`: novo helper `redistribuirIgualmente()`; nova server function admin-only `redistribuirPromovidos` exposta na `DistribuicaoTab.tsx`, mais um resumo por consultora.
- Os antigos cadastros em formato de login ficam com `ativo = false` e sem leads após a redistribuição.
