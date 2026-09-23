# Consulta de servidor na RockData

Nova opção no menu lateral, "Consulta de servidor", onde a consultora busca a pessoa por CPF ou por nome e recebe telefones, endereços e os demais dados que a RockData mostra. A consulta na RockData é feita uma única vez por pessoa: depois disso o sistema responde com os dados já guardados no nosso banco.

## Como vai funcionar

- Campo único de busca: a consultora digita o CPF (com ou sem pontuação/zeros à frente) ou o nome do cliente.
- O sistema primeiro procura no nosso banco. Se já existe consulta daquele CPF com menos de 90 dias, mostra na hora e avisa "dados já consultados em dd/mm/aaaa".
- Se não existe, ou se passou de 90 dias, o sistema entra na RockData com o nosso acesso, faz a consulta e guarda o resultado.
- Resultado organizado em blocos: dados da pessoa (nome, CPF, nascimento, mãe, situação), telefones (com botão de ligar/WhatsApp e copiar), endereços, e-mails e demais informações que vierem.
- Botão "Atualizar dados" para quem precisar de uma consulta nova antes dos 90 dias.
- Histórico das próprias consultas na mesma tela, com data e termo pesquisado.
- Busca por nome devolve a lista de pessoas encontradas; a consultora escolhe uma e aí o sistema abre a ficha completa.
- Toda consulta fica registrada com quem consultou e quando (auditoria).

## Onde fica

Nova opção "Consulta de servidor" no grupo de prospecção do menu lateral, disponível para consultoras e administradores, em `/consulta-servidor`. A antiga tela de Pesquisas (Nova Vida) sai do menu e deixa de ser a porta de entrada das consultas.

## Ponto importante sobre a RockData

A RockData não oferece integração pronta (API): o endereço informado é um site com login (ASP.NET/IIS, redireciona para `/Conta/Login`). Então o sistema vai reproduzir, pelo servidor, exatamente os passos que uma pessoa faria no site: entrar com usuário/senha/cliente, enviar a busca e ler a resposta. Isso funciona, mas depende do site continuar igual — se a RockData mudar a tela ou o login, a consulta para e precisa de ajuste. Vale pedir a eles a documentação de API; com ela a integração fica definitiva. Também é preciso confirmar com a RockData que o uso automatizado do acesso é permitido.

## Detalhes técnicos

- Credenciais salvas como secrets (`ROCKDATA_USUARIO`, `ROCKDATA_SENHA`, `ROCKDATA_CLIENTE`) via `add_secret`; nunca no código. Login com `POST /Conta/Login` levando o `__RequestVerificationToken` lido do GET da página e guardando os cookies de sessão em memória por chamada (com reuso simples durante o mesmo request).
- `src/lib/consultas/rockdata.server.ts`: helpers server-only — `login()`, `consultarPorCpf()`, `consultarPorNome()` e parsers do HTML de resposta (usando parsing por regex/DOM leve compatível com o runtime Worker; sem dependências Node-only). Mapeia o HTML para um DTO estável `{ pessoa, telefones[], enderecos[], emails[], extras }`, guardando também o HTML/JSON bruto em `resultado_json` para não perder nada.
- `src/lib/consultas/rockdata.functions.ts`: `consultarRockdata` com `createServerFn({ method: "POST" })` + `.middleware([requireSupabaseAuth])`, `inputValidator` Zod (`termo` 3–120, `tipo` cpf|nome, `forcarAtualizacao` boolean). Fluxo: normaliza CPF → busca cache → se válido (`consultado_em > now() - 90 days`) retorna do banco com `origem: "cache"` → senão chama a RockData, faz upsert e retorna `origem: "rockdata"`. Falhas de login/indisponibilidade voltam com mensagem em português ("Não foi possível consultar na RockData agora"), sem vazar detalhes técnicos. `listarMinhasConsultasRockdata` para o histórico.
- Migração: tabela `rockdata_consultas` (`id`, `cpf` text unique, `nome`, `resultado jsonb`, `consultado_em timestamptz default now()`, `consultado_por uuid`, `created_at`, `updated_at` + trigger `set_updated_at`), índices em `cpf` e trigram em `nome`; e `rockdata_consultas_log` (`id`, `user_id`, `termo`, `tipo`, `origem`, `created_at`) para auditoria por consultora. GRANTs para `authenticated` (SELECT) e `service_role` (ALL); RLS: consultora lê o cache e o próprio log, admin lê tudo; gravação somente pelo servidor (service role).
- `src/routes/_authenticated/consulta-servidor.tsx`: rota com `head()` próprio (`noindex`), busca via `useServerFn` + `useQuery`, cards de resultado com Card/Badge/Table e tokens do tema, botão "Atualizar dados", histórico e estados de carregando/erro/vazio. Reaproveita `formatCpf`/`normalizeCpf` de `src/lib/cpf.ts`.
- `src/components/AppShell.tsx`: nova entrada "Consulta de servidor" (ícone `UserSearch`) no grupo de prospecção; remoção da entrada da Nova Vida do menu.
- Validação: consulta por CPF novo (vai à RockData), a mesma consulta de novo (deve vir do banco, sem nova chamada), consulta por nome, botão de atualizar, tela em computador e celular, e checagem de tipos.

## Fora do escopo

- Apagar a tela e o histórico atuais da Nova Vida (apenas sai do menu).
- Consulta em lote / importação de listas.
- Alterar regras de pontuação, distribuição ou margens.
