# Consultora vê "Something went wrong" ao entrar

## O que foi verificado

- A tela do print é a tela genérica de erro do app (`src/router.tsx`), em inglês e sem nenhuma pista do motivo.
- Ao entrar, quem não é administrador é enviado para o portal de RH (`src/routes/index.tsx` → `/rh/portal`).
- Abri o portal com uma sessão sem perfil de administrador no ambiente local e ele carregou normalmente, sem erro de permissão. Ou seja: não é falta de acesso da consultora.
- Diagnóstico ainda não confirmado. A causa mais provável é o navegador da consultora, com a página antiga já aberta, tentar baixar um pedaço da versão anterior do app depois de uma nova publicação — hoje isso cai direto na tela de erro, sem tentar recarregar. Confirmar isso é o primeiro passo do plano.

## O que será feito

1. **Confirmar o motivo**: passar a registrar e exibir o texto real da falha na tela de erro (hoje o motivo só aparece em desenvolvimento). Assim, se acontecer de novo, a consultora consegue nos dizer exatamente o que apareceu.
2. **Recuperação automática**: quando a falha for de carregamento de arquivos do app (versão antiga no navegador após uma publicação), a tela recarrega sozinha uma vez, buscando a versão nova, em vez de mostrar erro. Se falhar de novo, mostra a tela de erro normal, sem ficar em laço.
3. **Tela de erro em português**, com título e mensagem claros, botões "Tentar de novo" e "Ir para o início", além de um "Ver detalhes" recolhido com o motivo técnico.
4. **Primeira tela da consultora passa a ser o CRM de prospecção** (`/prospeccao`), como você pediu. Administradores continuam no painel de administração e o portal de RH segue acessível pelo menu de quem tem acesso.

## Detalhes técnicos

- `src/router.tsx`: `DefaultErrorComponent` reescrito em português; detecção de erros de chunk (`Importing a module script failed`, `Failed to fetch dynamically imported module`, `error loading dynamically imported module`, `ChunkLoadError`) com um `sessionStorage` de controle para recarregar apenas uma vez por sessão; `console.error` do erro para aparecer nos logs.
- `src/routes/index.tsx`: destino de usuário não administrador muda de `/rh/portal` para `/prospeccao`.
- Sem mudanças em banco, importação de leads, pontuação da competição ou nas demais telas.
