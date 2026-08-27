import { createFileRoute, Navigate, Link } from "@tanstack/react-router";
import { useAuth } from "@/lib/auth";
import { useRhAccess } from "@/hooks/use-rh-access";
import { AppShell } from "@/components/AppShell";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
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
} from "lucide-react";

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

// Central única de administração: agrupa links para os painéis já existentes
// no sistema, organizados por área. Não duplica a lógica de cada painel —
// apenas facilita encontrar e navegar entre eles.
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
