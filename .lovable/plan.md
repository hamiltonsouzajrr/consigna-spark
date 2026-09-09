# Ficha do lead: órgão, cargo e matrícula em destaque

## O que a consultora vê hoje

No topo da ficha: nome, status, situação, telefones (Ligar / WhatsApp / Copiar), município, margem informada e perfil (idade e sexo quando existirem).

Escondido em "Ver mais detalhes": CPF, origem, respondeu WhatsApp, lote de importação, cadastrado em, 1ª resposta, último contato, próximo follow-up, motivo da perda e os campos extras da planilha (órgão, matrícula, cargo, lotação, vínculo, nascimento, categoria, banco).

Ao lado: roteiro de abordagem, registro de contato, agendamento de follow-up e linha do tempo.

## Mudança aprovada

Trazer para o topo, junto de telefone, município e margem, três informações que hoje só aparecem ao expandir:

- Órgão / lotação
- Cargo
- Matrícula

Regras:

- Quando o dado não veio na planilha, o campo mostra "Não veio na planilha", igual aos demais destaques.
- Os mesmos campos deixam de repetir dentro de "Ver mais detalhes"; o restante continua lá como está.
- Layout responsivo: no celular os cartões ficam em duas colunas, como hoje.

## Detalhes técnicos

- Arquivo: `src/routes/_authenticated/prospeccao.$leadId.tsx`.
- Os valores vêm de `raw_data` do lead (chaves variam: `orgao`/`órgão`, `cargo`, `lotacao`/`lotação`, `matricula`/`matrícula`). Criar um leitor tolerante a acento, maiúsculas e espaços para pegar cada um.
- Reaproveitar `extrasPlanilha`, excluindo dela as chaves já promovidas ao topo para não duplicar.
- Somente apresentação: nada de banco, importação, pontuação da competição ou outras telas.
