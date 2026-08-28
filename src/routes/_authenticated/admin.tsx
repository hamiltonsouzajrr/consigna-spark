import { createFileRoute, Navigate, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { useAuth } from "@/lib/auth";
import { useRhAccess } from "@/hooks/use-rh-access";
import { useServerFn } from "@tanstack/react-start";
import { AppShell } from "@/components/AppShell";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import {
  ShieldCheck,
  Users,
  Wallet,
  Radar,
  Phone,
  Trophy,
  Target,
  MessageCircle,
  QrCode,
  Star,
  Building2,
  ArrowRight,
  LayoutDashboard,
  UserX,
  KeyRound,
  Shuffle,
} from "lucide-react";
import { revogarAcessosInativosTomadoresAl } from "@/lib/prospeccao/tomadores-al.functions";
import { reporTodasCarteiras } from "@/lib/prospeccao/tomadores-al.functions";

export const Route = createFileRoute("/_authenticated/admin")({
  head: () => ({
    meta: [
      { title: "Administração | Grupo Positive" },
      { name: "description", content: "Painel central de administração do sistema do Grupo Positive." },
      { name: "robots", content: "noindex,nofollow" },
    ],
  }),
  component: AdminHubPage,
});

type AdminLink = {
  to: string;
  label: string;
  description: string;
  icon: typeof ShieldCheck;
};

type AdminSection = {
  title: string;
  description: string;
  links: AdminLink[];
};

const sections: AdminSection[] = [
  {
    title: "Acessos e segurança",
    description:
      "Usuários, permissões por aba, bloqueios, histórico de alterações e incidentes de acesso simultâneo.",
    links: [
      {
        to: "/rh/acessos",
        label: "Usuários e acessos",
        description:
          "Criar contas, liberar abas do RH, bloquear/desbloquear, vincular colaboradores, histórico e incidentes.",
        icon: ShieldCheck,
      },
      {
        to: "/servidores-sem-acesso",
        label: "Servidores sem acesso",
        description: "Leads de servidores que ainda não possuem conta no sistema.",
        icon: Users,
      },
    ],
  },
  {
    title: "Prospecção",
    description: "Importação de bases, distribuição automática de leads, ranking e competições.",
    links: [
      {
        to: "/prospeccao/admin",
        label: "Painel de prospecção",
        description:
          "Importar planilhas, distribuir leads, acompanhar leads e competições, acessos da prospecção.",
        icon: Phone,
      },
      {
        to: "/tomadores-al",
        label: "Tomadores com margem — AL",
        description: "Estoque e distribuição automática de tomadores por faixa de margem.",
        icon: Wallet,
      },
      {
        to: "/radar",
        label: "Radar Diário Oficial",
        description: "Promoções e progressões publicadas no diário oficial, com distribuição automática.",
        icon: Radar,
      },
    ],
  },
  {
    title: "Recursos Humanos",
    description: "Módulo completo de gestão de pessoas.",
    links: [
      {
        to: "/rh",
        label: "Painel de RH",
        description: "Colaboradores, departamentos, cargos, férias, ponto, avaliações, recrutamento e mais.",
        icon: Building2,
      },
    ],
  },
  {
    title: "Produção e competições",
    description: "Metas, ranking e a competição semanal de prospecção.",
    links: [
      { to: "/producao/metas", label: "Metas", description: "Metas de produção da equipe.", icon: Target },
      {
        to: "/producao/ranking",
        label: "Ranking de produção",
        description: "Classificação por volume produzido.",
        icon: Trophy,
      },
      {
        to: "/producao/competicao",
        label: "Competição da semana",
        description: "Prêmio misterioso e regras da competição de prospecção.",
        icon: Trophy,
      },
    ],
  },
  {
    title: "Comunicação e ferramentas",
    description: "Canais de contato e utilitários do dia a dia.",
    links: [
      { to: "/whatsapp", label: "WhatsApp", description: "Central de mensagens integradas.", icon: MessageCircle },
      { to: "/qrcodes", label: "QR Codes", description: "Geração de QR Codes para divulgação.", icon: QrCode },
      {
        to: "/pos-venda/avaliacoes",
        label: "Avaliações",
        description: "Avaliações de pós-venda dos clientes.",
        icon: Star,
      },
    ],
  },
];

function AdminHubPage() {
  const { loading } = useAuth();
  const { isAdmin, isLoading: accessLoading } = useRhAccess();
  const navigate = useNavigate();
  const revogarInativos = useServerFn(revogarAcessosInativosTomadoresAl);
  const reporCarteiras = useServerFn(reporTodasCarteiras);
  const [busyRevoke, setBusyRevoke] = useState(false);
  const [busyRepor, setBusyRepor] = useState(false);

  const handleRevogar = async () => {
    setBusyRevoke(true);
    try {
      const d = await revogarInativos();
      if (d.acessosRevogados === 0 && d.leadsReciclados === 0) {
        toast.info("Nenhum acesso parado há 10+ dias encontrado.");
      } else {
        toast.success(
          `${d.acessosRevogados} acesso(s) revogado(s) · ${d.leadsReciclados} lead(s) reciclado(s) · ${d.distribuidos} redistribuído(s) entre ${d.consultorasAtivas} consultora(s).`,
        );
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Falha ao revogar acessos.");
    }
    setBusyRevoke(false);
  };

  const handleRepor = async () => {
    setBusyRepor(true);
    try {
      const d = await reporCarteiras();
      if (d.atribuidos === 0) {
        toast.info("Todas as carteiras já estão completas.");
      } else {
        toast.success(
          `${d.atribuidos} lead(s) distribuído(s) entre ${d.consultoras} consultora(s).`,
        );
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Falha ao repor carteiras.");
    }
    setBusyRepor(false);
  };

  if (loading || accessLoading) {
    return (
      <AppShell>
        <div className="space-y-4">
          <Skeleton className="h-8 w-64" />
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <Skeleton key={i} className="h-32 w-full" />
            ))}
          </div>
        </div>
      </AppShell>
    );
  }

  if (!isAdmin) return <Navigate to="/" />;

  return (
    <AppShell>
      <div className="mb-6 flex items-center gap-3">
        <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary/10">
          <LayoutDashboard className="h-6 w-6 text-primary" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-foreground">Administração</h1>
          <p className="text-sm text-muted-foreground">
            Central única para administrar todas as funções do sistema.
          </p>
        </div>
      </div>

      {/* Ações rápidas */}
      <section className="mb-8">
        <h2 className="text-base font-semibold text-foreground">Ações rápidas</h2>
        <p className="mb-3 text-sm text-muted-foreground">
          As operações mais usadas do dia a dia, centralizadas aqui.
        </p>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          {/* 1. Revogar acessos inativos */}
          <Card className="flex flex-col justify-between border-destructive/30">
            <CardHeader className="pb-2">
              <div className="flex items-center gap-3">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-destructive/10">
                  <UserX className="h-4 w-4 text-destructive" />
                </div>
                <CardTitle className="text-sm">Excluir acessos inativos</CardTitle>
              </div>
            </CardHeader>
            <CardContent className="flex flex-1 flex-col justify-between gap-3 pt-0">
              <p className="text-xs text-muted-foreground">
                Bloqueia o login de consultoras sem acesso há 10+ dias (reversível), devolve os leads
                delas ao estoque e redistribui automaticamente entre as ativas.
              </p>
              <Button
                variant="destructive"
                size="sm"
                className="w-full"
                disabled={busyRevoke}
                onClick={handleRevogar}
              >
                <UserX className="mr-2 h-3.5 w-3.5" />
                {busyRevoke ? "Revogando…" : "Revogar e redistribuir"}
              </Button>
            </CardContent>
          </Card>

          {/* 2. Alterar senha / e-mail */}
          <Card className="flex flex-col justify-between">
            <CardHeader className="pb-2">
              <div className="flex items-center gap-3">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-muted">
                  <KeyRound className="h-4 w-4 text-foreground" />
                </div>
                <CardTitle className="text-sm">Alterar senha e e-mail</CardTitle>
              </div>
            </CardHeader>
            <CardContent className="flex flex-1 flex-col justify-between gap-3 pt-0">
              <p className="text-xs text-muted-foreground">
                Edite o e-mail ou senha de qualquer consultora, gere link de redefinição, bloqueie ou
                exclua contas. Tudo na tela de Acessos ao RH.
              </p>
              <Button
                variant="outline"
                size="sm"
                className="w-full justify-between"
                onClick={() => navigate({ to: "/rh/acessos" })}
              >
                Abrir Acessos <ArrowRight className="h-3.5 w-3.5" />
              </Button>
            </CardContent>
          </Card>

          {/* 3. Distribuição automática */}
          <Card className="flex flex-col justify-between">
            <CardHeader className="pb-2">
              <div className="flex items-center gap-3">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/10">
                  <Shuffle className="h-4 w-4 text-primary" />
                </div>
                <CardTitle className="text-sm">Distribuição de leads</CardTitle>
              </div>
            </CardHeader>
            <CardContent className="flex flex-1 flex-col justify-between gap-3 pt-0">
              <p className="text-xs text-muted-foreground">
                A distribuição é automática: cada consultora recebe 10 leads por faixa e a reposição
                acontece conforme ela finaliza. Use o botão abaixo para forçar a reposição agora.
              </p>
              <Button
                variant="secondary"
                size="sm"
                className="w-full"
                disabled={busyRepor}
                onClick={handleRepor}
              >
                <Shuffle className="mr-2 h-3.5 w-3.5" />
                {busyRepor ? "Repondo…" : "Repor todas as carteiras agora"}
              </Button>
            </CardContent>
          </Card>
        </div>
      </section>

      <div className="space-y-8">
        {sections.map((sec) => (
          <section key={sec.title}>
            <h2 className="text-base font-semibold text-foreground">{sec.title}</h2>
            <p className="mb-3 text-sm text-muted-foreground">{sec.description}</p>
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
              {sec.links.map((l) => (
                <Card key={l.to} className="flex flex-col justify-between transition hover:shadow-md">
                  <CardHeader className="pb-2">
                    <div className="flex items-center gap-3">
                      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-muted">
                        <l.icon className="h-4 w-4 text-foreground" />
                      </div>
                      <CardTitle className="text-sm">{l.label}</CardTitle>
                    </div>
                  </CardHeader>
                  <CardContent className="flex flex-1 flex-col justify-between gap-3 pt-0">
                    <p className="text-xs text-muted-foreground">{l.description}</p>
                    <Button asChild variant="outline" size="sm" className="w-full justify-between">
                      <Link to={l.to}>
                        Abrir <ArrowRight className="h-3.5 w-3.5" />
                      </Link>
                    </Button>
                  </CardContent>
                </Card>
              ))}
            </div>
          </section>
        ))}
      </div>
    </AppShell>
  );
}
