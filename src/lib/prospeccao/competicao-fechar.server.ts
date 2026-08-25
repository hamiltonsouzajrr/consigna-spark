// Closes a competition week: recomputes the scoreboard from the ledger,
// picks the winner, reveals the mystery prize and notifies every account.
import { adminClient, garantirSemana, ranking, weekStart, closesAt } from "./competicao.server";

export type FecharResultado = {
  week_start: string;
  vencedor_user_id: string | null;
  vencedor_nome: string | null;
  participantes: number;
  ja_estava_fechada: boolean;
};

export async function fecharSemana(ws?: string, force = false): Promise<FecharResultado> {
  const db = await adminClient();
  const semanaAlvo = ws ?? weekStart();
  const semana = await garantirSemana(semanaAlvo);

  if (semana?.revelado && !force) {
    const placar = (semana.placar_final ?? []) as any[];
    return {
      week_start: semanaAlvo,
      vencedor_user_id: semana.vencedor_user_id ?? null,
      vencedor_nome: placar[0]?.nome ?? null,
      participantes: placar.length,
      ja_estava_fechada: true,
    };
  }

  const placar = await ranking(semanaAlvo);
  const vencedor = placar[0] ?? null;

  await db
    .from("prospect_competicao_semanas")
    .update({
      revelado: true,
      vencedor_user_id: vencedor?.user_id ?? null,
      placar_final: placar as any,
      fechado_em: new Date().toISOString(),
    } as any)
    .eq("week_start", semanaAlvo);

  // Announce to everybody (the pop-up reads these notifications).
  const { data: users } = await db.auth.admin.listUsers({ page: 1, perPage: 1000 });
  const titulo = vencedor
    ? `🏆 ${vencedor.nome} ganhou o Prêmio Misterioso da semana!`
    : "Competição da semana encerrada";
  const premio = semana?.premio_titulo ? ` Prêmio: ${semana.premio_titulo}.` : "";
  const corpo = vencedor
    ? `${vencedor.nome} fechou a semana com ${vencedor.total} pontos (${vencedor.contatos} contatos, ${vencedor.qualificacoes} qualificações, ${vencedor.followups} follow-ups).${premio}`
    : "Nenhum ponto foi registrado nesta semana.";

  const rows = (users?.users ?? []).map((u: any) => ({
    user_id: u.id,
    title: titulo,
    body: corpo,
  }));
  for (let i = 0; i < rows.length; i += 200) {
    await db.from("rh_notifications").insert(rows.slice(i, i + 200) as any);
  }

  // Open next week so the board is live again right away.
  const [y, m, d] = semanaAlvo.split("-").map(Number);
  const next = new Date(Date.UTC(y!, (m ?? 1) - 1, (d ?? 1) + 7));
  const nextWs = next.toISOString().slice(0, 10);
  await db
    .from("prospect_competicao_semanas")
    .insert({ week_start: nextWs, closes_at: closesAt(nextWs) } as any);

  return {
    week_start: semanaAlvo,
    vencedor_user_id: vencedor?.user_id ?? null,
    vencedor_nome: vencedor?.nome ?? null,
    participantes: placar.length,
    ja_estava_fechada: false,
  };
}
