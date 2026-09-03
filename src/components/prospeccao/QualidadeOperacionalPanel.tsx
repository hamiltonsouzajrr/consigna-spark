import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { AlertTriangle, CheckCircle2, MessageCircle, PhoneCall, Target, Users } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { getQualidadeOperacional } from "@/lib/prospeccao/qualidade.functions";

const CORES = ["hsl(var(--primary))", "#10b981", "#f59e0b", "#ef4444"];

function Kpi({
  label,
  value,
  hint,
  icon: Icon,
}: {
  label: string;
  value: string | number;
  hint?: string;
  icon: React.ComponentType<{ className?: string }>;
}) {
  return (
    <Card>
      <CardContent className="flex items-center gap-3 p-4">
        <span className="rounded-lg bg-muted p-2 text-muted-foreground">
          <Icon className="h-5 w-5" />
        </span>
        <div className="min-w-0">
          <p className="truncate text-xs text-muted-foreground">{label}</p>
          <p className="text-xl font-bold tabular-nums">{value}</p>
          {hint ? <p className="truncate text-xs text-muted-foreground">{hint}</p> : null}
        </div>
      </CardContent>
    </Card>
  );
}

/** Painel de qualidade: abordagem, conversão e follow-up, com atualização automática. */
export function QualidadeOperacionalPanel() {
  const fetchQualidade = useServerFn(getQualidadeOperacional);
  const { data, isLoading } = useQuery({
    queryKey: ["prospeccao", "qualidade-operacional"],
    queryFn: () => fetchQualidade(),
    refetchInterval: 60_000,
    staleTime: 30_000,
  });

  if (isLoading || !data) {
    return (
      <div className="grid gap-3 md:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-24 w-full" />
        ))}
      </div>
    );
  }

  const funil = [
    { etapa: "Leads", total: data.abordagem.leadsTotais },
    { etapa: "Abordados", total: data.abordagem.abordados },
    { etapa: "Qualificados", total: data.conversao.qualificados },
    { etapa: "Ganhos", total: data.conversao.ganhos },
  ];

  const followupData = [
    { name: "Concluídos", value: data.followup.concluidos },
    { name: "Abertos no prazo", value: Math.max(data.followup.abertos - data.followup.atrasados, 0) },
    { name: "Atrasados", value: data.followup.atrasados },
  ].filter((d) => d.value > 0);

  return (
    <div className="space-y-4">
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        <Kpi
          label="Taxa de abordagem"
          value={`${data.abordagem.taxa}%`}
          hint={`${data.abordagem.abordados} de ${data.abordagem.leadsTotais} leads`}
          icon={Target}
        />
        <Kpi
          label={`Contatos (${data.periodoDias} dias)`}
          value={data.abordagem.contatos}
          hint={`${data.abordagem.ligacoes} ligações · ${data.abordagem.whatsapp} WhatsApp`}
          icon={PhoneCall}
        />
        <Kpi
          label="Taxa de conversão"
          value={`${data.conversao.taxaGanho}%`}
          hint={`${data.conversao.ganhos} ganhos · ${data.conversao.qualificados} qualificados`}
          icon={CheckCircle2}
        />
        <Kpi
          label="Follow-ups atrasados"
          value={data.followup.atrasados}
          hint={`${data.followup.abertos} abertos · ${data.followup.taxaConclusao}% concluídos`}
          icon={AlertTriangle}
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Funil de abordagem e conversão</CardTitle>
            <CardDescription>Do lead distribuído ao negócio ganho.</CardDescription>
          </CardHeader>
          <CardContent className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={funil} margin={{ top: 8, right: 12, left: -16, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="etapa" tick={{ fontSize: 12 }} stroke="hsl(var(--muted-foreground))" />
                <YAxis allowDecimals={false} tick={{ fontSize: 12 }} stroke="hsl(var(--muted-foreground))" />
                <Tooltip
                  contentStyle={{
                    background: "hsl(var(--popover))",
                    border: "1px solid hsl(var(--border))",
                    borderRadius: 8,
                    fontSize: 12,
                  }}
                />
                <Bar dataKey="total" name="Leads" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Situação dos follow-ups</CardTitle>
            <CardDescription>Disciplina de retorno da equipe.</CardDescription>
          </CardHeader>
          <CardContent className="h-72">
            {followupData.length === 0 ? (
              <p className="py-10 text-center text-sm text-muted-foreground">Nenhum follow-up registrado.</p>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={followupData} dataKey="value" nameKey="name" innerRadius={50} outerRadius={85}>
                    {followupData.map((_, i) => (
                      <Cell key={i} fill={CORES[i % CORES.length]} />
                    ))}
                  </Pie>
                  <Legend wrapperStyle={{ fontSize: 12 }} />
                  <Tooltip
                    contentStyle={{
                      background: "hsl(var(--popover))",
                      border: "1px solid hsl(var(--border))",
                      borderRadius: 8,
                      fontSize: 12,
                    }}
                  />
                </PieChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Desempenho real por consultora</CardTitle>
          <CardDescription>
            Atualizado automaticamente a cada minuto · última leitura{" "}
            {new Date(data.atualizadoEm).toLocaleTimeString("pt-BR")}
          </CardDescription>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Consultora</TableHead>
                <TableHead className="text-right">Leads</TableHead>
                <TableHead className="text-right">Abordados</TableHead>
                <TableHead className="w-40">Taxa de abordagem</TableHead>
                <TableHead className="text-right">Contatos</TableHead>
                <TableHead className="text-right">Qualif.</TableHead>
                <TableHead className="text-right">Ganhos</TableHead>
                <TableHead className="text-right">Follow-ups</TableHead>
                <TableHead className="text-right">Atrasados</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.porConsultora.length === 0 && (
                <TableRow>
                  <TableCell colSpan={9} className="text-center text-sm text-muted-foreground">
                    Sem dados no período.
                  </TableCell>
                </TableRow>
              )}
              {data.porConsultora.map((c) => (
                <TableRow key={c.nome}>
                  <TableCell className="font-medium">{c.nome}</TableCell>
                  <TableCell className="text-right tabular-nums">{c.leads}</TableCell>
                  <TableCell className="text-right tabular-nums">{c.abordados}</TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <Progress value={c.taxaAbordagem} className="h-2" />
                      <span className="w-10 text-right text-xs tabular-nums">{c.taxaAbordagem}%</span>
                    </div>
                  </TableCell>
                  <TableCell className="text-right tabular-nums">{c.contatos}</TableCell>
                  <TableCell className="text-right tabular-nums">{c.qualificados}</TableCell>
                  <TableCell className="text-right tabular-nums">{c.ganhos}</TableCell>
                  <TableCell className="text-right tabular-nums">
                    {c.followupsConcluidos}/{c.followupsConcluidos + c.followupsAbertos}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {c.followupsAtrasados > 0 ? (
                      <span className="font-semibold text-rose-600 dark:text-rose-400">{c.followupsAtrasados}</span>
                    ) : (
                      0
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
