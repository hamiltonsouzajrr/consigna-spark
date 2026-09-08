# Conferência dos leads importados das planilhas

Comparei o que as planilhas trazem com o que está gravado nos 42.440 leads. Parte das informações está errada ou simplesmente não foi aproveitada.

## O que encontrei

1. **Valor de margem/orçamento multiplicado por 100 (ou mais).** A leitura da planilha apaga o ponto achando que é separador de milhar. Resultado: 30.756 leads com valor acima de R$ 100.000 e o maior deles em R$ 2.900.130.000. Isso também infla a nota (score) do lead, porque valor alto dá pontos extras — quase todos ganham esse bônus indevidamente.
2. **Cidade em branco em 19.522 leads.** Só é lida uma coluna chamada exatamente "cidade"; planilhas com "município", "lotação" ou "órgão" ficam sem nada.
3. **Idade e sexo praticamente nunca chegam.** Existem esses campos e até filtros por faixa, mas apenas 10 leads em 42.440 têm o dado — a importação não lê essas colunas.
4. **CPF incompleto em 3.699 leads** (10, 9 ou 8 dígitos) porque a planilha perdeu os zeros da frente e a importação grava do jeito que veio.
5. **610 nomes com a matrícula colada no final** (ex.: "MARIA LUCIA VIEIRA DE BRITO 10193").
6. **Nada da planilha original é guardado.** As colunas extras (órgão, matrícula, cargo, tipo de margem, data de nascimento) são descartadas, então não há como conferir depois nem reimportar sem o arquivo.
7. **O valor de margem nem aparece na tela do lead** — está no banco, é usado na nota, mas a consultora não vê.

## O que propongo corrigir

**Leitura das planilhas**
- Interpretar os números do jeito certo: reconhecer se o ponto é decimal ou separador de milhar, e nunca inflar o valor.
- Reconhecer mais nomes de coluna: município/cidade/lotação para cidade; idade e data de nascimento (calculando a idade); sexo/gênero; órgão; matrícula; cargo.
- Completar CPF com zeros à frente até 11 dígitos e descartar o que não for CPF válido, em vez de gravar torto.
- Tirar a matrícula colada no fim do nome (guardando-a no campo de matrícula quando existir).
- Guardar a linha original da planilha junto do lead, para conferência futura.

**Dados já gravados (uma migração de correção)**
- Recalcular os valores de margem inflados nos lotes afetados, dividindo pelo fator errado aplicado, e recalcular a nota dos leads.
- Completar os CPFs com zeros à frente e marcar os que continuam inválidos.
- Limpar as matrículas coladas nos nomes.
- Idade, sexo e cidade que faltam só voltam com nova importação das planilhas — não há como inventar o dado. Posso preparar um botão de "reimportar planilha atualizando leads existentes" para isso.

**Tela do lead**
- Mostrar margem/orçamento, órgão, matrícula, idade e sexo quando existirem, para a consultora ver o mesmo que está na planilha.

## Detalhes técnicos

- `src/lib/prospeccao/admin-import.ts`: reescrever o parse numérico (`buildParsed`) com detecção pt-BR/en de decimal; ampliar `PHONE_ALIASES` com aliases de cidade/idade/sexo/órgão/matrícula/cargo; normalizar CPF (pad + dígito verificador, reaproveitando `src/lib/cpf.ts`); extrair matrícula do fim do nome; retornar `raw` por linha.
- `src/lib/prospeccao/prospeccao.utils.ts` (`leadInput`) e `prospeccao.functions.ts` (`importLeads`): aceitar e gravar `idade`, `sexo`, `situacao` (só se vier da planilha), `raw_data` e cidade normalizada.
- Migração de correção: `UPDATE prospect_leads SET orcamento = orcamento / 100` restrito aos lotes com padrão inflado (`import_batch` dos 5 lotes identificados, com `orcamento > 100000`), `UPDATE` de CPF com `lpad`, limpeza de sufixo numérico no nome; em seguida um `UPDATE` neutro para o gatilho `compute_prospect_lead` recalcular `score`.
- `src/routes/_authenticated/prospeccao.$leadId.tsx`: exibir margem formatada em BRL e os campos novos no cartão de dados.
- Reimportação com atualização: estender `importLeads` para casar por CPF e preencher campos vazios (já existe lógica parcial de merge nas linhas 81-100).

**Fora de escopo:** mexer em Tomadores AL / Radar, e alterar as regras de pontuação da competição.
