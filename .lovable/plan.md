# Competição de Prospecção — Prêmio Misterioso da Semana

Ranking exposto para todas as consultoras, com pontuação equilibrada entre **prospectar**, **qualificar (etiquetar)** e **cumprir follow-ups**. A semana fecha **sexta-feira às 16:00** (horário de Maceió), com pop-up e som para todos anunciando a vencedora e revelando o prêmio.

## Como a competição funciona

- **Ciclo:** segunda 00:00 → sexta 16:00. Encerramento automático, sem depender de ninguém clicar.
- **Participantes:** todas as consultoras com conta no sistema. Administradores acompanham, mas não pontuam.
- **Placar:** ranking completo com nomes, pontos e o detalhe das três métricas de cada uma, mais um destaque "sua posição".
- **Prêmio:** o administrador cadastra o prêmio da semana; ele fica como envelope fechado ("Prêmio misterioso") e só é revelado no fechamento.
- **Anúncio:** na sexta às 16:00 todas recebem pop-up com som, confete, pódio e o prêmio revelado. Fica também registrado no sino de notificações.

## Pontuação (equilíbrio entre as três frentes)

| Ação | Pontos | Conta quando |
|---|---|---|
| Contato válido (prospecção) | 10 | Primeiro contato real registrado num lead com telefone válido |
| Qualificação / etiquetagem | 10 | Lead marcado como qualificado **com** telefone, situação e margem/valor preenchidos |
| Follow-up cumprido | 10 | Retorno agendado e concluído na data, com contato registrado |
| Venda fechada (ganho) | 25 | Bônus de desempate |

## Regras anti-burla (o ponto central)

Volume de cliques não gera pontos. Cada ponto precisa de lastro:

1. **Um ponto por lead, por categoria, por semana.** Clicar dez vezes no mesmo lead vale o mesmo que clicar uma vez (garantido por índice único no banco, não só na tela).
2. **Pontos são gravados apenas pelo servidor.** A gravação direta pelo navegador é bloqueada, então não é possível inserir atividade "na mão" pelo console.
3. **Contato exige lead com telefone** e intervalo mínimo de 90 segundos entre contatos contados da mesma consultora — rajadas de cliques não pontuam.
4. **Qualificação exige contato anterior** no mesmo lead com pelo menos 5 minutos de diferença, além dos campos obrigatórios preenchidos. Etiquetar sem falar com ninguém não pontua.
5. **Follow-up só pontua cumprido**, nunca agendado. Agendar dezenas de retornos não muda o placar; agendar e não cumprir não pontua.
6. **Tetos diários por categoria** (ex.: 25 contatos/dia contados), para achatar picos artificiais.
7. **Reversão automática:** se o lead voltar para "novo", for marcado como duplicado, ou for fechado como perdido em menos de 2 minutos após pontuar, os pontos são estornados.
8. **Auditoria do admin:** extrato de todos os pontos por consultora, com motivo, lead de origem e botão para anular pontos suspeitos (com registro de quem anulou).
9. **Placar recalculado no fechamento** a partir do histórico bruto, então qualquer ponto anulado ou estornado já entra corrigido no resultado final.

## Telas

- **`/producao/competicao` (nova, exposta no menu):** contador regressivo para sexta 16:00, pódio, ranking completo com nomes, colunas Contatos / Qualificados / Follow-ups / Bônus / Total, card do prêmio misterioso e link para as regras.
- **Card resumido** no CRM (`/prospeccao`) e no **Meu Dia**: sua posição, seus pontos e o que falta para subir uma posição.
- **Pop-up de fechamento** (todas as contas): som, confete, vencedora, pódio e prêmio revelado.
- **Área do admin** (aba nova em `/prospeccao/admin`): cadastrar prêmio da semana, ver extrato de pontos, anular pontos, encerrar semana manualmente se precisar.

## Detalhes técnicos

**Banco (migração):**
- `prospect_competicao_semanas`: `week_start`, `closes_at`, `premio_titulo`, `premio_descricao`, `revelado`, `vencedor_user_id`, `placar_final jsonb`, timestamps. Leitura para autenticados; escrita só admin/serviço. O prêmio (título/descrição) só é exposto após `revelado = true`.
- `prospect_pontos` (ledger imutável): `user_id`, `week_start`, `categoria` (`contato` | `qualificacao` | `followup` | `ganho`), `ref_tabela`, `ref_id`, `pontos`, `motivo`, `anulado_em`, `anulado_por`. Índice `UNIQUE (user_id, week_start, categoria, ref_tabela, ref_id)` — a garantia real do "um ponto por lead".
- `GRANT SELECT` para `authenticated` (ranking é público internamente); nenhum `INSERT`/`UPDATE` para `authenticated` — só `service_role`.
- Função `registrar_ponto(...)` e `ranking_competicao(_week_start)` como `SECURITY DEFINER` com `EXECUTE` revogado de `anon`/`authenticated` (chamadas apenas via server functions com cliente de serviço).

**Server functions (`src/lib/prospeccao/competicao.functions.ts`):**
- `getCompeticao`: semana atual, ranking completo, minha linha, prêmio (mascarado até a revelação).
- `registrarContato` / `registrarQualificacao` / `concluirFollowup`: passam a ser o único caminho de escrita de `lead_events` e `lead_tasks`, aplicando cooldown, campos obrigatórios, tetos e gravação do ponto.
- `adminDefinirPremio`, `adminAnularPonto`, `adminFecharSemana` (verificação de `has_role` antes do cliente de serviço).

**Fechamento automático:**
- Rota `src/routes/api/public/hooks/competicao-fechar.ts` protegida por `apikey`, que recalcula o placar, define vencedora, marca `revelado` e cria notificações em `rh_notifications` para todas as contas.
- `pg_cron` sexta-feira 19:00 UTC (16:00 Maceió) chamando essa rota.

**Ajustes de segurança nas telas atuais:** `prospeccao.index.tsx`, `prospeccao.$leadId.tsx` e `tomadores-al.tsx` hoje gravam `lead_events`/`lead_tasks` direto do navegador; passam a chamar as server functions, e as políticas de inserção pelo cliente nessas duas tabelas são removidas.

**Pop-up com som:** componente `CompeticaoPopup` montado no `AppShell`, que consulta a semana fechada não vista, toca um som curto (Web Audio, sem arquivo externo), mostra o pódio e marca como visto por conta.
