import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { AppShell } from "@/components/AppShell";
import { AdminGate } from "@/components/security/AdminGate";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { ConfirmDialog } from "@/components/prospeccao/admin/ConfirmDialog";
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
  ChevronDown,
  Activity,
  AlertTriangle,
} from "lucide-react";
import {
  revogarAcessosInativosTomadoresAl,
  reporTodasCarteiras,
} from "@/lib/prospeccao/tomadores-al.functions";
import { getAdminHealth } from "@/lib/admin/health.functions";

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
  collapsed?: boolean;
};

// Blocos ordenados por frequência de uso real.
const sections: AdminSection[] = [
  {
    title: "Operação diária",
    description: "O que se usa todos os dias: acessos, prospecção, radar e estoque de tomadores.",
    links: [
      {
        to: "/rh/acessos",
        label: "Usuários e acessos",
        description:
          "Criar contas, liberar abas, bloquear/desbloquear, vincular colaboradores, histórico e incidentes.",
        icon: ShieldCheck,
      },
      {
        to: "/prospeccao/admin",
        label: "Painel de prospecção",
        description: "Importar planilhas, distribuir leads, lotes e acessos da prospecção.",
        icon: Phone,
      },
      {
        to: "/radar",
        label: "Radar Diário Oficial",
        description: "Promoções e progressões publicadas, com distribuição automática às consultoras.",
        icon: Radar,
      },
      {
        to: "/tomadores-al",
        label: "Tomadores com margem — AL",
        description: "Estoque e distribuição automática por faixa de margem.",
        icon: Wallet,
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
    title: "Gestão",
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
    title: "Módulos opcionais",
    description: "Usados pontualmente. Recolhidos para não competir com a operação.",
    collapsed: true,
    links: [
      {
        to: "/rh",
        label: "Painel de RH completo",
        description: "Colaboradores, férias, ponto, avaliações, recrutamento e demais módulos de pessoas.",
        icon: Building2,
      },
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

function HealthPanel() {
  const fetchHealth = useServerFn(getAdminHealth);
  const q = useQuery({
    queryKey: ["admin", "health"],
    queryFn: () => fetchHealth(),
    staleTime: 60_000,
    refetchOnWindowFocus: false,
  });

  if (q.isPending) {
    return (
      <div className="mb-8 grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-6">
        {Array.from({ length: 6 }).map((_, i) => (
          <Skeleton key={i} className="h-20 w-full" />
        ))}
      </div>
    );
  }
  if (q.isError || !q.data) {
    return (
      <Card className="mb-8 p-4 text-sm text-muted-foreground">
        Não foi possível carregar o painel de saúde.{" "}
        <Button variant="link" size="sm" onClick={() => q.refetch()}>
          Tentar novamente
        </Button>
      </Card>
    );
  }

  const h = q.data;
  const items: Array<{ label: string; value: string; to: string; alert?: boolean }> = [
    {
      label: "Última busca do Radar",
      value: h.radarUltimaExecucao
        ? new Date(h.radarUltimaExecucao).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" })
        : "nunca",
      to: "/radar/busca-diaria",
      alert:
        !h.radarUltimaExecucao ||
        Date.now() - new Date(h.radarUltimaExecucao).getTime() > 8 * 864e5,
    },
    {
      label: "Promovidos sem consultora",
      value: String(h.promovidosSemConsultora),
      to: "/prospeccao/admin",
      alert: h.promovidosSemConsultora > 0,
    },
    {
      label: "Tomadores livres no estoque",
      value: String(h.tomadoresLivres),
      to: "/tomadores-al",
      alert: h.tomadoresLivres < 50,
    },
    {
      label: "Consultoras inativas 7+ dias",
      value: `${h.consultorasInativas7d}/${h.consultorasAtivas}`,
      to: "/rh/acessos",
      alert: h.consultorasInativas7d > 0,
    },
    {
      label: "Incidentes em aberto",
      value: String(h.incidentesAbertos),
      to: "/rh/acessos",
      alert: h.incidentesAbertos > 0,
    },
    {
      label: "Administradores",
      value: String(h.admins),
      to: "/rh/acessos",
      alert: h.admins < 2,
    },
  ];

  return (
    <section className="mb-8">
      <h2 className="flex items-center gap-2 text-base font-semibold text-foreground">
        <Activity className="h-4 w-4 text-primary" /> Saúde da operação
      </h2>
      <p className="mb-3 text-sm text-muted-foreground">
        Cada indicador leva direto à tela onde o problema é resolvido.
      </p>
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-6">
        {items.map((it) => (
          <Link
            key={it.label}
            to={it.to}
            className={`rounded-xl border bg-card p-3 transition hover:shadow-md ${
              it.alert ? "border-amber-500/50" : ""
            }`}
          >
            <div className="flex items-center justify-between">
              <span className="text-lg font-bold text-foreground">{it.value}</span>
              {it.alert && <AlertTriangle className="h-3.5 w-3.5 text-amber-500" />}
            </div>
            <p className="mt-0.5 text-[11px] leading-tight text-muted-foreground">{it.label}</p>
          </Link>
        ))}
      </div>
      {h.admins < 2 && (
        <p className="mt-2 text-xs text-amber-600 dark:text-amber-400">
          Existe apenas 1 administrador. Promova uma segunda conta em Acessos para não perder o controle
          do sistema se essa conta for bloqueada.
        </p>
      )}
    </section>
  );
}

function SectionBlock({ sec }: { sec: AdminSection }) {
  const [open, setOpen] = useState(!sec.collapsed);
  return (
    <section>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center gap-2 text-left"
      >
        <h2 className="text-base font-semibold text-foreground">{sec.title}</h2>
        <Badge variant="secondary" className="text-[10px]">{sec.links.length}</Badge>
        <ChevronDown className={`h-4 w-4 text-muted-foreground transition ${open ? "rotate-180" : ""}`} />
      </button>
      <p className="mb-3 text-sm text-muted-foreground">{sec.description}</p>
      {open && (
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
      )}
    </section>
  );
}

function AdminHubPage() {
  return (
    <AdminGate>
      <AdminHubContent />
    </AdminGate>
  );
}

function AdminHubContent() {
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
        toast.success(`${d.atribuidos} lead(s) distribuído(s) entre ${d.consultoras} consultora(s).`);
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Falha ao repor carteiras.");
    }
    setBusyRepor(false);
  };

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

      <HealthPanel />

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
              <ConfirmDialog
                title="Revogar acessos inativos?"
                description="Consultoras sem acesso há 10 dias ou mais serão bloqueadas e os leads delas voltarão ao estoque para redistribuição."
                confirmLabel="Revogar e redistribuir"
                destructive
                requireText="REVOGAR"
                onConfirm={handleRevogar}
              >
                <Button variant="destructive" size="sm" className="w-full" disabled={busyRevoke}>
                  <UserX className="mr-2 h-3.5 w-3.5" />
                  {busyRevoke ? "Revogando…" : "Revogar e redistribuir"}
                </Button>
              </ConfirmDialog>
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
                Edite o e-mail ou senha de qualquer consultora, gere link de redefinição, promova
                administradores, bloqueie ou exclua contas.
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
              <ConfirmDialog
                title="Repor todas as carteiras agora?"
                description="Todas as consultoras ativas receberão leads até completar 10 por faixa de margem."
                confirmLabel="Repor agora"
                onConfirm={handleRepor}
              >
                <Button variant="secondary" size="sm" className="w-full" disabled={busyRepor}>
                  <Shuffle className="mr-2 h-3.5 w-3.5" />
                  {busyRepor ? "Repondo…" : "Repor todas as carteiras agora"}
                </Button>
              </ConfirmDialog>
            </CardContent>
          </Card>
        </div>
      </section>

      <div className="space-y-8">
        {sections.map((sec) => (
          <SectionBlock key={sec.title} sec={sec} />
        ))}
      </div>
    </AppShell>
  );
}
