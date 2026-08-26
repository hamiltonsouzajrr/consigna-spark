# Recuperação de senha: link gerado pelo administrador

## Diagnóstico

Verifiquei os dados de autenticação do sistema: **nenhuma conta tem registro de envio de e-mail de recuperação** (o campo de "último envio de recuperação" está vazio para todos os 25 usuários). Ou seja, os pedidos de "Esqueci minha senha" não estão gerando envio.

Duas causas concretas:

1. **O projeto não tem remetente de e-mail configurado.** Sem um domínio próprio, os e-mails de autenticação dependem do remetente padrão, com limite de envio muito baixo por hora — na prática, as consultoras não recebem. Como não há domínio agora, o e-mail não é um caminho confiável.
2. **As falhas ficam invisíveis.** No fluxo por CPF, o resultado do envio não é verificado: mesmo quando o envio falha, a tela mostra "Email enviado!". Isso explica por que ninguém percebeu o problema antes.

Além disso, encontrei **3 perfis cujo e-mail cadastrado não corresponde a nenhuma conta de acesso** — mesmo com e-mail funcionando, essas consultoras nunca receberiam o link.

## O que será feito

### 1. Link de redefinição gerado pelo administrador (solução principal)
No painel de RH → Acessos, cada usuário ganha a ação **"Gerar link de redefinição de senha"**:
- O administrador clica, o sistema gera um link válido de redefinição e mostra em uma caixa com botão **Copiar** (e um botão de enviar por WhatsApp quando houver telefone).
- A consultora abre o link, cai direto na tela de nova senha e define a senha.
- Não depende de e-mail nenhum.
- Toda geração fica registrada no log de auditoria de acessos (quem gerou, para quem, quando).

### 2. Mensagens honestas no login
- No fluxo por CPF e por e-mail, o erro real passa a ser verificado e exibido: se o envio falhar ou o limite for atingido, a tela diz claramente "Não foi possível enviar o e-mail — fale com o administrador para receber seu link de acesso" em vez de "Email enviado!".
- Texto de apoio na tela de recuperação orientando a pedir o link ao administrador.

### 3. Correção dos vínculos inconsistentes
Ajuste dos 3 perfis com e-mail divergente, alinhando o e-mail do perfil ao e-mail real da conta de acesso.

## Detalhes técnicos

- Nova server function `gerarLinkRedefinicao` em `src/lib/rh/access.functions.ts` (ou arquivo dedicado `src/lib/auth/reset-admin.functions.ts`), com `requireSupabaseAuth` + verificação de `has_role(admin)` antes de qualquer operação privilegiada; usa `supabaseAdmin.auth.admin.generateLink({ type: 'recovery', email, options: { redirectTo: origin + '/reset-password' } })` importado dentro do handler.
- Retorna apenas `{ actionLink, expiraEm }`; nunca lista e-mails de outros usuários para não-admin.
- Grava linha em `public.rh_access_audit` com a ação `reset_link_gerado`.
- UI: novo item no menu de ações de usuário em `src/components/prospeccao/admin/AcessosTab.tsx` / `src/routes/_authenticated/rh.acessos.tsx`, com diálogo mostrando o link, botão copiar (`navigator.clipboard`) e aviso de validade.
- `src/lib/auth/account.functions.ts`: `sendResetByCpf` passa a checar o `error` de `resetPasswordForEmail` e retornar `{ found, emailMasked, enviado, motivo }`.
- `src/routes/login.tsx`: trata `enviado === false` com toast de erro e orientação.
- Migração/ajuste de dados: correção dos e-mails divergentes em `public.profiles`.

Se no futuro vocês tiverem um domínio próprio, ativamos o remetente e o e-mail volta a ser o caminho padrão sem mexer nesse fluxo.
