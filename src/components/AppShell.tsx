import { Link, useLocation, useNavigate } from "@tanstack/react-router";
import { LayoutDashboard, Upload, List, LogOut, BadgeDollarSign, Calculator, Trash2, ShieldCheck, TrendingUp, Search, QrCode, Menu, Users, MessageCircle, Target, Phone, PhoneCall, Flame, CalendarClock, Home, Trophy, Star, MessageSquare, Clock, Sparkles, Radar, Wallet } from "lucide-react";
import { useEffect, useState } from "react";
import { useAuth } from "@/lib/auth";
import { useRhAccess } from "@/hooks/use-rh-access";
import { supabase } from "@/integrations/supabase/client";
import logo from "@/assets/grupo-positive-logo.png.asset.json";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { HorariosOuroDialog } from "@/components/HorariosOuroDialog";
import { HorariosOuroReminder } from "@/components/HorariosOuroReminder";
import { FollowupPopup } from "@/components/prospeccao/FollowupPopup";
import { MetaTopIndicator } from "@/components/MetaTopIndicator";
import type { ReactNode } from "react";

type BadgeKind = "leads" | "followups";
type NavItem = { to: string; label: string; full?: string; icon: typeof Calculator; badge?: BadgeKind; exact?: boolean; adminOnly?: boolean; consultoraOnly?: boolean };
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
      { to: "/tomadores-al", label: "Tomadores com Margem – AL", full: "CLIENTES TOMADORES COM MARGEM - AL", icon: Wallet },
      { to: "/servidores-sem-acesso", label: "Servidores sem acesso", icon: Users, badge: "leads" },
      { to: "/prospeccao/recentes", label: "Recentes Prospectados", icon: Flame, consultoraOnly: true },
      { to: "/prospeccao/followups", label: "Follow-ups", icon: CalendarClock, badge: "followups" },
      { to: "/radar", label: "Radar Diário Oficial", full: "RADAR DIÁRIO OFICIAL - PROMOÇÕES E PROGRESSÕES", icon: Radar },
    ],
  },
  {
    section: "Produção",
    items: [
      { to: "/producao/meu-dia", label: "Meu Dia", icon: Home, consultoraOnly: true },
      { to: "/producao/ranking", label: "Ranking", icon: Trophy },
      { to: "/producao/metas", label: "Metas", icon: Target },
    ],
  },
  {
    section: "Aracaju",
    items: [
      { to: "/dashboard", label: "Dashboard", icon: LayoutDashboard, exact: true },
      { to: "/upload", label: "Importações", icon: Upload, adminOnly: true },
      { to: "/consultas", label: "Consultas", icon: List, adminOnly: true },
      { to: "/limpeza", label: "Limpeza", icon: Trash2, adminOnly: true },
    ],
  },
  {
    section: "Pós-venda",
    items: [
      { to: "/pos-venda/avaliacoes", label: "Avaliações", icon: Star },
      { to: "/qrcodes", label: "QR Codes", icon: QrCode },
    ],
  },
  {
    section: "Painel",
    items: [
      { to: "/rh", label: "RH", icon: Users },
      { to: "/whatsapp", label: "WhatsApp", icon: MessageCircle },
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

function useClock() {
  const [now, setNow] = useState<Date | null>(null);
  useEffect(() => {
    setNow(new Date());
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, []);
  return now;
}

// Daily counter of completed calls, kept in localStorage and updated live via
// the "chamadas-updated" event dispatched from the prospecção screens.
function chamadasKey() {
  return `prospeccao_chamadas_${new Date().toISOString().slice(0, 10)}`;
}

function useChamadas() {
  const [count, setCount] = useState(0);
  useEffect(() => {
    const read = () => {
      try {
        const raw = window.localStorage.getItem(chamadasKey());
        setCount(raw ? Number(raw) || 0 : 0);
      } catch { /* ignore */ }
    };
    read();
    window.addEventListener("chamadas-updated", read);
    window.addEventListener("storage", read);
    return () => {
      window.removeEventListener("chamadas-updated", read);
      window.removeEventListener("storage", read);
    };
  }, []);
  return count;
}

export function AppShell({ children }: { children: ReactNode }) {
  const { signOut, user } = useAuth();
  const now = useClock();
  const chamadas = useChamadas();
  const { isAdmin, hasAnyAccess } = useRhAccess();
  const sections = navSections
    .map((s) => ({
      ...s,
      items: s.items.filter((n) => {
        if (n.adminOnly && !isAdmin) return false;
        // Abas operacionais do dia a dia: só para consultoras (ocultas do admin).
        if (n.consultoraOnly && isAdmin) return false;
        // RH area only for admins or users the admin directed (granted access).
        if (n.to === "/rh" && !hasAnyAccess) return false;
        return true;
      }),
    }))
    .filter((s) => s.items.length > 0);
  const nav2 = useNavigate();
  const loc = useLocation();
  const leadsCount = useLeadsCount(!!user);
  const followupsCount = useFollowupsCount(!!user);
  const [mobileOpen, setMobileOpen] = useState(false);

  const renderItem = (n: NavItem, onClick?: () => void, collapsible = false) => {
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
        <span className={`flex-1 truncate whitespace-nowrap text-sm leading-5 ${collapsible ? "opacity-0 transition-opacity duration-300 ease-in-out group-hover/side:opacity-100 group-hover/side:delay-150" : ""}`}>{n.label}</span>
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
    <div className="flex min-h-screen app-bg print:block print:min-h-0 print:bg-none">
      <CompleteProfileDialog />
      <HorariosOuroDialog />
      <HorariosOuroReminder />
      {!isAdmin && <FollowupPopup />}
      <aside className="group/side hidden w-16 shrink-0 overflow-hidden sidebar-bg text-sidebar-foreground transition-[width] duration-500 ease-[cubic-bezier(0.4,0,0.2,1)] hover:w-64 md:flex md:flex-col print:!hidden">
        <div className="flex h-16 shrink-0 items-center gap-3 px-2">
          <img src={logo.url} alt="Grupo Positive" className="h-12 w-12 shrink-0 rounded-lg bg-white object-contain p-1" />
          <span className="whitespace-nowrap text-sm font-semibold text-white opacity-0 transition-opacity duration-300 ease-in-out group-hover/side:opacity-100 group-hover/side:delay-150">Grupo Positive</span>
        </div>
        <nav className="flex-1 space-y-1 overflow-y-auto overflow-x-hidden p-3">
          {sections.map((sec, idx) => (
            <div key={sec.section} className="space-y-1">
              <p className={`overflow-hidden whitespace-nowrap px-3 pb-1 text-[11px] uppercase tracking-wider text-white/45 opacity-0 transition-opacity duration-300 ease-in-out group-hover/side:opacity-100 group-hover/side:delay-150 ${idx === 0 ? "pt-1" : "pt-4"}`}>
                {sec.section}
              </p>
              {sec.items.map((n) => renderItem(n, undefined, true))}
            </div>
          ))}
        </nav>
        <div className="border-t border-white/10 p-3">
          <p className="overflow-hidden whitespace-nowrap px-3 pb-2 text-xs text-white/60 opacity-0 transition-opacity duration-300 ease-in-out group-hover/side:opacity-100 group-hover/side:delay-150">{user?.email}</p>
          <Button
            variant="ghost"
            className="w-full justify-start gap-2 text-white/90 hover:bg-white/10 hover:text-white"
            onClick={async () => { await signOut(); nav2({ to: "/login" }); }}
          >
            <LogOut className="h-4 w-4 shrink-0" /> <span className="whitespace-nowrap opacity-0 transition-opacity duration-300 ease-in-out group-hover/side:opacity-100 group-hover/side:delay-150">Sair</span>
          </Button>
        </div>
      </aside>
      <main className="flex-1 overflow-x-hidden print:overflow-visible">
        {/* Top header bar (Bitrix-style) */}
        <header className="topbar-bg relative hidden items-center gap-4 px-6 py-2.5 text-white md:flex print:!hidden">
          {/* Contador de chamadas do dia + indicador da meta do mês */}
          <div className="absolute left-1/2 top-1/2 flex -translate-x-1/2 -translate-y-1/2 items-center gap-3">
            <div className="pointer-events-none flex items-center gap-2 rounded-full bg-white/10 px-4 py-1">
              <PhoneCall className="h-4 w-4 text-white/80" />
              <span className="text-sm text-white/80">Chamadas hoje</span>
              <span className="text-xl font-bold leading-none tabular-nums">{chamadas}</span>
            </div>
            <MetaTopIndicator />
          </div>
          <div className="ml-auto flex items-center gap-4">
            <div className="flex items-center gap-2 tabular-nums">
              <Clock className="h-4 w-4 text-white/70" />
              <span className="text-xl font-semibold leading-none">
                {now ? now.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" }) : "--:--"}
              </span>
            </div>
            <div className="hidden items-center gap-2 lg:flex">
              <div className="flex h-9 w-9 items-center justify-center rounded-full bg-white/15 text-sm font-semibold text-white">
                {(user?.email ?? "?").charAt(0).toUpperCase()}
              </div>
              <span className="max-w-[160px] truncate text-sm text-white/90">{user?.email}</span>
            </div>
          </div>
        </header>


        <div className="md:hidden flex items-center justify-between topbar-bg px-4 py-3 text-white print:!hidden">
          <div className="flex items-center gap-2">
            <img src={logo.url} alt="Grupo Positive" className="h-10 w-10 rounded-lg bg-white object-contain p-1" />
            <span className="font-semibold">Grupo Positive</span>
          </div>
          <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
            <SheetTrigger asChild>
              <Button variant="ghost" size="icon" className="relative text-white hover:bg-white/10">
                <Menu className="h-5 w-5" />
                {((leadsCount ?? 0) > 0 || (followupsCount ?? 0) > 0) && (
                  <span className="absolute right-1 top-1 h-2 w-2 rounded-full bg-orange-500" />
                )}
              </Button>
            </SheetTrigger>
            <SheetContent side="left" className="w-72 sidebar-bg border-0 p-0 text-sidebar-foreground">
              <SheetHeader className="px-4 py-4 text-left">
                <SheetTitle className="flex items-center gap-2">
                  <img src={logo.url} alt="Grupo Positive" className="h-11 w-11 rounded-lg bg-white object-contain p-1" />
                  <span className="text-sm font-semibold text-white">Grupo Positive</span>
                </SheetTitle>
              </SheetHeader>
              <nav className="flex-1 space-y-1 overflow-y-auto p-3">
                {sections.map((sec, idx) => (
                  <div key={sec.section} className="space-y-1">
                    <p className={`px-3 pb-1 text-xs uppercase tracking-wider text-white/45 ${idx === 0 ? "pt-1" : "pt-4"}`}>
                      {sec.section}
                    </p>
                    {sec.items.map((n) => renderItem(n, () => setMobileOpen(false)))}
                  </div>
                ))}
              </nav>
              <div className="border-t border-white/10 p-3">
                <p className="px-3 pb-2 text-xs text-white/60 truncate">{user?.email}</p>
                <Button
                  variant="ghost"
                  className="w-full justify-start gap-2 text-white/90 hover:bg-white/10 hover:text-white"
                  onClick={async () => { setMobileOpen(false); await signOut(); nav2({ to: "/login" }); }}
                >
                  <LogOut className="h-4 w-4" /> Sair
                </Button>
              </div>
            </SheetContent>
          </Sheet>
        </div>

        <div className="p-3 md:p-5 print:p-0">
          <div className="mx-auto max-w-7xl rounded-2xl bg-card p-4 shadow-xl ring-1 ring-black/5 md:p-8 print:max-w-none print:rounded-none print:bg-transparent print:p-0 print:shadow-none print:ring-0">
            {children}
          </div>
        </div>

      </main>
    </div>
  );
}
