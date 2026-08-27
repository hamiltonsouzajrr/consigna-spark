# CRM POSITIVE

Crie um sistema web administrativo completo para consulta em lote de margens consignáveis.

OBJETIVO:

Permitir upload de planilha com CPFs e nomes, processar consultas externamente e retornar margens disponíveis.

STACK:

- Frontend moderno e responsivo

- Backend integrado com Supabase (auth, database, storage)

- Preparado para integração com API externa (Edge Function)

FUNCIONALIDADES:

1. AUTENTICAÇÃO

- Login e logout de usuários

- Proteção de rotas

- Apenas usuários autenticados acessam o sistema

2. UPLOAD DE PLANILHA

- Aceitar arquivos CSV e XLSX

- Validar estrutura obrigatória: CPF e NOME

- Mostrar preview dos dados antes de enviar

- Botão de confirmação de importação

3. BANCO DE DADOS (SUPABASE)

Criar tabela "consultas_margem" com:

- id (uuid)

- cpf (text)

- nome (text)

- margem_disponivel (numeric, nullable)

- status (pendente, processando, concluido, erro)

- erro (text, nullable)

- created_at (timestamp)

- updated_at (timestamp)

4. DASHBOARD

- Total de registros

- Quantidade pendente

- Quantidade processada

- Quantidade com erro

- Tempo médio de processamento

5. LISTAGEM

- Tabela com:

  CPF | Nome | Status | Margem | Erro

- Filtros por status

- Busca por CPF ou nome

- Paginação

6. EXPORTAÇÃO

- Botão para exportar CSV com resultados

- Apenas registros concluídos ou todos

7. PROCESSAMENTO

- Criar botão "Iniciar processamento"

- Esse botão chama uma Supabase Edge Function chamada:

  processar-margens

- Enviar lista de CPFs pendentes

8. STATUS EM TEMPO REAL

- Atualizar status automaticamente (polling ou realtime)

- Mostrar loading durante processamento

9. SEGURANÇA

- NÃO expor credenciais no frontend

- Toda integração externa deve passar por backend (Edge Function)

10. UX/UI

- Interface limpa estilo dashboard SaaS

- Feedback visual (loading, sucesso, erro)

- Responsivo (desktop e mobile)

11. PREPARAÇÃO PARA AUTOMAÇÃO EXTERNA

- O sistema NÃO deve fazer scraping direto

- Deve apenas enviar CPFs para uma função backend

- Backend será responsável por consultar sistema externo (ConsigUp)

12. LOGS

- Registrar erros de consulta

- Mostrar motivo no campo "erro"

EXTRA:

- Permitir reprocessar registros com erro

- Botão "Reprocessar selecionados"

IMPORTANTE:

- Estruturar código limpo e escalável

- Separar frontend e lógica de dados

- Preparar integração futura com automação externa

link do consigup: https://sistema.consigup.com.br/Login.aspx
login: 103.785.504-38
senha: Enrico19.

This project was built with [Lovable](https://lovable.dev).

**Live app**: https://consigna-spark.lovable.app

## Build with Lovable

Continue developing this project in the [Lovable editor](https://lovable.dev/projects/aa48af76-c098-4108-b1e8-d6a751c0edfe).

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: every change made in Lovable is committed straight to this repository.
- **Full ownership**: this code is yours. Push to `main` on GitHub and your changes sync back into Lovable, ready for your next prompt.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```
