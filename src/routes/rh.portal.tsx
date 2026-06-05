import { createFileRoute } from "@tanstack/react-router";
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
import {
  colaboradores,
  formatDate,
  brl,
  ferias,
  treinamentos,
  documentos,
} from "@/lib/rh/mock";

export const Route = createFileRoute("/rh/portal")({
  component: Portal,
});

const atalhos = [
  { label: "Solicitar Férias", icon: Plane, tone: "sky" as const },
  { label: "Enviar Documento", icon: FileText, tone: "violet" as const },
  { label: "Ver Holerite", icon: ReceiptText, tone: "emerald" as const },
  { label: "Meus Treinamentos", icon: GraduationCap, tone: "amber" as const },
];

const avisos = [
  { id: 1, icon: Megaphone, titulo: "Reunião geral de resultados", quando: "Hoje, 16h", tone: "text-sky-600" },
  { id: 2, icon: Cake, titulo: "Aniversariantes do mês", quando: "Junho", tone: "text-rose-600" },
  { id: 3, icon: AlertTriangle, titulo: "Atualize seu ASO", quando: "Vence em 15 dias", tone: "text-amber-600" },
];

function Portal() {
  const me = colaboradores[0];

  const meusTreinamentos = treinamentos.filter((t) => t.colaborador === me.nome);
  const treinosConcluidos = meusTreinamentos.filter((t) => t.status === "Concluído").length;
  const progressoTreinos = meusTreinamentos.length
    ? Math.round((treinosConcluidos / meusTreinamentos.length) * 100)
    : 0;

  const minhasSolicitacoes = ferias.filter((f) => f.colaborador === me.nome);
  const proximasFerias = ferias.find((f) => f.status === "Aprovado" && f.tipo === "Férias");
  const meusDocs = documentos.filter((d) => d.colaborador === me.nome);

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
        <RhStatCard label="Saldo de férias" value="12 dias" icon={Plane} tone="sky" hint="Período aquisitivo atual" />
        <RhStatCard label="Banco de horas" value="+8h" icon={Clock} tone="emerald" hint="Atualizado hoje" />
        <RhStatCard label="Salário" value={brl(me.salario)} icon={ReceiptText} tone="violet" hint="Bruto mensal" />
        <RhStatCard label="Benefícios" value={3} icon={HeartHandshake} tone="amber" hint="Ativos" />
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
            {proximasFerias ? (
              <div className="space-y-2">
                <p className="text-2xl font-bold">{proximasFerias.dias} dias</p>
                <p className="text-sm text-muted-foreground">
                  {formatDate(proximasFerias.inicio)} → {formatDate(proximasFerias.fim)}
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
              <span className="font-semibold">{progressoTreinos}%</span>
            </div>
            <Progress value={progressoTreinos} />
            <p className="text-xs text-muted-foreground">
              {treinosConcluidos} de {meusTreinamentos.length || 0} concluídos
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3 flex flex-row items-center gap-2">
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
            <CardTitle className="text-base">Minhas solicitações</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {minhasSolicitacoes.length ? (
              minhasSolicitacoes.map((s) => (
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
            <p className="pt-1 text-xs text-muted-foreground">{meusDocs.length} documento(s) no seu perfil</p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
