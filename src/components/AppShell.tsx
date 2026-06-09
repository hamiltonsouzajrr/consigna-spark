import { Link, useLocation, useNavigate } from "@tanstack/react-router";
import { LayoutDashboard, Upload, List, LogOut, BadgeDollarSign, Calculator, Trash2, ShieldCheck, TrendingUp, Search, QrCode, Menu, Users, MessageCircle, Target, Phone, Flame, CalendarClock, Home, Trophy, Star, MessageSquare } from "lucide-react";
import { useEffect, useState } from "react";
import { useAuth } from "@/lib/auth";
import { useRhAccess } from "@/hooks/use-rh-access";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { HorariosOuroDialog } from "@/components/HorariosOuroDialog";
import { HorariosOuroReminder } from "@/components/HorariosOuroReminder";
import type { ReactNode } from "react";

type BadgeKind = "leads" | "followups";
type NavItem = { to: string; label: string; full?: string; icon: typeof Calculator; badge?: BadgeKind; exact?: boolean; adminOnly?: boolean };
type NavSection = { section: string; items: NavItem[] };

const navSections: NavSection[] = [
  {
    section: "Simulação",
    items: [
      { to: "/alagoas", label: "Prévia AL – Todos Bancos", full: "SIMULAÇÃO PRÉVIA ALAGOAS - TODOS BANCOS", icon: Calculator },
      { to: "/calculadora-al", label: "Contracheque – GOV AL", full: "CALCULADORA POR CONTRA CHEQUE - GOV AL", icon: Calculator },
      { to: "/simulacao-alagoas", label: "Banese", full: "SIMULAÇÃO BANESE", icon: Calculator },
    ],
  },
  {
    section: "Prospecção",
    items: [
      { to: "/prospeccao", label: "CRM", full: "CRM DE PROSPECÇÃO - FILA, SCORE E FOLLOW-UP", icon: Phone, exact: true },
      { to: "/pesquisas", label: "Pesquisas", icon: Search },
      { to: "/safe-consig", label: "SafeConsig", icon: ShieldCheck },
      { to: "/servidores-sem-acesso", label: "Servidores sem acesso", icon: Users, badge: "leads" },
      { to: "/prospeccao/recentes", label: "Recentes Prospectados", icon: Flame },
      { to: "/prospeccao/followups", label: "Follow-ups", icon: CalendarClock, badge: "followups" },
    ],
  },
  {
    section: "Produção",
    items: [
      { to: "/producao/meu-dia", label: "Meu Dia", icon: Home },
      { to: "/upload", label: "Importações", icon: Upload },
      { to: "/consultas", label: "Consultas", icon: List },
      { to: "/limpeza", label: "Limpeza", icon: Trash2 },
      { to: "/rh/ranking", label: "Ranking", icon: Trophy },
      { to: "/producao/metas", label: "Metas", icon: Target },
    ],
  },
  {
    section: "Pós-venda",
    items: [
      { to: "/pos-venda/avaliacoes", label: "Avaliações", icon: Star },
      { to: "/qrcodes", label: "QR Codes", icon: QrCode },
      { to: "/pos-venda/feedbacks", label: "Feedbacks", icon: MessageSquare },
    ],
  },
  {
    section: "Painel",
    items: [
      { to: "/dashboard", label: "Dashboard", icon: LayoutDashboard, exact: true },
      { to: "/rh", label: "RH", icon: Users },
      { to: "/whatsapp", label: "WhatsApp", icon: MessageCircle },
      { to: "/gravacoes-juridicas", label: "Gravações Jurídicas", icon: ShieldCheck, adminOnly: true },
    ],
  },
];



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

function useFollowupsCount(enabled: boolean) {
  const [count, setCount] = useState<number | null>(null);
  useEffect(() => {
    if (!enabled) return;
    let cancelled = false;
    const load = async () => {
      const { count, error } = await supabase
        .from("prospect_leads")
        .select("id", { count: "exact", head: true })
        .not("next_follow_up_at", "is", null)
        .lte("next_follow_up_at", new Date().toISOString())
        .not("status", "in", "(ganho,perdido)");
      if (!cancelled && !error) setCount(count ?? 0);
    };
    load();
    const ch = supabase
      .channel("prospect_leads_followups_count")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "prospect_leads" },
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
  const { isAdmin } = useRhAccess();
  const sections = navSections
    .map((s) => ({ ...s, items: s.items.filter((n) => !n.adminOnly || isAdmin) }))
    .filter((s) => s.items.length > 0);
  const nav2 = useNavigate();
  const loc = useLocation();
  const leadsCount = useLeadsCount(!!user);
  const followupsCount = useFollowupsCount(!!user);
  const [mobileOpen, setMobileOpen] = useState(false);

  const renderItem = (n: NavItem, onClick?: () => void) => {
    const active = n.exact
      ? loc.pathname === n.to
      : loc.pathname === n.to || loc.pathname.startsWith(n.to + "/");
    const Icon = n.icon;
    const count = n.badge === "leads" ? leadsCount : n.badge === "followups" ? followupsCount : null;
    const baseTone =
      n.badge === "followups" ? "bg-orange-500 text-white hover:bg-orange-600" : "bg-emerald-600 text-white hover:bg-emerald-700";
    return (
      <Link
        key={n.to}
        to={n.to}
        title={n.full ?? n.label}
        onClick={onClick}
        className={`flex items-center gap-3 rounded-md px-3 py-2 text-sm transition ${
          active ? "bg-primary text-primary-foreground" : "text-sidebar-foreground hover:bg-sidebar-accent"
        }`}
      >
        <Icon className="h-4 w-4 shrink-0" />
        <span className="flex-1 truncate">{n.label}</span>
        {n.badge && count !== null && count > 0 && (
          <Badge
            className={`h-5 min-w-5 justify-center border-0 px-1.5 text-xs ${
              active ? "bg-white/20 text-white hover:bg-white/20" : baseTone
            }`}
          >
            {count}
          </Badge>
        )}
      </Link>
    );
  };

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
        <nav className="flex-1 space-y-1 overflow-y-auto p-3">
          {sections.map((sec, idx) => (
            <div key={sec.section} className="space-y-1">
              <p className={`px-3 pb-1 text-xs uppercase tracking-wider text-muted-foreground ${idx === 0 ? "pt-1" : "pt-4"}`}>
                {sec.section}
              </p>
              {sec.items.map((n) => renderItem(n))}
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
          <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
            <SheetTrigger asChild>
              <Button variant="ghost" size="icon" className="relative">
                <Menu className="h-5 w-5" />
                {((leadsCount ?? 0) > 0 || (followupsCount ?? 0) > 0) && (
                  <span className="absolute right-1 top-1 h-2 w-2 rounded-full bg-orange-500" />
                )}
              </Button>
            </SheetTrigger>
            <SheetContent side="left" className="w-72 bg-sidebar p-0">
              <SheetHeader className="border-b px-6 py-5 text-left">
                <SheetTitle className="flex items-center gap-2">
                  <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary text-primary-foreground">
                    <BadgeDollarSign className="h-5 w-5" />
                  </span>
                  <span>
                    <span className="block text-sm font-semibold leading-tight">Grupo Positive</span>
                    <span className="block text-xs font-normal text-muted-foreground">Consultas e simulação</span>
                  </span>
                </SheetTitle>
              </SheetHeader>
              <nav className="flex-1 space-y-1 overflow-y-auto p-3">
                {sections.map((sec, idx) => (
                  <div key={sec.section} className="space-y-1">
                    <p className={`px-3 pb-1 text-xs uppercase tracking-wider text-muted-foreground ${idx === 0 ? "pt-1" : "pt-4"}`}>
                      {sec.section}
                    </p>
                    {sec.items.map((n) => renderItem(n, () => setMobileOpen(false)))}
                  </div>
                ))}
              </nav>
              <div className="border-t p-3">
                <p className="px-3 pb-2 text-xs text-muted-foreground truncate">{user?.email}</p>
                <Button
                  variant="ghost"
                  className="w-full justify-start gap-2"
                  onClick={async () => { setMobileOpen(false); await signOut(); nav2({ to: "/login" }); }}
                >
                  <LogOut className="h-4 w-4" /> Sair
                </Button>
              </div>
            </SheetContent>
          </Sheet>
        </div>
        <div className="mx-auto max-w-7xl p-4 md:p-8 print:max-w-none print:p-0">{children}</div>

      </main>
    </div>
  );
}
