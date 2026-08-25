import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Trophy, Gift, Clock, ShieldCheck, Medal, Phone, Tag, CalendarClock, TrendingUp } from "lucide-react";
import { getCompeticao } from "@/lib/prospeccao/competicao.functions";
import { useAuth } from "@/lib/auth";

function useCountdown(target?: string) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);
  if (!target) return null;
  const diff = new Date(target).getTime() - now;
  if (diff <= 0) return "encerrada";
  const d = Math.floor(diff / 86400000);
  const h = Math.floor((diff % 86400000) / 3600000);
  const m = Math.floor((diff % 3600000) / 60000);
  const s = Math.floor((diff % 60000) / 1000);
  return d > 0 ? `${d}d ${h}h ${m}min` : `${h}h ${m}min ${s}s`;
}

const MEDALHA = ["text-amber-500", "text-slate-400", "text-amber-700"];

export function CompeticaoRanking({ compact = false }: { compact?: boolean }) {
  const { user } = useAuth();
  const fetchCompeticao = useServerFn(getCompeticao);
  const { data, isLoading } = useQuery({
    queryKey: ["competicao"],
    queryFn: () => fetchCompeticao(),
    refetchInterval: 60_000,
  });
  const countdown = useCountdown(data?.closes_at);

  if (isLoading) return <Skeleton className="h-64 w-full" />;
  if (!data) return null;

  const podio = data.ranking.slice(0, 3);

  if (compact) {
    return (
      <Card className="p-4">
        <div className="mb-3 flex items-center gap-2">
          <Trophy className="h-4 w-4 text-amber-500" />
          <span className="text-sm font-semibold">Competição da semana</span>
          <Badge variant="outline" className="ml-auto gap-1 text-xs">
            <Clock className="h-3 w-3" /> {countdown}
          </Badge>
        </div>
        <div className="grid grid-cols-3 gap-3 text-center">
          <div>
            <div className="text-2xl font-bold">{data.minha_posicao ?? "—"}</div>
            <div className="text-xs text-muted-foreground">sua posição</div>
          </div>
          <div>
            <div className="text-2xl font-bold text-primary">{data.minha_linha?.total ?? 0}</div>
            <div className="text-xs text-muted-foreground">seus pontos</div>
          </div>
          <div>
            <div className="text-2xl font-bold">{data.faltam_para_subir ?? 0}</div>
            <div className="text-xs text-muted-foreground">p/ subir 1 posição</div>
          </div>
        </div>
        <p className="mt-3 text-xs text-muted-foreground">
          Líder: <strong>{podio[0]?.nome ?? "—"}</strong> com {podio[0]?.total ?? 0} pontos.
        </p>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <div className="grid gap-4 md:grid-cols-3">
        <Card className="p-4">
          <div className="flex items-center gap-2 text-sm font-semibold">
            <Clock className="h-4 w-4 text-primary" /> Encerra em
          </div>
          <div className="mt-2 text-2xl font-bold tabular-nums">{countdown}</div>
          <p className="text-xs text-muted-foreground">Sexta-feira às 16:00 (segunda 00:00 → sexta 16:00).</p>
        </Card>
        <Card className="border-amber-500/30 bg-amber-500/5 p-4">
          <div className="flex items-center gap-2 text-sm font-semibold">
            <Gift className="h-4 w-4 text-amber-600" /> Prêmio da semana
          </div>
          <div className="mt-2 text-lg font-bold">
            {data.premio_titulo ?? "🎁 Prêmio Misterioso"}
          </div>
          <p className="text-xs text-muted-foreground">
            {data.premio_descricao ?? "Revelado no fechamento da sexta, às 16:00, para todas ao mesmo tempo."}
          </p>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-2 text-sm font-semibold">
            <TrendingUp className="h-4 w-4 text-primary" /> Sua posição
          </div>
          <div className="mt-2 text-2xl font-bold">
            {data.minha_posicao ? `${data.minha_posicao}º` : "—"}{" "}
            <span className="text-sm font-normal text-muted-foreground">
              {data.minha_linha?.total ?? 0} pts
            </span>
          </div>
          <p className="text-xs text-muted-foreground">
            {data.sou_admin
              ? "Administradores acompanham, mas não pontuam."
              : data.faltam_para_subir
                ? `Faltam ${data.faltam_para_subir} pontos para subir uma posição.`
                : "Você está na liderança — mantenha o ritmo!"}
          </p>
        </Card>
      </div>

      {podio.length > 0 && (
        <div className="grid gap-3 sm:grid-cols-3">
          {podio.map((r, i) => (
            <Card key={r.user_id} className={`p-4 ${i === 0 ? "border-amber-500/40 bg-amber-500/5" : ""}`}>
              <div className="flex items-center gap-2">
                <Medal className={`h-5 w-5 ${MEDALHA[i]}`} />
                <span className="font-semibold">{i + 1}º {r.nome}</span>
              </div>
              <div className="mt-2 text-2xl font-bold">{r.total} pts</div>
              <div className="mt-1 flex flex-wrap gap-2 text-xs text-muted-foreground">
                <span className="flex items-center gap-1"><Phone className="h-3 w-3" />{r.contatos}</span>
                <span className="flex items-center gap-1"><Tag className="h-3 w-3" />{r.qualificacoes}</span>
                <span className="flex items-center gap-1"><CalendarClock className="h-3 w-3" />{r.followups}</span>
              </div>
            </Card>
          ))}
        </div>
      )}

      <Card className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-12">#</TableHead>
              <TableHead>Consultora</TableHead>
              <TableHead className="text-right">Contatos</TableHead>
              <TableHead className="text-right">Qualificados</TableHead>
              <TableHead className="text-right">Follow-ups</TableHead>
              <TableHead className="text-right">Vendas</TableHead>
              <TableHead className="text-right">Total</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {data.ranking.length === 0 && (
              <TableRow>
                <TableCell colSpan={7} className="py-8 text-center text-sm text-muted-foreground">
                  Nenhum ponto registrado nesta semana ainda. Comece prospectando!
                </TableCell>
              </TableRow>
            )}
            {data.ranking.map((r, i) => (
              <TableRow key={r.user_id} className={r.user_id === user?.id ? "bg-primary/5 font-medium" : ""}>
                <TableCell>{i + 1}</TableCell>
                <TableCell>{r.nome}{r.user_id === user?.id ? " (você)" : ""}</TableCell>
                <TableCell className="text-right">{r.contatos}</TableCell>
                <TableCell className="text-right">{r.qualificacoes}</TableCell>
                <TableCell className="text-right">{r.followups}</TableCell>
                <TableCell className="text-right">{r.ganhos}</TableCell>
                <TableCell className="text-right font-bold">{r.total}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>

      <Card className="p-4">
        <div className="flex items-center gap-2 text-sm font-semibold">
          <ShieldCheck className="h-4 w-4 text-emerald-600" /> Como pontuar (e por que clicar não vale)
        </div>
        <ul className="mt-2 space-y-1 text-xs text-muted-foreground">
          <li>• <strong>Contato válido (10 pts)</strong>: lead com telefone, 1 ponto por lead na semana, intervalo mínimo de 90s entre contatos contados.</li>
          <li>• <strong>Qualificação (10 pts)</strong>: status qualificado/proposta com situação preenchida e contato registrado há pelo menos 5 minutos.</li>
          <li>• <strong>Follow-up cumprido (10 pts)</strong>: só ao concluir no prazo, com contato registrado no dia. Agendar não pontua.</li>
          <li>• <strong>Venda fechada (25 pts)</strong>: bônus de desempate.</li>
          <li>• Pontos são gravados no servidor, com teto diário; voltar o lead para “novo” estorna os pontos e o admin pode anular pontos suspeitos.</li>
        </ul>
      </Card>
    </div>
  );
}
