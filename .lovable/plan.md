# Nova senha temporária para o admin

Você entra novamente como **admin@hotmail.com** com uma senha temporária definida por mim, sem depender do e-mail de recuperação.

## Passos

1. Definir uma senha temporária forte para a conta admin diretamente no backend (operação administrativa pontual).
2. Informar a senha temporária a você aqui no chat.
3. Adicionar uma tela simples de **Alterar senha**, acessível pelo menu do usuário, para você definir sua senha definitiva após entrar.
4. Exibir um aviso no topo do sistema enquanto a senha ainda for a temporária, com atalho para a troca.

## Detalhes técnicos

- A definição da senha usa a Auth Admin API pelo cliente de serviço, executada como operação única — nenhuma rota pública nova.
- A tela de troca usa `supabase.auth.updateUser({ password })` no cliente, dentro do layout `_authenticated`.
- Marcação de senha temporária em `public.profiles` (coluna booleana `senha_temporaria`), com RLS restrita ao próprio usuário e limpeza automática após a troca.

## Segurança

A senha aparecerá uma única vez no chat. Troque-a imediatamente no primeiro login.
