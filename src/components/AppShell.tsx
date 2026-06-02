import { Link, useLocation, useNavigate } from "@tanstack/react-router";
import { LayoutDashboard, Upload, List, LogOut, BadgeDollarSign, Calculator, Trash2, ShieldCheck, TrendingUp, Search, FileText } from "lucide-react";
import { useEffect, useState } from "react";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { HorariosOuroDialog } from "@/components/HorariosOuroDialog";
import { HorariosOuroReminder } from "@/components/HorariosOuroReminder";
import type { ReactNode } from "react";

type NavItem = { to: string; label: string; icon: typeof Calculator; badge?: boolean };
type NavSection = { section: string; items: NavItem[] };

const navSections: NavSection[] = [
  {
    section: "Simulação",
    items: [
      { to: "/alagoas", label: "Simulação ALAGOAS", icon: Calculator },
      { to: "/calculadora-al", label: "Calculadora ALAGOAS", icon: Calculator },
    ],
  },
  {
    section: "Prospecção",
    items: [
      { to: "/pesquisas", label: "Pesquisas", icon: Search },
      { to: "/safe-consig", label: "Verificar SafeConsig", icon: ShieldCheck },
      { to: "/servidores-sem-acesso", label: "Servidores sem acesso", icon: TrendingUp, badge: true },
      { to: "/contrato", label: "Gerar Contrato", icon: FileText },
    ],
  },
  {
    section: "Processamento",
    items: [
      { to: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
      { to: "/upload", label: "Importar", icon: Upload },
      { to: "/consultas", label: "Consultas", icon: List },
      { to: "/limpeza", label: "Limpeza", icon: Trash2 },
    ],
  },
];

const nav: NavItem[] = navSections.flatMap((s) => s.items);

function useLeadsCount(enabled: boolean) {
  const [count, setCount] = useState<number | null>(null);
  useEffect(() => {
    if (!enabled) return;
    let cancelled = false;
    const load = async () => {
      const { count, error } = await supabase
        .from("safeconsig_leads")
        .select("id", { count: "exact", head: true })
        .eq("status", "sem_email");
      if (!cancelled && !error) setCount(count ?? 0);
    };
    load();
    const ch = supabase
      .channel("safeconsig_leads_count")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "safeconsig_leads" },
        () => load(),
      )
      .subscribe();
    return () => {
      cancelled = true;
      supabase.removeChannel(ch);
    };
  }, [enabled]);
  return count;
}

export function AppShell({ children }: { children: ReactNode }) {
  const { signOut, user } = useAuth();
  const nav2 = useNavigate();
  const loc = useLocation();
  const leadsCount = useLeadsCount(!!user);
  return (
    <div className="flex min-h-screen bg-background print:block print:min-h-0">
      <HorariosOuroDialog />
      <HorariosOuroReminder />
      <aside className="hidden w-64 shrink-0 border-r bg-sidebar md:flex md:flex-col print:!hidden">

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
          {navSections.map((sec, idx) => (
            <div key={sec.section} className="space-y-1">
              <p className={`px-3 pb-1 text-xs uppercase tracking-wider text-muted-foreground ${idx === 0 ? "pt-1" : "pt-4"}`}>
                {sec.section}
              </p>
              {sec.items.map((n) => {
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
                    <span className="flex-1">{n.label}</span>
                    {n.badge && leadsCount !== null && leadsCount > 0 && (
                      <Badge
                        className={`h-5 min-w-5 justify-center border-0 px-1.5 text-xs ${
                          active
                            ? "bg-white/20 text-white hover:bg-white/20"
                            : "bg-emerald-600 text-white hover:bg-emerald-700"
                        }`}
                      >
                        {leadsCount}
                      </Badge>
                    )}
                  </Link>
                );
              })}
            </div>
          ))}
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
      <main className="flex-1 overflow-x-hidden print:overflow-visible">
        <div className="md:hidden flex items-center justify-between border-b bg-card px-4 py-3 print:!hidden">

          <div className="flex items-center gap-2">
            <BadgeDollarSign className="h-5 w-5 text-primary" />
            <span className="font-semibold">Grupo Positive</span>
          </div>
          <div className="flex gap-1 flex-wrap">
            {nav.map((n) => (
              <Link key={n.to} to={n.to} className="px-2 py-1 text-xs rounded hover:bg-accent flex items-center gap-1">
                {n.label}
                {n.badge && leadsCount !== null && leadsCount > 0 && (
                  <Badge className="h-4 min-w-4 justify-center border-0 bg-emerald-600 px-1 text-[10px] text-white hover:bg-emerald-700">
                    {leadsCount}
                  </Badge>
                )}
              </Link>
            ))}
          </div>
        </div>
        <div className="mx-auto max-w-7xl p-4 md:p-8">{children}</div>
      </main>
    </div>
  );
}
