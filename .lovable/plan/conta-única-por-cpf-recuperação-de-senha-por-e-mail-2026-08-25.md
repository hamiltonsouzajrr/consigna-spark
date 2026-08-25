# Conta única por CPF + recuperação de senha por e-mail

## Objetivo

Cada consultora terá **um CPF vinculado à conta**, com garantia de **uma única conta por CPF**. O login continua por e-mail e senha, e a recuperação de senha continua sendo feita pelo e-mail cadastrado (fluxo que já existe hoje em `/login` → "Esqueci minha senha" → `/reset-password`).

## Como vai funcionar

### Cadastro
1. O formulário de cadastro passa a pedir: **nome completo, CPF, e-mail e senha**.
2. O CPF é validado no navegador (dígitos verificadores) antes do envio.
3. No servidor, antes de criar a conta:
   - CPF é normalizado (só dígitos) e validado novamente;
   - se o CPF já existir, o cadastro é recusado com a mensagem "Já existe uma conta cadastrada para este CPF. Use 'Esqueci minha senha' para recuperar o acesso.";
   - se o e-mail já existir, mensagem equivalente.
4. Só então a conta é criada e o perfil (nome + CPF + e-mail) é gravado.

### Recuperação de senha
- Continua por e-mail: o usuário informa o e-mail e recebe o link de redefinição.
- Adicionalmente, na tela de recuperação será possível informar **CPF ou e-mail**: se informar o CPF, o sistema localiza o e-mail vinculado e envia o link para ele, mostrando apenas uma versão mascarada (ex.: `ma••••@gmail.com`) — sem revelar o e-mail completo, para não permitir descobrir dados de terceiros.

### Vínculo com a consultora
- O perfil guarda também o CPF, permitindo casar a conta com o cadastro de consultora que hoje é vinculado apenas por e-mail. Se o e-mail da consultora mudar, o vínculo por CPF continua válido.

## Detalhes técnicos

**Banco (migração)**
- Nova tabela `public.profiles`: `user_id` (referência ao usuário autenticado, único), `nome_completo`, `cpf` (11 dígitos, **UNIQUE**), `email`, timestamps + trigger de `updated_at`.
- Restrição `CHECK (cpf ~ '^[0-9]{11}$')` e índice único em `cpf`.
- GRANTs: `SELECT, UPDATE` para `authenticated`, `ALL` para `service_role`; sem acesso `anon`.
- RLS: cada usuário lê/edita apenas o próprio perfil (`auth.uid() = user_id`); administradores leem todos via `has_role`. A criação do perfil é feita pelo servidor (service role), não pelo cliente.
- Coluna opcional `cpf` em `radar_consultoras` para reforçar o vínculo consultora ↔ conta.

**Server functions (`src/lib/auth/account.functions.ts`)**
- `signUpWithCpf` (pública, `POST`): valida nome/CPF/e-mail/senha com Zod, verifica CPF e e-mail já usados, cria o usuário via API administrativa e insere o perfil na mesma operação. Se a criação do perfil falhar, o usuário criado é removido (evita conta órfã sem CPF).
- `resolveResetEmailByCpf` (pública, `POST`): recebe CPF, retorna apenas `{ found: boolean, emailMasked }`. O envio do e-mail de redefinição continua sendo disparado pelo cliente com `resetPasswordForEmail`, usando o e-mail retornado apenas quando encontrado. Nunca retorna o e-mail completo.
- Ambas com validação rígida de entrada e mensagens genéricas para não permitir enumeração de contas além do necessário.

**Front-end**
- `src/lib/auth.tsx`: `signUp` passa a receber `{ nome, cpf, email, password }` e chamar a server function; após sucesso, faz `signInWithPassword` (ou pede confirmação de e-mail, conforme a configuração atual do projeto).
- `src/routes/login.tsx`: campos de nome e CPF (com máscara `000.000.000-00`) no modo cadastro; no modo recuperação, aceitar CPF ou e-mail.
- Reaproveita `normalizeCpf` / `isValidCpf` / `formatCpf` de `src/lib/cpf.ts` no cliente e no servidor.

**Contas já existentes**
- Usuários criados antes da mudança não têm perfil. Na primeira entrada, quem estiver sem CPF cadastrado vê um passo único "Complete seu cadastro" pedindo nome e CPF, gravado com a mesma validação de unicidade.
