# Nova senha para a conta de administrador

Objetivo: você voltar a entrar como **admin@hotmail.com** sem depender do e-mail de recuperação (que hoje é limitado pelo remetente padrão).

## O que será feito

1. Definir uma **senha temporária** para a conta admin diretamente no backend (operação administrativa única, feita por mim ao executar o plano).
2. Eu te informo a senha temporária aqui no chat.
3. Ao entrar, o sistema pedirá que você **troque a senha** na primeira vez: será adicionada uma tela simples de "Alterar senha" acessível pelo menu do usuário, e um aviso no login quando a senha ainda for a temporária.
4. Alternativa incluída: em **RH → Acessos** já existe geração de link de redefinição; será mantida como caminho de recuperação para consultoras.

## Detalhes técnicos

- A troca de senha do admin usa a Auth Admin API pelo cliente de serviço, dentro de uma operação pontual (não fica exposta como rota).
- A nova tela de alteração de senha usa `supabase.auth.updateUser({ password })` no cliente, protegida pelo layout `_authenticated`.
- Marcação de "senha temporária" fica em `public.profiles` (coluna booleana `senha_temporaria`), com RLS restrita ao próprio usuário; é limpa após a troca.

## Observação de segurança

A senha temporária aparecerá uma única vez no chat. Troque-a imediatamente após o primeiro login.
