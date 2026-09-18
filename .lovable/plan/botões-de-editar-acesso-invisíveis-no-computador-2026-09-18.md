# Botões de editar acesso invisíveis no computador

Na tela de Acessos, cada linha da lista de usuários tem três botões (lápis para editar, sair para encerrar sessões, lixeira para excluir). Eles existem no código sem qualquer regra de "só no celular", então no computador estão sendo **cortados pela largura da coluna**: no layout de desktop a lista fica presa em uma coluna estreita de 380 px, e a área rolável não mostra rolagem horizontal — o que passa da borda simplesmente desaparece. No celular a lista ocupa a largura toda e os botões aparecem.

Essa causa é a hipótese mais provável pelo layout, mas ainda não foi confirmada na tela real.

## Passo 1 — Confirmar

Abrir a tela em largura de computador, com uma conta de administrador, e conferir se os botões estão presentes porém fora da área visível da lista.

## Passo 2 — Corrigir a linha da lista

- Dar mais espaço à coluna da lista no computador (largura flexível em vez de fixa em 380 px).
- Garantir que o bloco de ações nunca seja comprimido: nome e e-mail encurtam, os botões ficam sempre visíveis à direita.
- Em larguras apertadas, agrupar as três ações em um único botão de menu ("...") com Editar, Encerrar sessões e Excluir, para nunca faltar espaço.
- Manter os rótulos de ajuda ao passar o mouse e as mesmas permissões atuais (ações de usuário seguem só para administrador).

## Passo 3 — Validar

Conferir em computador, tablet e celular que o lápis abre a edição do usuário e que as outras duas ações continuam funcionando.

## Detalhes técnicos

- Arquivo único: `src/routes/_authenticated/rh.acessos.tsx`.
- Linha 499: trocar `lg:grid-cols-[380px_1fr]` por algo como `lg:grid-cols-[minmax(420px,34%)_1fr]`.
- Linhas 588-657: envolver os ícones em um container `shrink-0` e reduzir o bloco de texto com `min-w-0`; adicionar variante compacta com `DropdownMenu` (já disponível em `@/components/ui/dropdown-menu`) para telas estreitas.
- Sem mudança de lógica, permissões ou funções de servidor.

## Fora do escopo

- Alterar regras de permissão, auditoria ou qualquer função de backend de acessos.
