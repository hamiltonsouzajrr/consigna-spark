import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { AppShell } from "@/components/AppShell";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { RhStatCard } from "@/components/rh/RhStatCard";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import {
  ArrowLeft,
  Trophy,
  Timer,
  Phone,
  CalendarClock,
  Coins,
  TrendingUp,
  TrendingDown,
  Clock,
  RefreshCw,
} from "lucide-react";
import { getMinhaSemana } from "@/lib/prospeccao/minha-semana.functions";

export const Route = createFileRoute("/_authenticated/prospeccao/minha-semana")({
  head: () => ({
    meta: [
      { title: "Minha semana — pontos, tempo ativo e ritmo" },
      {
        name: "description",
        content:
          "Acompanhe pontos da semana, tempo realmente ativo, ritmo por dia e o histórico de cada ação que pontuou.",
      },
      { property: "og:title", content: "Minha semana — pontos, tempo ativo e ritmo" },
      {
        property: "og:description",
        content: "Pontos, tempo ativo, ritmo diário e histórico de pontuação por ação.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex,nofollow" },
    ],
  }),
  component: Page,
});

const CATEGORIA_LABEL: Record<string, string> = {
  contato: "Contato",
  followup: "Follow-up cumprido",
  ganho: "Venda confirmada",
  qualificacao: "Qualificação (antigo)",
};

const ORIGEM_LABEL: Record<string, string> = { crm: "CRM", tomadores_al: "Tomadores AL" };

const fmtHoras = (segundos: number) => {
  const h = Math.floor(segundos / 3600);
  const m = Math.round((segundos % 3600) / 60);
  return h > 0 ? `${h}h ${String(m).padStart(2, "0")}min` : `${m}min`;
};

const fmtDia = (d: string) => {
  const [y, m, dd] = d.split("-").map(Number);
  const data = new Date(Date.UTC(y!, (m ?? 1) - 1, dd ?? 1));
  return data.toLocaleDateString("pt-BR", { weekday: "short", day: "2-digit", month: "2-digit", timeZone: "UTC" });
};

const fmtHora = (iso: string) =>
  new Date(iso).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });

function Page() {
  const carregar = useServerFn(getMinhaSemana);
  const [selecionada, setSelecionada] = useState<string | undefined>(undefined);

  const q = useQuery({
    queryKey: ["minha-semana", selecionada ?? "eu"],
    queryFn: () => carregar({ data: selecionada ? { userId: selecionada } : {} }),
    refetchInterval: 60_000,
  });

  const d = q.data;

  return (
    <AppShell>
      <div className="mx-auto w-full max-w-6xl space-y-5 p-4 sm:p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="min-w-0">
            <Button asChild variant="ghost" size="sm" className="-ml-2 mb-1">
              <Link to="/prospeccao">
                <ArrowLeft className="mr-1 h-4 w-4" /> Prospecção
              </Link>
            </Button>
            <h1 className="truncate text-2xl font-bold tracking-tight">
              {d ? `Semana de ${d.nome}` : "Minha semana"}
            </h1>
            <p className="text-sm text-muted-foreground">
              Pontos, tempo realmente ativo, ritmo por dia e cada ação que pontuou.
            </p>
          </div>
          <div className="flex items-center gap-2">
            {d?.isAdmin && d.consultoras.length > 0 && (
              <Select value={selecionada ?? d.userId} onValueChange={(v) => setSelecionada(v)}>
                <SelectTrigger className="w-[220px]">
                  <SelectValue placeholder="Escolher consultora" />
                </SelectTrigger>
                <SelectContent>
                  {d.consultoras.map((c) => (
                    <SelectItem key={c.user_id} value={c.user_id}>
                      {c.nome}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
            <Button variant="outline" size="sm" onClick={() => q.refetch()} disabled={q.isFetching}>
              <RefreshCw className={`mr-1 h-4 w-4 ${q.isFetching ? "animate-spin" : ""}`} /> Atualizar
            </Button>
          </div>
        </div>

        {q.isLoading && (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {[0, 1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-28 w-full" />
            ))}
          </div>
        )}

        {q.error && (
          <Card className="p-6 text-sm text-muted-foreground">
            Não foi possível carregar os dados agora. Tente atualizar.
          </Card>
        )}

        {d && (
          <>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <RhStatCard
                label="Pontos da semana"
                value={d.totais.pontos}
                icon={Trophy}
                tone="amber"
                hint={
                  d.posicao
                    ? `${d.posicao}º lugar de ${d.participantes}`
                    : "Ainda sem posição no ranking"
                }
              />
              <RhStatCard
                label="Tempo ativo na semana"
                value={fmtHoras(d.usoSemanaSegundos)}
                icon={Timer}
                tone="sky"
                hint={`Hoje: ${fmtHoras(d.usoHojeSegundos)}`}
              />
              <RhStatCard
                label="Contatos (pontos)"
                value={d.totais.contatos}
                icon={Phone}
                hint={`Follow-ups: ${d.totais.followups} pts`}
              />
              <RhStatCard
                label="Vendas confirmadas"
                value={d.totais.ganhos}
                icon={Coins}
                tone="emerald"
                hint={
                  d.vendasPendentes.length > 0
                    ? `${d.vendasPendentes.length} aguardando conferência`
                    : "Nenhuma venda em espera"
                }
              />
            </div>

            <Card className="p-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="text-sm font-semibold">Ritmo de hoje</div>
                <div className="text-sm text-muted-foreground">
                  {d.contatosHoje} de {d.metaDiaria} contatos · {d.pontosHoje} pts hoje
                </div>
              </div>
              <Progress
                className="mt-3"
                value={Math.min(100, Math.round((d.contatosHoje / Math.max(1, d.metaDiaria)) * 100))}
              />
            </Card>

            <Card className="p-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="text-sm font-semibold">Evolução das últimas semanas</div>
                <Badge variant="outline" className="gap-1">
                  {d.tendenciaMediaPontos >= 0 ? (
                    <TrendingUp className="h-3 w-3 text-emerald-600" />
                  ) : (
                    <TrendingDown className="h-3 w-3 text-rose-600" />
                  )}
                  {d.tendenciaMediaPontos >= 0
                    ? `Crescimento médio de ${d.tendenciaMediaPontos} pts por semana`
                    : `Queda média de ${Math.abs(d.tendenciaMediaPontos)} pts por semana`}
                </Badge>
              </div>
              <div className="mt-4 h-64 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart
                    data={d.historico.map((h) => ({
                      semana: fmtDia(h.weekStart),
                      pontos: h.pontos,
                      horas: Math.round((h.usoSegundos / 3600) * 10) / 10,
                    }))}
                    margin={{ top: 8, right: 12, left: -12, bottom: 0 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" className="stroke-border" vertical={false} />
                    <XAxis dataKey="semana" tick={{ fontSize: 11 }} tickLine={false} axisLine={false} />
                    <YAxis tick={{ fontSize: 11 }} tickLine={false} axisLine={false} />
                    <Tooltip
                      contentStyle={{
                        borderRadius: 8,
                        border: "1px solid hsl(var(--border))",
                        background: "hsl(var(--card))",
                        fontSize: 12,
                      }}
                      formatter={(v: number, nome: string) =>
                        nome === "horas" ? [`${v}h`, "Horas ativas"] : [v, "Pontos"]
                      }
                    />
                    <Line type="monotone" dataKey="pontos" strokeWidth={2.5} dot={{ r: 3 }} className="stroke-primary" stroke="currentColor" />
                    <Line
                      type="monotone"
                      dataKey="horas"
                      strokeWidth={2}
                      strokeDasharray="4 4"
                      dot={false}
                      stroke="hsl(var(--muted-foreground))"
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
              <p className="mt-2 text-xs text-muted-foreground">
                Linha cheia: pontos por semana. Linha tracejada: horas realmente ativas na plataforma.
              </p>
            </Card>

            <RitmoSemana dias={d.dias} metaDiaria={d.metaDiaria} />

            <Tabs defaultValue="extrato">
              <TabsList>
                <TabsTrigger value="extrato">Histórico de pontuação</TabsTrigger>
                <TabsTrigger value="standby">
                  Vendas em espera {d.vendasPendentes.length > 0 ? `(${d.vendasPendentes.length})` : ""}
                </TabsTrigger>
              </TabsList>

              <TabsContent value="extrato">
                <Card className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Quando</TableHead>
                        <TableHead>Ação</TableHead>
                        <TableHead>Cliente</TableHead>
                        <TableHead>Detalhe</TableHead>
                        <TableHead className="text-right">Pontos</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {d.extrato.length === 0 && (
                        <TableRow>
                          <TableCell colSpan={5} className="py-8 text-center text-sm text-muted-foreground">
                            Nenhuma ação pontuada nesta semana ainda.
                          </TableCell>
                        </TableRow>
                      )}
                      {d.extrato.map((e) => (
                        <TableRow key={e.id} className={e.anulado_em ? "text-muted-foreground line-through" : ""}>
                          <TableCell className="whitespace-nowrap">{fmtHora(e.created_at)}</TableCell>
                          <TableCell>{CATEGORIA_LABEL[e.categoria] ?? e.categoria}</TableCell>
                          <TableCell className="max-w-[220px] truncate">{e.cliente ?? "—"}</TableCell>
                          <TableCell className="max-w-[260px] truncate text-xs">
                            {e.anulado_em ? "Anulado pelo gestor" : (e.motivo ?? "—")}
                          </TableCell>
                          <TableCell className="text-right font-semibold">
                            {e.anulado_em ? "0 pt" : `${e.pontos} pts`}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </Card>
              </TabsContent>

              <TabsContent value="standby">
                <Card className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Fechada em</TableHead>
                        <TableHead>Cliente</TableHead>
                        <TableHead>Origem</TableHead>
                        <TableHead className="text-right">Situação</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {d.vendasPendentes.length === 0 && (
                        <TableRow>
                          <TableCell colSpan={4} className="py-8 text-center text-sm text-muted-foreground">
                            Nenhuma venda aguardando conferência.
                          </TableCell>
                        </TableRow>
                      )}
                      {d.vendasPendentes.map((v) => (
                        <TableRow key={v.id}>
                          <TableCell className="whitespace-nowrap">{fmtHora(v.created_at)}</TableCell>
                          <TableCell>{v.cliente_nome ?? "—"}</TableCell>
                          <TableCell>{ORIGEM_LABEL[v.origem] ?? v.origem}</TableCell>
                          <TableCell className="text-right">
                            <Badge variant="outline" className="gap-1">
                              <Clock className="h-3 w-3" /> Aguardando o gerente
                            </Badge>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </Card>
              </TabsContent>
            </Tabs>
          </>
        )}
      </div>
    </AppShell>
  );
}

function RitmoSemana({
  dias,
  metaDiaria,
}: {
  dias: Array<{ data: string; pontos: number; contatos: number; usoSegundos: number }>;
  metaDiaria: number;
}) {
  const melhor = dias.reduce<null | (typeof dias)[number]>((m, d) => (!m || d.pontos > m.pontos ? d : m), null);

  return (
    <Card className="overflow-x-auto">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b p-4">
        <div className="text-sm font-semibold">Ritmo da semana</div>
        {melhor && melhor.pontos > 0 && (
          <Badge variant="outline" className="gap-1">
            <CalendarClock className="h-3 w-3" /> Melhor dia: {fmtDia(melhor.data)} ({melhor.pontos} pts)
          </Badge>
        )}
      </div>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Dia</TableHead>
            <TableHead className="text-right">Contatos</TableHead>
            <TableHead className="text-right">Pontos</TableHead>
            <TableHead className="text-right">Tempo ativo</TableHead>
            <TableHead className="text-right">Pontos por hora ativa</TableHead>
            <TableHead>Leitura</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {dias.length === 0 && (
            <TableRow>
              <TableCell colSpan={6} className="py-8 text-center text-sm text-muted-foreground">
                Semana ainda sem registros.
              </TableCell>
            </TableRow>
          )}
          {dias.map((dia) => {
            const horas = dia.usoSegundos / 3600;
            const porHora = horas >= 0.25 ? Math.round((dia.pontos / horas) * 10) / 10 : null;
            const ociosa = horas >= 2 && dia.pontos < 30;
            const bateuMeta = dia.contatos >= metaDiaria;
            return (
              <TableRow key={dia.data}>
                <TableCell className="whitespace-nowrap capitalize">{fmtDia(dia.data)}</TableCell>
                <TableCell className="text-right">{dia.contatos}</TableCell>
                <TableCell className="text-right font-semibold">{dia.pontos}</TableCell>
                <TableCell className="text-right">{fmtHoras(dia.usoSegundos)}</TableCell>
                <TableCell className="text-right">{porHora == null ? "—" : porHora}</TableCell>
                <TableCell className="text-xs">
                  {ociosa ? (
                    <span className="text-amber-600 dark:text-amber-400">Muito tempo ativo com pouca pontuação</span>
                  ) : bateuMeta ? (
                    <span className="text-emerald-600 dark:text-emerald-400">Meta de contatos batida</span>
                  ) : (
                    <span className="text-muted-foreground">Dentro do normal</span>
                  )}
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </Card>
  );
}
