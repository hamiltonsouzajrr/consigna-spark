# Pesquisar Cliente — busca também por telefone

## O que você vai ver

Na tela **Pesquisar Cliente** (`/consulta-servidor`), o mesmo campo de busca passa a aceitar três formas de encontrar o cliente:

- **CPF** — com ou sem pontuação (11 dígitos) → abre a ficha direto.
- **Nome** — completo ou parcial (3+ letras) → lista de pessoas para escolher.
- **Telefone** — novo: digita o número com DDD (10 ou 11 dígitos, ex.: 82999998888) → lista as pessoas encontradas; ao tocar, abre a ficha completa.

O telefone segue as mesmas regras já em uso:

- **Reaproveitamento:** se o número já estiver em uma ficha salva no sistema, a resposta vem do nosso banco, sem nova consulta à RockData.
- **Modo offline:** se a RockData estiver fora do ar, a busca por telefone continua funcionando sobre as fichas já salvas, com o aviso de dados do sistema.
- **Histórico:** pesquisas por telefone aparecem em "Pesquisas recentes" como as demais.

## Como detectamos o tipo de busca

O sistema identifica sozinho, sem botões extras:

- Só números com 11 dígitos e CPF válido → CPF.
- Só números com 10–11 dígitos que não formam CPF válido (ou 8–9 dígitos com DDD informado) → telefone.
- Contém letras → nome.

Se um número puder ser ambos (CPF válido de 11 dígitos), prevalece CPF, como hoje.

## Detalhes técnicos

1. **Banco (migração em `rockdata_consultas`):**
   - Nova coluna `telefones text[]` com os números normalizados (só dígitos) de cada ficha.
   - Preenchimento retroativo a partir do `resultado` JSON já salvo.
   - Índice GIN para busca rápida por telefone na base interna.
2. **Servidor (`rockdata.server.ts`):**
   - Nova função `consultarPorTelefone(ddd+numero)` usando o endpoint `ConsultaMaisOpcoes_View` com o campo `telefone` preenchido e nome vazio (o formulário da RockData já tem esse campo).
   - **Primeiro passo da execução: validar com uma consulta real** que a RockData aceita busca só por telefone e confirmar o formato do retorno (a homologação anterior confirmou CPF e nome; telefone ainda não foi exercitado). Se o portal exigir outro endpoint/parâmetro, ajustar conforme a resposta real.
   - Ao salvar/atualizar uma ficha, gravar também `telefones` normalizados.
3. **Função (`rockdata.functions.ts`):**
   - `consultarServidor` passa a detectar telefone: primeiro procura na base interna (`telefones @> [numero]`), depois chama a RockData; com falha na RockData, cai na base interna com aviso.
   - Auditoria (`rockdata_consultas_log`) registra o novo tipo `telefone`.
4. **Tela (`consulta-servidor.tsx`):**
   - Texto de ajuda atualizado: "Digite o CPF, o nome ou o telefone com DDD".
   - Lista de resultados por telefone igual à de nome; ficha e histórico inalterados.
5. **Validação:** typecheck + teste real das três buscas (CPF, nome, telefone) no portal.

## Fora do escopo

- Não muda a regra de 90 dias nem o botão "Atualizar dados".
- Não altera layout da ficha, nem outras telas/menus.
- Busca por telefone sem DDD não é confiável na RockData — o sistema pedirá o DDD quando faltar.
