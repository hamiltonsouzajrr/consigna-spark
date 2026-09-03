# Nova identidade visual — Azul claro "Céu Sereno" com fundo em malha sutil

Objetivo: deixar o sistema mais leve e focado, trocando o azul escuro dominante por um azul claro sereno, com fundo de grid sutil (sem manchas coloridas), em todas as telas.

## Paleta escolhida

- Fundo base: `#eef6ff` (azul muito claro)
- Superfícies/bordas suaves: `#cfe4fa`
- Cor principal (ações, links, gráficos): `#3b82f6`
- Texto e sidebar profunda: `#0f2a4a`

## O que muda

1. Fundo do app
   - Remoção das três manchas radiais coloridas atuais do `body` (elas dispersam a atenção).
   - Novo fundo: azul claro chapado + malha de linhas finas quase invisíveis, fixa ao rolar, com leve clareamento no topo para dar profundidade sem ruído.

2. Tokens de cor (modo claro)
   - `--background`, `--card`, `--popover`, `--muted`, `--secondary`, `--accent`, `--border`, `--input`, `--ring` recalibrados para a paleta azul clara.
   - `--primary` passa de `#1F4FE0` para o azul claro `#3b82f6`, com `--primary-glow` mais suave.
   - Texto principal em azul-marinho `#0f2a4a` (melhor conforto de leitura que preto puro).

3. Sidebar e topo
   - Sidebar deixa de ser azul escuro saturado: passa a ser um marinho sóbrio com item ativo em azul claro — menos peso visual, mais contraste onde importa.
   - Topbar clara com borda inferior sutil, para não competir com o conteúdo.
   - Gradientes `--gradient-app`, `--gradient-sidebar`, `--gradient-topbar`, `--gradient-premium` e `--gradient-subtle` atualizados para a nova paleta.

4. Cards e componentes
   - Cards em branco levemente azulado, borda `#cfe4fa`, sombra mais discreta (foco no conteúdo).
   - `card-premium` e `text-gradient` reajustados para o azul claro.
   - Estados de sucesso/alerta/erro mantidos, apenas harmonizados com a nova base.

5. Modo escuro
   - Ajuste equivalente: base azul-noite, acentos em azul claro, mantendo contraste AA.

6. Telas específicas
   - Login: fundo em malha sutil na mesma paleta, cartão de login mais claro.
   - CRM/Prospecção, Admin, Tomadores, Radar e gráficos: passam a herdar os novos tokens; corrijo pontos onde há cor fixa em código para usar token semântico.

## Detalhes técnicos

- Todas as alterações concentradas em `src/styles.css` (tokens `:root`, `.dark`, `@theme inline`, `@utility app-bg/sidebar-bg/topbar-bg`, `@layer base body`).
- Nova `@utility focus-grid` com o padrão de malha via `background-image` em `linear-gradient` repetido; aplicada no `body` e na tela de login.
- Varredura por classes de cor fixa (`bg-[#...]`, `text-white`, `bg-blue-*`) em `src/components` e `src/routes`, substituindo por tokens semânticos onde afetar a identidade.
- Ajuste das cores das séries em `AdminCharts.tsx` e `ProspeccaoCharts.tsx` para usar a nova escala de azuis.
- Verificação final: typecheck e conferência visual das rotas `/login`, `/prospeccao`, `/admin`, `/tomadores-al` e `/radar`.

## Fora de escopo

- Sem mudança de logotipo, tipografia ou layout/estrutura de telas.
- Sem alteração em regras de negócio, distribuição de leads ou permissões.
