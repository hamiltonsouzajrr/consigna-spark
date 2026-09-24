# Pesquisar Cliente: banco interno com comparação RockData

## Como ficará a busca

- Manter a opção lateral **Pesquisar Cliente**, mas tornar o banco do sistema a fonte principal.
- Um único campo aceitará CPF, nome completo, primeiro nome ou telefone.
- A busca reunirá resultados das planilhas importadas no CRM, Tomadores AL e registros recentes, sem consultar a RockData automaticamente.
- Cada resultado mostrará a origem da planilha, nome, CPF, telefones, cidade/endereço disponível, responsável e margens encontradas.
- Ao selecionar uma pessoa, abrir uma ficha única com os principais dados consolidados e indicação clara da origem de cada informação.

## Margens e valores aproximados

- Exibir separadamente empréstimo, cartão de crédito e cartão benefício, sem confundir renda com margem.
- Para cada margem disponível, calcular o valor aproximado liberado usando os mesmos coeficientes e prazos da calculadora já existente.
- Mostrar o prazo usado no cálculo e identificar os valores como estimativas.
- Quando a planilha não trouxer uma margem, exibir “Não informada na planilha”, sem inventar valores.

## Comparação RockData

- Dentro da ficha interna, adicionar uma área compacta **Busca Plus — comparar com RockData**, inicialmente recolhida.
- A RockData só será consultada quando a consultora clicar para comparar, evitando cobrança e espera desnecessárias.
- Se já houver uma consulta RockData válida no banco, usar os dados salvos; após 90 dias, permitir atualização conforme a regra atual.
- Exibir lado a lado os dados internos e os dados da RockData, destacando telefones e endereços complementares ou divergentes, sem substituir as informações originais das planilhas.
- Manter telefone, WhatsApp, copiar, atualização manual e auditoria já existentes.

## Ficha RockData em visão única

- Organizar dados pessoais, telefones priorizados e endereços no mesmo painel.
- Estruturar endereço com logradouro, número, complemento, bairro, cidade, estado e CEP quando essas colunas vierem da RockData; fichas antigas continuam exibindo o texto salvo.
- Mostrar a confiança de cada telefone em uma escala visual de até cinco estrelas, derivada da nota atual, junto dos selos “Mais confiável”, “Bom”, “Duvidoso” e “Inválido”.
- Preservar a ordenação do telefone mais confiável para o menos confiável e todos os sinais usados hoje.

## Detalhes técnicos

- Ampliar a busca interna autenticada para aceitar telefone e devolver os campos necessários do CRM, Tomadores e registros recentes, incluindo dados úteis existentes em `raw_data`.
- Normalizar CPF e telefone para localizar gravações com formatos diferentes e eliminar duplicidades da mesma pessoa na apresentação.
- Reutilizar `valorLiberado`, os prazos padrão e a tabela de coeficientes da calculadora; nenhuma fórmula financeira será duplicada ou alterada.
- Separar a ação de comparação RockData da busca interna, reaproveitando o cache, fallback offline e histórico atuais.
- Ampliar o resultado normalizado da RockData com endereços estruturados sem remover o formato antigo.
- Ajustar a tela para computador e celular com resultados internos primeiro e comparação externa recolhida.

## Validação

- Testar CPF com e sem pontuação, nome completo, primeiro nome e telefone.
- Conferir resultados vindos de cada tipo de planilha e a distinção entre renda e margem.
- Comparar manualmente os valores aproximados com a calculadora nos prazos apresentados.
- Confirmar que abrir a ficha não consulta a RockData e que somente o botão Busca Plus inicia a comparação.
- Validar cache dentro de 90 dias, atualização, ranking limitado a cinco estrelas, endereços completos e fichas antigas.
- Revisar em computador e celular e executar a checagem de tipos.

## Fora do escopo

- Alterar coeficientes, fórmulas financeiras, regras de distribuição, pontuação ou dados originais das planilhas.
