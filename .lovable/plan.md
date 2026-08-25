# Aviso de atualização do sistema no login

## Ideia reformulada

Em vez de um pop-up genérico de "o sistema passou por melhorias", o aviso passa a ser um **guia de primeiro acesso** que resolve o problema real: contas antigas foram zeradas, então cada consultora precisa recriar a conta com **nome completo, CPF e um e-mail que ela realmente acessa** — porque o link de recuperação de senha só chega nesse e-mail.

Melhorias sobre a ideia original:

1. **Aparece uma vez por navegador**, não em todo carregamento (registro em `localStorage` com versão do aviso, para poder reexibir se houver nova mudança).
2. **Dois caminhos claros dentro do modal**: "Nunca criei conta nova" leva direto para a aba *Criar conta*; "Já tenho conta" fecha o modal na aba *Entrar*.
3. **Checklist visual em vez de texto corrido** — 3 itens curtos com ícones: nome completo igual ao do RH, CPF (uma conta por CPF), e-mail pessoal válido e ativo.
4. **Alerta de e-mail destacado**: "sem o e-mail correto não é possível recuperar a senha" ganha bloco próprio de atenção, que é a informação mais crítica.
5. **Aviso permanente discreto** no rodapé do card de login (uma linha com link "Ver instruções de primeiro acesso") para quem já fechou o modal poder reabrir a qualquer momento.
6. **Reforço em contexto**: dica curta abaixo do campo de e-mail na aba *Criar conta* ("use um e-mail que você acessa — é para lá que vai o link de recuperação").

## Conteúdo do modal

- Título: "Sistema atualizado — crie sua nova conta"
- Texto de abertura: os acessos anteriores foram redefinidos nesta atualização; o cadastro é rápido e feito uma única vez.
- Checklist: nome completo · CPF (único por pessoa) · e-mail válido.
- Bloco de atenção sobre recuperação por e-mail (e que também é possível recuperar informando o CPF, mas o link sempre vai para o e-mail cadastrado).
- Botões: "Criar minha conta" (primário) e "Já tenho conta / Entrar".

## Detalhes técnicos

- Novo componente `src/components/auth/PrimeiroAcessoDialog.tsx` usando `Dialog` do shadcn já existente, com props `open`, `onOpenChange` e `onCriarConta`.
- `src/routes/login.tsx`:
  - controlar `Tabs` por estado (`value`/`onValueChange`) em vez de `defaultValue`, para o modal poder mudar para a aba `up`.
  - abrir o modal em `useEffect` no cliente quando `localStorage` não tiver a chave `positive:aviso-primeiro-acesso:v1` (evita mismatch de hidratação: estado inicial `false`).
  - adicionar link "Ver instruções de primeiro acesso" no rodapé do card e a dica sob o campo de e-mail da aba de cadastro.
- Sem mudanças de backend, banco ou fluxo de autenticação.
