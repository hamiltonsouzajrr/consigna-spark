# Aba "Quitação" — prospecção de compra de dívida (AL)

A planilha "Clientes Aptos – ALAGOAS COMPRA" tem 1.876 servidores com contrato ativo, em duas abas:
- **CONTRATOS CALCULADOS**: nome, CPF, status (ex.: "PRÉ ANALISE - APROVADO"), código de ordem, saldo devedor, parcela, valor bruto e troco em 96x, reserva no site, e parcelas pagas, em aberto e totais.
- **Planilha1**: os mesmos clientes com valor bruto e troco em 96, 84, 72, 60, 48 e 36x.

## O que vou construir

**1. Novo item "Quitação" no menu lateral**, com duas visões:
- **Administrador**: envia a planilha, vê uma prévia (quantos são novos, quantos já existem e quantos têm CPF inválido), confirma e distribui para as consultoras de forma igual (menor fila primeiro, como no CRM). Pode ver, editar, remover e redistribuir clientes.
- **Consultora**: vê só os próprios clientes, com a lista ordenada pelo **maior troco** e filtros por status, faixa de troco e prazo.

**2. Ficha de quitação do cliente**
- Saldo devedor, parcela atual, parcelas pagas/em aberto, código de ordem e status.
- Tabela de prazos (96 a 36x) com valor bruto e troco. Prazos com troco negativo aparecem em vermelho como "não compensa".
- Botões Ligar/WhatsApp, telefones puxados do CRM, Tomadores e RockData pelo CPF, e registro do resultado (sem contato, interessado, proposta enviada, fechado, recusado).

**3. Importação sem duplicar**: a mesma planilha pode ser enviada de novo. Os clientes são reconhecidos pelo CPF + código de ordem, os valores são atualizados e o histórico e a consultora são mantidos.

## Melhorias adicionais sugeridas (incluídas)
- **Roteiro de abordagem pronto**: mensagem de WhatsApp preenchida com o nome e o troco do melhor prazo.
- **Destaque "quase quitado"**: clientes com muitas parcelas pagas (saldo baixo e troco alto) aparecem primeiro.
- **Aviso de validade**: os valores ficam "desatualizados" após 30 dias da importação, para a consultora reconferir antes de oferecer.
- **Contador no painel admin**: total importado, trabalhados, interessados, fechados e troco total potencial por consultora.
- **Fechou**: um botão cria a conversão em Minha carteira, já com o produto "Refinanciamento/Compra", o banco e os valores.
- **Lembrete de retorno**: ao marcar "interessado" ou "proposta enviada", cria um follow-up em 2 dias.

## Fora do escopo
- Taxa e fórmulas: uso os valores da planilha e não recalculo nada.
- Pontuação da competição.

## Detalhes técnicos
- Tabelas `quitacao_lotes` e `quitacao_clientes`: cpf, nome, status, cod_ordem, saldo, parcela, reserva, pagas, abertas, plano, `prazos` jsonb {96:{bruto,troco},...}, consultant_id, resultado, ultimo_contato_em, removido_em. Também `quitacao_contatos`. Todas com GRANT e RLS (a consultora vê só os próprios clientes; o admin vê todos) e índice único em (cpf, cod_ordem).
- Leitura da planilha no navegador com `xlsx`, juntando as duas abas pelo CPF. Os números já vêm numéricos.
- `src/lib/prospeccao/quitacao.functions.ts` (importar, distribuir, listar, registrar contato, converter), `src/routes/_authenticated/quitacao.tsx`, item em `AppShell.tsx`.
