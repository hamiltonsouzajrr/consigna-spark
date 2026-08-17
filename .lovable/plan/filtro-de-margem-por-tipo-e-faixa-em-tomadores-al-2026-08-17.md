# Filtro de margem por tipo e faixa em Tomadores AL

Hoje a aba Tomadores tem apenas um filtro "margem mínima" que sempre olha a margem de empréstimo. A ideia é permitir que qualquer acesso (consultora, gestor ou admin) escolha **qual margem** quer ver e em **qual faixa de valor**.

## O que muda na tela

Na barra de filtros, ao lado de busca e órgão:

1. **Tipo de margem** (select):
   - Margem principal (empréstimo) — padrão
   - Cartão de crédito
   - Cartão benefício
   - Qualquer uma (atende se qualquer margem cair na faixa)

2. **Faixa de valor** (select):
   - Todas
   - Baixa
   - Média
   - Alta

3. O campo de valor mínimo continua disponível como ajuste fino opcional, combinado com a faixa.

4. Os cards passam a destacar a margem escolhida (valor em evidência, com o rótulo do tipo), mantendo as outras margens visíveis abaixo. A ordenação da lista passa a seguir a margem selecionada, da maior para a menor.

5. Um resumo curto acima da lista mostra quantos leads existem em cada faixa dentro do filtro atual (ex.: "Alta 12 · Média 31 · Baixa 8"), para a consultora priorizar quem ligar primeiro.

## Faixas propostas

Faixas por valor disponível mensal, aplicadas ao tipo de margem escolhido:

```text
Empréstimo (margem principal)   Baixa: < R$ 200   Média: R$ 200–600   Alta: > R$ 600
Cartão de crédito               Baixa: < R$ 80    Média: R$ 80–200    Alta: > R$ 200
Cartão benefício                Baixa: < R$ 60    Média: R$ 60–150    Alta: > R$ 150
```

Os limites ficam num único ponto do código, fáceis de ajustar depois se você quiser calibrar.

## Sugestões extras (posso incluir se aprovar)

- **Ordenar por potencial total**: soma das três margens disponíveis, para achar o cliente mais rentável no conjunto, não só numa linha.
- **Filtro "só com telefone"**: esconde quem ainda não tem contato enriquecido, evitando tempo perdido.
- **Priorizar a carteira pela faixa**: a reposição automática dos 10 leads passa a preferir margem alta, então a carteira nasce melhor.
- **Filtro de percentual utilizado**: mostrar quem já tem pouca margem comprometida (mais espaço para nova operação).
- **Salvar o filtro preferido** por usuário, para não reconfigurar a cada acesso.

## Detalhes técnicos

- `src/lib/prospeccao/tomadores-al.functions.ts` → `getTomadoresAl`: adicionar ao `inputValidator` os campos `tipoMargem` (`emprestimo` | `cartao_credito` | `cartao_beneficio` | `qualquer`) e `faixa` (`todas` | `baixa` | `media` | `alta`). O filtro aplica `gte`/`lt` sobre a coluna correspondente (`margem_disp_emprestimo`, `margem_disp_cartao_credito`, `margem_util_cartao_beneficio` como proxy de benefício disponível) e a ordenação usa a mesma coluna. Para `qualquer`, usar `.or(...)` com as três colunas na faixa.
- Novo módulo `src/lib/prospeccao/margem-faixas.ts` com o mapa de colunas, limites das faixas e helper `faixaDaMargem(valor, tipo)` — reutilizado no backend e nos cards.
- Nova server fn `getContagemFaixasTomadores` (mesmos filtros, três `count: exact head: true`) para o resumo de faixas; roda em paralelo com a lista.
- `src/routes/_authenticated/tomadores-al.tsx`: dois novos `Select` controlados por estado, incluídos nas dependências do efeito de busca e resetando `page` para 0; card destaca a margem ativa; exportação CSV do admin passa a respeitar os mesmos filtros.
- RLS permanece intacta: os filtros são adicionais à consulta já escopada por `consultora_responsavel` / admin.
