# Acompanhamento por consultora — detalhe ao clicar

## O que muda para você

Na aba **Esteira de Produção** (painel do administrador), a seção "Acompanhamento por consultora" deixa de ser só uma lista de números:

- **Clique na consultora** para abrir, logo abaixo do nome dela, a carteira completa de contratos.
- A lista mostra, em ordem de prioridade:
  - **Atrasadas** — ligações que já passaram da data, em destaque vermelho;
  - **Hoje** — ligações marcadas para hoje;
  - **Próximas** — os próximos lembretes do mês.
- Cada contrato mostra: nome do cliente, CPF, banco, valor bruto, data da venda, próxima ligação, última ligação feita e o resultado dela ("amortizou", "não atendeu" etc.).
- Clique de novo na consultora para fechar. Um indicador (seta) mostra qual está aberta.
- Consultoras sem nenhum contrato continuam fora da lista, como hoje.

Nada muda para as consultoras — a tela delas ("Amortização mensal") permanece igual. Nenhuma regra de lembrete, prazo ou distribuição é alterada.

## Detalhes técnicos

- `esteiraMetricas` (`src/lib/prospeccao/esteira.functions.ts`): incluir `consultant_id` em cada linha de `porConsultora` (hoje agrupa só pelo nome), para saber de quem carregar os contratos. Contratos sem responsável ficam em um grupo "Sem responsável" também expansível.
- `esteiraListar`: já aceita `consultantId` para administradores; adicionar opção `semResponsavel` para listar os contratos sem dono.
- `EsteiraTab.tsx`: transformar cada linha de consultora em um botão expansível (estado local `abertaId`); ao abrir, buscar `esteiraListar({ consultantId, somenteAtivos: false })` com `useQuery` por consultora (cache de 60s, mesma invalidação ["esteira"] já existente).
- Ordenação no cliente: atrasadas (data < hoje) → hoje → futuras → encerradas; badges de resultado reutilizando os mesmos rótulos da tela da consultora.
- Sem migração de banco, sem novas rotas, sem mudança em RLS.
- Validação: `npx tsgo --noEmit` e teste manual na aba.
