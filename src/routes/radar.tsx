import { createFileRoute, Link, Outlet, useLocation, Navigate } from "@tanstack/react-router";
import { AppShell } from "@/components/AppShell";
import { useAuth } from "@/lib/auth";
import { Radar, LayoutDashboard, Upload, List, FileText, ShieldAlert, Loader2 } from "lucide-react";

export const Route = createFileRoute("/radar")({
  head: () => ({
    meta: [
      { title: "Radar Diário Oficial" },
      {
        name: "description",
        content:
          "Importe e analise Diários Oficiais para encontrar promoções, progressões e movimentações de servidores.",
      },
      { name: "robots", content: "noindex,nofollow" },
    ],
  }),
  component: RadarLayout,
});

const tabs = [
  { to: "/radar", label: "Dashboard", icon: LayoutDashboard, exact: true },
  { to: "/radar/importar", label: "Importar", icon: Upload },
  { to: "/radar/registros", label: "Registros", icon: List },
  { to: "/radar/arquivos", label: "Arquivos", icon: FileText },
];

function RadarLayout() {
  const { user, loading } = useAuth();
  const loc = useLocation();

  if (loading) {
    return (
      <AppShell>
        <div className="flex min-h-[40vh] items-center justify-center text-muted-foreground">
          <Loader2 className="h-6 w-6 animate-spin" />
        </div>
      </AppShell>
    );
  }
  if (!user) return <Navigate to="/login" />;

  return (
    <AppShell>
      <div className="space-y-5">
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary/10 text-primary">
            <Radar className="h-6 w-6" />
          </div>
          <div>
            <h1 className="text-xl font-bold leading-tight md:text-2xl">Radar Diário Oficial</h1>
            <p className="text-sm text-muted-foreground">
              Encontre promoções, progressões e movimentações de servidores em poucos segundos.
            </p>
          </div>
        </div>

        <nav className="flex flex-wrap gap-2 border-b pb-2">
          {tabs.map((t) => {
            const active = t.exact
              ? loc.pathname === t.to
              : loc.pathname === t.to || loc.pathname.startsWith(t.to + "/");
            const Icon = t.icon;
            return (
              <Link
                key={t.to}
                to={t.to}
                className={`flex items-center gap-2 rounded-md px-3 py-2 text-sm font-medium transition ${
                  active
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:bg-muted"
                }`}
              >
                <Icon className="h-4 w-4" />
                {t.label}
              </Link>
            );
          })}
        </nav>

        <Outlet />

        <div className="mt-8 flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900 dark:border-amber-900/40 dark:bg-amber-950/30 dark:text-amber-200">
          <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0" />
          <p>
            Este sistema organiza informações públicas extraídas de publicações oficiais. O uso dos
            dados deve respeitar a LGPD, finalidade legítima, transparência e boas práticas de
            tratamento de dados.
          </p>
        </div>
      </div>
    </AppShell>
  );
}
