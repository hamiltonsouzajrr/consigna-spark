# Ficha RockData em visão única

## O que será melhorado

- Reorganizar a ficha para mostrar, no mesmo painel, os dados principais do cliente, os telefones ordenados por confiança e os endereços completos.
- Exibir cada endereço com logradouro, número, complemento, bairro, cidade, estado e CEP, conforme as colunas realmente retornadas pela RockData.
- Trocar a nota técnica de 0 a 100 por uma avaliação visual de até 5 estrelas, calculada com os mesmos sinais de confiança já usados: qualificação da RockData, celular, WhatsApp, restrições e histórico de contato no sistema.
- Manter os selos “Mais confiável”, “Bom”, “Duvidoso” e “Inválido”, as ações de ligar, WhatsApp e copiar, e a ordem do contato mais confiável para o menos confiável.
- Garantir compatibilidade com fichas antigas já salvas, mesmo quando o endereço vier apenas como texto e o telefone ainda não tiver detalhes completos.

## Detalhes técnicos

- Ampliar o resultado normalizado da RockData com uma lista estruturada de endereços, sem remover o formato antigo usado pelo cache.
- Identificar as colunas de endereço por rótulos equivalentes e montar uma linha legível sem duplicar dados.
- Derivar as estrelas da pontuação final de confiança, limitadas entre 0 e 5, e apresentar estrelas cheias/parciais/vazias com texto acessível.
- Ajustar a ficha para uma composição única e responsiva, sem alterar regras de cache, auditoria ou pontuação da campanha.

## Validação

- Conferir fichas novas e antigas, com um ou vários endereços e telefones.
- Verificar a ordem dos telefones, o limite de cinco estrelas e os botões de contato.
- Revisar a tela em computador e celular e checar tipos do projeto.
