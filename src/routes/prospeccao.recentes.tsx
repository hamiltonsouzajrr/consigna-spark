import { createFileRoute, Navigate, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/integrations/supabase/client";
import { AppShell } from "@/components/AppShell";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Flame, ChevronRight, Phone, Clock, CalendarClock } from "lucide-react";
import {
  STATUS_LABEL, STATUS_TONE, type LeadStatus,
} from "@/lib/prospeccao/constants";

export const Route = createFileRoute("/prospeccao/recentes")({
  head: () => ({
    meta: [
      { title: "Recentes Prospectados — Prospecção" },
      { name: "description", content: "Últimos 50 clientes prospectados com horário, status e próxima ação." },
      { name: "robots", content: "noindex,nofollow" },
    ],
  }),
  component: Page,
});

type Lead = {
  id: string;
  nome: string;
  telefone: string | null;
  status: LeadStatus;
  next_follow_up_at: string | null;
  last_contact_at: string | null;
  opened_at: string | null;
  created_at: string;
};

function fmtWhen(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });
}

function Page() {
  const { user, loading } = useAuth();
  const [leads, setLeads] = useState<Lead[]>([]);
  const [loadingLeads, setLoadingLeads] = useState(true);

  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    const load = async () => {
      const { data } = await supabase
        .from("prospect_leads")
        .select("id,nome,telefone,status,next_follow_up_at,last_contact_at,opened_at,created_at")
        .not("opened_at", "is", null)
        .order("opened_at", { ascending: false })
        .limit(50);
      if (!cancelled) { setLeads((data ?? []) as any); setLoadingLeads(false); }
    };
    load();
    const ch = supabase
      .channel("prospect_leads_recentes")
      .on("postgres_changes", { event: "*", schema: "public", table: "prospect_leads" }, () => load())
      .subscribe();
    return () => { cancelled = true; supabase.removeChannel(ch); };
  }, [user]);

  if (loading) return null;
  if (!user) return <Navigate to="/login" />;

  return (
    <AppShell>
      <div className="mb-6 flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-orange-500/15 text-orange-600 dark:text-orange-400">
          <Flame className="h-5 w-5" />
        </div>
        <div>
          <h1 className="text-2xl font-bold">Recentes Prospectados</h1>
          <p className="text-sm text-muted-foreground">Últimos 50 clientes — horário, status e próxima ação.</p>
        </div>
      </div>

      <div className="space-y-2">
        {loadingLeads && <p className="text-sm text-muted-foreground">Carregando…</p>}
        {!loadingLeads && leads.length === 0 && (
          <Card className="p-8 text-center text-sm text-muted-foreground">Nenhum cliente prospectado ainda.</Card>
        )}
        {leads.map((l) => (
          <Link key={l.id} to="/prospeccao/$leadId" params={{ leadId: l.id }}>
            <Card className="flex items-center gap-4 p-4 transition hover:bg-accent/50">
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <p className="truncate font-semibold">{l.nome}</p>
                  <Badge variant="outline" className={STATUS_TONE[l.status]}>{STATUS_LABEL[l.status]}</Badge>
                </div>
                <div className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
                  {l.telefone && <span className="flex items-center gap-1"><Phone className="h-3 w-3" />{l.telefone}</span>}
                  <span className="flex items-center gap-1"><Clock className="h-3 w-3" />Aberto: {fmtWhen(l.opened_at)}</span>
                  <span className="flex items-center gap-1"><CalendarClock className="h-3 w-3" />Próxima ação: {fmtWhen(l.next_follow_up_at)}</span>
                </div>
              </div>
              <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
            </Card>
          </Link>
        ))}
      </div>
    </AppShell>
  );
}
