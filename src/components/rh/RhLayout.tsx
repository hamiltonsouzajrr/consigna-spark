import { Link, useLocation } from "@tanstack/react-router";
import type { ReactNode } from "react";
import {
  LayoutDashboard, Users, Building2, BriefcaseBusiness, Plane, Clock,
  FileText, GraduationCap, Laptop, Star, AlertTriangle, UserSearch,
  ClipboardCheck, UserMinus, Network, ReceiptText, HeartHandshake,
  Target, Gauge, TrendingDown, Trophy, IdCard,
  Goal, Award, ShieldCheck, Lock, LineChart,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { useRhAccess } from "@/hooks/use-rh-access";
import { NotificationBell } from "@/components/rh/NotificationBell";

export const rhNav = [
  { to: "/rh/dashboard", label: "Dashboard RH", icon: LayoutDashboard },
  { to: "/rh/colaboradores", label: "Colaboradores", icon: Users },
  { to: "/rh/organograma", label: "Organograma", icon: Network },
  { to: "/rh/departamentos", label: "Departamentos", icon: Building2 },
  { to: "/rh/cargos", label: "Cargos", icon: BriefcaseBusiness },
  { to: "/rh/ferias", label: "Férias e Licenças", icon: Plane },
  { to: "/rh/banco-horas", label: "Banco de Horas", icon: Clock },
  { to: "/rh/holerites", label: "Holerites", icon: ReceiptText },
  
  { to: "/rh/documentos", label: "Documentos", icon: FileText },
  { to: "/rh/equipamentos", label: "Equipamentos", icon: Laptop },
  { to: "/rh/treinamentos", label: "Treinamentos", icon: GraduationCap },
  { to: "/rh/avaliacoes", label: "Avaliações de Desempenho", icon: Star },
  { to: "/rh/pdi", label: "PDI", icon: Target },
  { to: "/rh/clima", label: "Clima Organizacional", icon: Gauge },
  
  { to: "/rh/turnover", label: "Predição de Turnover", icon: TrendingDown },
  { to: "/rh/ranking", label: "Ranking", icon: Trophy },
  { to: "/rh/portal", label: "Portal do Colaborador", icon: IdCard },
  { to: "/rh/okrs", label: "OKRs", icon: Goal },
  { to: "/rh/reconhecimentos", label: "Reconhecimentos", icon: Award },
  { to: "/rh/ocorrencias", label: "Ocorrências", icon: AlertTriangle },
  { to: "/rh/recrutamento", label: "Recrutamento", icon: UserSearch },
  { to: "/rh/onboarding", label: "Onboarding", icon: ClipboardCheck },
  { to: "/rh/desligamentos", label: "Desligamentos", icon: UserMinus },
  { to: "/rh/producao", label: "Produção", icon: LineChart },
] as const;

// Admin-only entries (appended for admins, hidden from everyone else).
export const rhAdminNav = [
  { to: "/rh/acessos", label: "Acessos", icon: ShieldCheck },
] as const;

// Tabs only admins may open even if granted elsewhere.
const ADMIN_ONLY = new Set<string>(["/rh/acessos"]);

export function RhLayout({ children }: { children: ReactNode }) {
  const loc = useLocation();
  const { isAdmin, isAccessManager, canAccess, isLoading } = useRhAccess();

  // Gestores de acessos também podem abrir a aba de Acessos (sem poderes
  // destrutivos, que continuam restritos ao admin dentro da própria tela).
  const canOpenAdminOnly = isAdmin || isAccessManager;

  const items = [...rhNav, ...(canOpenAdminOnly ? rhAdminNav : [])].filter((n) => {
    if (ADMIN_ONLY.has(n.to)) return canOpenAdminOnly;
    if (isAdmin) return true;
    // While access is still loading, only show the always-allowed tabs to
    // avoid flashing restricted entries to a non-admin user.
    return canAccess(n.to);
  });

  // Resolve the most specific nav entry matching the current path.
  const current = [...rhNav, ...rhAdminNav]
    .filter((n) => loc.pathname.startsWith(n.to))
    .sort((a, b) => b.to.length - a.to.length)[0];

  const denied =
    !isLoading &&
    !!current &&
    (ADMIN_ONLY.has(current.to) ? !canOpenAdminOnly : !canAccess(current.to));


  return (
    <div className="flex flex-col gap-6 lg:flex-row">
      <aside className="lg:w-60 lg:shrink-0">
        <nav className="flex gap-1 overflow-x-auto rounded-xl border bg-card p-2 lg:flex-col lg:overflow-visible">
          {items.map((n) => {
            const active = loc.pathname.startsWith(n.to);
            const Icon = n.icon;
            return (
              <Link
                key={n.to}
                to={n.to}
                className={cn(
                  "flex shrink-0 items-center gap-2.5 whitespace-nowrap rounded-lg px-3 py-2 text-sm font-medium transition-all duration-200",
                  active
                    ? "bg-gradient-to-r from-primary to-blue-500 text-primary-foreground shadow-sm shadow-primary/25"
                    : "text-muted-foreground hover:bg-muted hover:text-foreground active:scale-[0.98]",
                )}
              >
                <Icon className="h-4 w-4 shrink-0" />
                <span>{n.label}</span>
              </Link>
            );
          })}
        </nav>
      </aside>
      <div className="min-w-0 flex-1">
        <div className="mb-4 flex justify-end">
          <NotificationBell />
        </div>
        {denied ? (
          <div className="flex flex-col items-center justify-center gap-3 rounded-xl border bg-card py-20 text-center">
            <Lock className="h-10 w-10 text-muted-foreground" />
            <p className="font-medium">Você não tem acesso a esta área</p>
            <p className="max-w-sm text-sm text-muted-foreground">
              Solicite ao administrador a liberação desta aba do RH.
            </p>
          </div>
        ) : (
          children
        )}
      </div>

    </div>
  );
}

export function RhPageHeader({
  title,
  description,
  actions,
}: {
  title: string;
  description?: string;
  actions?: ReactNode;
}) {
  return (
    <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">{title}</h1>
        {description && <p className="mt-1 text-sm text-muted-foreground">{description}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}

const statusStyles: Record<string, string> = {
  // colaborador
  Ativo: "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-400",
  Afastado: "bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-400",
  Férias: "bg-sky-100 text-sky-700 dark:bg-sky-500/15 dark:text-sky-400",
  Desligado: "bg-rose-100 text-rose-700 dark:bg-rose-500/15 dark:text-rose-400",
  // genéricos
  Aprovado: "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-400",
  Pendente: "bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-400",
  Recusado: "bg-rose-100 text-rose-700 dark:bg-rose-500/15 dark:text-rose-400",
  "Concluído": "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-400",
  Vencido: "bg-rose-100 text-rose-700 dark:bg-rose-500/15 dark:text-rose-400",
  "Em uso": "bg-sky-100 text-sky-700 dark:bg-sky-500/15 dark:text-sky-400",
  Devolvido: "bg-muted text-muted-foreground",
  "Manutenção": "bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-400",
  "Advertência": "bg-rose-100 text-rose-700 dark:bg-rose-500/15 dark:text-rose-400",
  Elogio: "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-400",
  "Suspensão": "bg-rose-100 text-rose-700 dark:bg-rose-500/15 dark:text-rose-400",
  "Observação": "bg-sky-100 text-sky-700 dark:bg-sky-500/15 dark:text-sky-400",
};

export function StatusBadge({ status }: { status: string }) {
  return (
    <Badge
      variant="secondary"
      className={cn("border-0 font-medium", statusStyles[status] ?? "bg-muted text-muted-foreground")}
    >
      {status}
    </Badge>
  );
}
