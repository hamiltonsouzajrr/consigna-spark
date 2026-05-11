import { Link, useLocation, useNavigate } from "@tanstack/react-router";
import { LayoutDashboard, Upload, List, LogOut, BadgeDollarSign, Calculator, Trash2 } from "lucide-react";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { HorariosOuroDialog } from "@/components/HorariosOuroDialog";
import type { ReactNode } from "react";

const nav = [
  { to: "/alagoas", label: "Alagoas — Simulação", icon: Calculator },
  { to: "/calculadora-al", label: "Calculadora de Margem — AL", icon: Calculator },
  { to: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { to: "/upload", label: "Importar", icon: Upload },
  { to: "/consultas", label: "Consultas", icon: List },
  { to: "/limpeza", label: "Limpeza", icon: Trash2 },
];

export function AppShell({ children }: { children: ReactNode }) {
  const { signOut, user } = useAuth();
  const nav2 = useNavigate();
  const loc = useLocation();
  return (
    <div className="flex min-h-screen bg-background">
      <HorariosOuroDialog />
      <aside className="hidden w-64 shrink-0 border-r bg-sidebar md:flex md:flex-col">
        <div className="flex items-center gap-2 px-6 py-5 border-b">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary text-primary-foreground">
            <BadgeDollarSign className="h-5 w-5" />
          </div>
          <div>
            <p className="text-sm font-semibold leading-tight">Grupo Positive</p>
            <p className="text-xs text-muted-foreground">Consultas e simulação</p>
          </div>
        </div>
        <nav className="flex-1 space-y-1 p-3">
          {nav.map((n) => {
            const active = loc.pathname.startsWith(n.to);
            const Icon = n.icon;
            return (
              <Link
                key={n.to}
                to={n.to}
                className={`flex items-center gap-3 rounded-md px-3 py-2 text-sm transition ${
                  active
                    ? "bg-primary text-primary-foreground"
                    : "text-sidebar-foreground hover:bg-sidebar-accent"
                }`}
              >
                <Icon className="h-4 w-4" />
                {n.label}
              </Link>
            );
          })}
        </nav>
        <div className="border-t p-3">
          <p className="px-3 pb-2 text-xs text-muted-foreground truncate">{user?.email}</p>
          <Button
            variant="ghost"
            className="w-full justify-start gap-2"
            onClick={async () => { await signOut(); nav2({ to: "/login" }); }}
          >
            <LogOut className="h-4 w-4" /> Sair
          </Button>
        </div>
      </aside>
      <main className="flex-1 overflow-x-hidden">
        <div className="md:hidden flex items-center justify-between border-b bg-card px-4 py-3">
          <div className="flex items-center gap-2">
            <BadgeDollarSign className="h-5 w-5 text-primary" />
            <span className="font-semibold">Grupo Positive</span>
          </div>
          <div className="flex gap-1">
            {nav.map((n) => (
              <Link key={n.to} to={n.to} className="px-2 py-1 text-xs rounded hover:bg-accent">
                {n.label}
              </Link>
            ))}
          </div>
        </div>
        <div className="mx-auto max-w-7xl p-4 md:p-8">{children}</div>
      </main>
    </div>
  );
}
