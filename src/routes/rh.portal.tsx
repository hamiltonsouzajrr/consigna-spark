import { createFileRoute } from "@tanstack/react-router";
import { useSuspenseQuery } from "@tanstack/react-query";
import {
  Plane,
  FileText,
  ReceiptText,
  GraduationCap,
  HeartHandshake,
  Clock,
  CalendarDays,
  Bell,
  CheckCircle2,
  AlertTriangle,
  Megaphone,
  Cake,
  TrendingUp,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { toast } from "sonner";
import { RhPageHeader } from "@/components/rh/RhLayout";
import { RhStatCard } from "@/components/rh/RhStatCard";
import { formatDate, brl } from "@/lib/rh/mock";
import { portalQueryOptions } from "@/lib/rh/portal";

export const Route = createFileRoute("/rh/portal")({
  loader: ({ context }) => context.queryClient.ensureQueryData(portalQueryOptions()),
  component: Portal,
  errorComponent: ({ error }) => (
    <div role="alert" className="p-6 text-sm text-destructive">{error.message}</div>
  ),
  notFoundComponent: () => <div className="p-6 text-sm">Colaborador não encontrado.</div>,
});

const atalhos = [
  { label: "Solicitar Férias", icon: Plane },
  { label: "Enviar Documento", icon: FileText },
  { label: "Ver Holerite", icon: ReceiptText },
  { label: "Meus Treinamentos", icon: GraduationCap },
];

const avisos = [
  { id: 1, icon: Megaphone, titulo: "Reunião geral de resultados", quando: "Hoje, 16h", tone: "text-sky-600" },
  { id: 2, icon: Cake, titulo: "Aniversariantes do mês", quando: "Junho", tone: "text-rose-600" },
  { id: 3, icon: AlertTriangle, titulo: "Atualize seu ASO", quando: "Vence em 15 dias", tone: "text-amber-600" },
];

function Portal() {
  const { data } = useSuspenseQuery(portalQueryOptions());
  const me = data.colaborador;

  return (
    <div>
      <RhPageHeader title="Portal do Colaborador" description="Autoatendimento e informações pessoais." />

      <Card className="mb-6">
        <CardContent className="flex flex-col items-center gap-4 p-6 sm:flex-row sm:items-center">
          <Avatar className="h-16 w-16">
            <AvatarImage src={me.foto} alt={me.nome} />
            <AvatarFallback>{me.nome.slice(0, 2)}</AvatarFallback>
          </Avatar>
          <div className="text-center sm:text-left">
            <h2 className="text-lg font-bold">{me.nome}</h2>
            <p className="text-sm text-muted-foreground">{me.cargo} · {me.departamento}</p>
            <div className="mt-2 flex flex-wrap justify-center gap-2 sm:justify-start">
              <Badge variant="outline">Matrícula {me.matricula}</Badge>
              <Badge variant="outline">Admissão {formatDate(me.admissao)}</Badge>
              <Badge variant="secondary" className="border-0 bg-emerald-100 text-emerald-700">{me.status}</Badge>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="mb-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
        <RhStatCard label="Saldo de férias" value={`${data.saldoFerias} dias`} icon={Plane} tone="sky" hint="Período aquisitivo atual" />
        <RhStatCard label="Banco de horas" value={`${data.bancoHoras >= 0 ? "+" : ""}${data.bancoHoras}h`} icon={Clock} tone="emerald" hint="Atualizado hoje" />
        <RhStatCard label="Salário" value={brl(data.salario)} icon={ReceiptText} tone="violet" hint="Bruto mensal" />
        <RhStatCard label="Benefícios" value={data.beneficiosAtivos} icon={HeartHandshake} tone="amber" hint="Ativos" />
      </div>

      <div className="mb-6 grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader className="pb-3"><CardTitle className="text-base">Atalhos</CardTitle></CardHeader>
          <CardContent className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            {atalhos.map((a) => {
              const Icon = a.icon;
              return (
                <Button
                  key={a.label}
                  variant="outline"
                  className="h-auto flex-col gap-2 py-4"
                  onClick={() => toast.info(`${a.label} (demonstração)`)}
                >
                  <Icon className="h-5 w-5" />
                  <span className="text-xs">{a.label}</span>
                </Button>
              );
            })}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3 flex flex-row items-center gap-2">
            <Bell className="h-4 w-4 text-muted-foreground" />
            <CardTitle className="text-base">Avisos</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {avisos.map((a) => {
              const Icon = a.icon;
              return (
                <div key={a.id} className="flex items-start gap-3 border-b pb-3 last:border-0 last:pb-0">
                  <Icon className={`mt-0.5 h-4 w-4 shrink-0 ${a.tone}`} />
                  <div className="min-w-0">
                    <p className="text-sm font-medium leading-tight">{a.titulo}</p>
                    <p className="text-xs text-muted-foreground">{a.quando}</p>
                  </div>
                </div>
              );
            })}
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card>
          <CardHeader className="pb-3 flex flex-row items-center gap-2">
            <CalendarDays className="h-4 w-4 text-muted-foreground" />
            <CardTitle className="text-base">Próximas férias</CardTitle>
          </CardHeader>
          <CardContent>
            {data.proximasFerias ? (
              <div className="space-y-2">
                <p className="text-2xl font-bold">{data.proximasFerias.dias} dias</p>
                <p className="text-sm text-muted-foreground">
                  {formatDate(data.proximasFerias.inicio)} → {formatDate(data.proximasFerias.fim)}
                </p>
                <Badge variant="secondary" className="border-0 bg-emerald-100 text-emerald-700">
                  <CheckCircle2 className="mr-1 h-3 w-3" /> Aprovado
                </Badge>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">Nenhuma férias agendada.</p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3 flex flex-row items-center gap-2">
            <GraduationCap className="h-4 w-4 text-muted-foreground" />
            <CardTitle className="text-base">Meus treinamentos</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Progresso</span>
              <span className="font-semibold">{data.treinamentos.progresso}%</span>
            </div>
            <Progress value={data.treinamentos.progresso} />
            <p className="text-xs text-muted-foreground">
              {data.treinamentos.concluidos} de {data.treinamentos.total} concluídos
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3 flex flex-row items-center gap-2">
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
            <CardTitle className="text-base">Minhas solicitações</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {data.solicitacoes.length ? (
              data.solicitacoes.map((s) => (
                <div key={s.id} className="flex items-center justify-between border-b pb-2 text-sm last:border-0 last:pb-0">
                  <span>{s.tipo}</span>
                  <Badge
                    variant="secondary"
                    className={
                      s.status === "Aprovado"
                        ? "border-0 bg-emerald-100 text-emerald-700"
                        : s.status === "Pendente"
                        ? "border-0 bg-amber-100 text-amber-700"
                        : "border-0 bg-rose-100 text-rose-700"
                    }
                  >
                    {s.status}
                  </Badge>
                </div>
              ))
            ) : (
              <p className="text-sm text-muted-foreground">Sem solicitações no momento.</p>
            )}
            <p className="pt-1 text-xs text-muted-foreground">{data.documentos} documento(s) no seu perfil</p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
