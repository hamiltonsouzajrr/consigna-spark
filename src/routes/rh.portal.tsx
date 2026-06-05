import { createFileRoute } from "@tanstack/react-router";
import { Plane, FileText, ReceiptText, GraduationCap, HeartHandshake, Clock } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { RhPageHeader } from "@/components/rh/RhLayout";
import { RhStatCard } from "@/components/rh/RhStatCard";
import { colaboradores, formatDate, brl } from "@/lib/rh/mock";

export const Route = createFileRoute("/rh/portal")({
  component: Portal,
});

const atalhos = [
  { label: "Solicitar Férias", icon: Plane, tone: "sky" as const },
  { label: "Enviar Documento", icon: FileText, tone: "violet" as const },
  { label: "Ver Holerite", icon: ReceiptText, tone: "emerald" as const },
  { label: "Meus Treinamentos", icon: GraduationCap, tone: "amber" as const },
];

function Portal() {
  const me = colaboradores[0];
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
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="mb-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
        <RhStatCard label="Saldo de férias" value="12 dias" icon={Plane} tone="sky" />
        <RhStatCard label="Banco de horas" value="+8h" icon={Clock} tone="emerald" />
        <RhStatCard label="Salário" value={brl(me.salario)} icon={ReceiptText} tone="violet" />
        <RhStatCard label="Benefícios" value={3} icon={HeartHandshake} tone="amber" />
      </div>

      <Card>
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
    </div>
  );
}
