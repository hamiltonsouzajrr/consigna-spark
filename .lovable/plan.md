# Conferência e limpeza das informações dos leads

O que a tela mostra hoje está sendo lido da planilha, mas há três problemas reais confirmados no banco.

## O que encontrei

1. **"Telefone 2" com valores que não são telefone** (como o "146" da sua tela).
   São 44.767 números guardados com 0 a 5 dígitos — vieram de colunas da planilha que só *pareciam* de telefone (aparecem valores como "S", "0", "41", "280"). O telefone principal está correto.
2. **Cliente repetido**: 11.310 leads têm o mesmo CPF em mais de um lote (5.474 CPFs). O Anndrey da sua tela existe duas vezes: numa cópia a margem é R$ 218,27 e na outra não há margem nem município preenchidos. Quem abre um dos dois vê informação incompleta.
3. **Campos vazios em lotes antigos**: 19.522 sem município, 42.430 sem idade e sexo, 31.776 sem margem, e nenhum lead antigo guardou a linha original da planilha (isso só passou a ser salvo nas importações novas). O município não existia nos lotes "GOV AL - INATIVOS" e da Aline; a margem só vem das planilhas de agosto.

## O que vou fazer

**Corrigir a importação**
- Só aceitar como telefone números brasileiros válidos (10 ou 11 dígitos, com DDD); descartar restos como "146", "S" e "0".
- Deixar de varrer colunas parecidas ("contato", "número") quando o valor não é telefone.

**Limpar o que já está no banco**
- Remover de todos os leads os telefones inválidos, mantendo os válidos e o principal.
- Juntar os cadastros repetidos por CPF: fica um único lead, completando os campos vazios com o que existir na outra cópia (município, margem, situação, telefones) e preservando o histórico de contatos, tarefas e pontos já lançados. Nada de pontuação é alterado.

**Ajustar a tela do lead**
- Esconder o bloco "Telefone 2" quando não houver segundo número válido.
- Mostrar, quando existirem: matrícula, órgão/lotação, cargo, situação funcional, data de nascimento e a lista completa de telefones válidos, além do lote/planilha de origem e a data da importação.
- Deixar claro quando um campo simplesmente não veio na planilha, em vez de mostrar "—" sem explicação.

## Não entra neste trabalho

- Regras da competição, pontos e metas.
- Telas de Tomadores AL e Radar.
- Reimportação das planilhas antigas: município, idade e sexo que nunca vieram no arquivo só aparecem se você reimportar os arquivos originais (a opção "Atualizar leads existentes" preenche o que falta sem duplicar).

## Detalhes técnicos

- `src/lib/prospeccao/admin-import.ts`: validar cada candidato a telefone com `normalizeWhatsappNumber` antes de entrar em `phoneVals`; remover o varredor por regex genérica de colunas.
- Migração SQL: `update prospect_leads` filtrando `telefones` por dígitos válidos; merge dos CPFs duplicados via CTE que elege o registro mais completo, faz `coalesce` dos campos, repõe `lead_id` em `lead_events`/`lead_tasks`/`prospect_pontos` e apaga as sobras.
- `src/routes/_authenticated/prospeccao.$leadId.tsx`: renderização condicional dos telefones e novos campos vindos de `raw_data`/colunas dedicadas.
- Verificação após aplicar: contagens de telefones curtos e de CPFs duplicados devem voltar zero.
