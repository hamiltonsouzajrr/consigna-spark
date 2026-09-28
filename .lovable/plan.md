# Categorizar planilhas já importadas (PM Ativos / PM Inativos / Aposentados e Pensionistas - AL)

## O que existe hoje (verificado na base)

- 37.435 leads importados de planilhas.
- Apenas 832 têm dados extras salvos (órgão, cargo, matrícula) — são os vindos do Diário Oficial.
- **Nenhum lead tem categoria** (PM ativo/inativo, aposentado/pensionista) e praticamente nenhum tem idade ou data de nascimento (menos de 90 mencionam algo).
- Conclusão: as planilhas antigas foram importadas sem guardar categoria e idade, então **não é possível categorizar retroativamente com o que está salvo**.

## Caminhos possíveis

### Opção A — Reimportar as planilhas com categoria (recomendada)
1. Na tela de importação de leads, adicionar mapeamento de colunas novas: **Categoria** (PM Ativo / PM Inativo / Aposentado / Pensionista) e **Data de nascimento ou Idade**.
2. Se a planilha não tiver a coluna de categoria, o admin escolhe a categoria do lote inteiro no upload (ex.: "esta planilha é toda de PM Ativos").
3. Reimportar as planilhas antigas: o sistema reconhece CPF já existente e **atualiza** categoria/idade em vez de duplicar.
4. Criar colunas `categoria` e `data_nascimento` em `prospect_leads` (hoje não existem), com índice para filtro.

### Opção B — Categorizar o que dá pelo Órgão (parcial, só 832 leads)
- Leads do Diário Oficial com Órgão "Polícia Militar" / "Corpo de Bombeiros" podem ser marcados como PM, mas **não dá para saber se são ativos ou inativos** pelo dado salvo. Cobriria só ~2% da base.

### Opção C — Enriquecer pela RockData
- Para leads com CPF, consultar a RockData para obter idade/categoria. Lento para 37 mil leads e depende do servidor externo; viável sob demanda (ao abrir a ficha), não em massa.

## Escopo proposto (Opção A + filtro para consultoras)

1. **Banco:** colunas `categoria` (texto) e `data_nascimento` (data) em `prospect_leads`, com índices; migração com GRANTs/RLS conforme padrão.
2. **Importação (admin):** mapear colunas de categoria/nascimento da planilha + seletor de categoria padrão para o lote; reimportação atualiza leads existentes pelo CPF sem duplicar.
3. **CRM da consultora:** filtro por categoria (PM Ativos / PM Inativos / Aposentados e Pensionistas) e faixa de idade (ex.: 30–45, 46–60, 60+), aplicado aos leads da própria consultora.
4. **Distribuição (admin):** ao distribuir leads, poder filtrar o lote por categoria/faixa de idade antes de repartir igualitariamente.

## Fora de escopo
- Enriquecimento em massa via RockData (fica para depois, sob demanda).
- Alterar pontuação, fórmulas ou confirmação de vendas.

## Detalhes técnicos
- Migração: `ALTER TABLE prospect_leads ADD COLUMN categoria text, ADD COLUMN data_nascimento date;` + índices `(categoria)` e `(data_nascimento)`.
- Importação: estender `leads-admin.functions.ts` (`findField` com sinônimos: categoria/vínculo/situação; nascimento/idade) e upsert por CPF normalizado.
- Idade calculada em tempo de consulta a partir de `data_nascimento`; quando a planilha só trouxer idade, salvar nascimento aproximado (ano atual - idade).
- Filtros no CRM: chips de categoria + seletor de faixa etária na listagem de leads da consultora.
