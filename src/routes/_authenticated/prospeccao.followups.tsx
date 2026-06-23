import { createFileRoute, Navigate, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/integrations/supabase/client";
import { AppShell } from "@/components/AppShell";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { CalendarClock, ChevronRight, Phone, AlertTriangle } from "lucide-react";
import {
  STATUS_LABEL, STATUS_TONE, type LeadStatus, whatsappLink,
} from "@/lib/prospeccao/constants";
import { WhatsAppIcon } from "@/components/WhatsAppIcon";

export const Route = createFileRoute("/_authenticated/prospeccao/followups")({
  head: () => ({
    meta: [
      { title: "Follow-ups — Prospecção" },
      { name: "description", content: "Acompanhe os follow-ups agendados e atrasados dos seus leads." },
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
  next_follow_up_at: string;
};

function fmtWhen(iso: string): string {
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
        .select("id,nome,telefone,status,next_follow_up_at")
        .not("next_follow_up_at", "is", null)
        .not("status", "in", "(ganho,perdido)")
        .order("next_follow_up_at", { ascending: true })
        .limit(200);
      if (!cancelled) { setLeads((data ?? []) as any); setLoadingLeads(false); }
    };
    load();
    const ch = supabase
      .channel("prospect_leads_followups_page")
      .on("postgres_changes", { event: "*", schema: "public", table: "prospect_leads" }, () => load())
      .subscribe();
    return () => { cancelled = true; supabase.removeChannel(ch); };
  }, [user]);

  const atrasados = useMemo(
    () => leads.filter((l) => new Date(l.next_follow_up_at).getTime() <= Date.now()).length,
    [leads],
  );

  if (loading) return null;
  if (!user) return <Navigate to="/login" />;

  return (
    <AppShell>
      <div className="mb-6 flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-orange-500/15 text-orange-600 dark:text-orange-400">
          <CalendarClock className="h-5 w-5" />
        </div>
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold">
            Follow-ups
            {atrasados > 0 && (
              <Badge className="border-0 bg-orange-500 text-white hover:bg-orange-600">{atrasados}</Badge>
            )}
          </h1>
          <p className="text-sm text-muted-foreground">Retornos agendados — os atrasados aparecem primeiro.</p>
        </div>
      </div>

      <div className="space-y-2">
        {loadingLeads && <p className="text-sm text-muted-foreground">Carregando…</p>}
        {!loadingLeads && leads.length === 0 && (
          <Card className="p-8 text-center text-sm text-muted-foreground">Nenhum follow-up agendado.</Card>
        )}
        {leads.map((l) => {
          const overdue = new Date(l.next_follow_up_at).getTime() <= Date.now();
          return (
            <Link key={l.id} to="/prospeccao/$leadId" params={{ leadId: l.id }}>
              <Card className={`flex items-center gap-4 p-4 transition hover:bg-accent/50 ${overdue ? "border-orange-500/40" : ""}`}>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <p className="truncate font-semibold">{l.nome}</p>
                    <Badge variant="outline" className={STATUS_TONE[l.status]}>{STATUS_LABEL[l.status]}</Badge>
                    {overdue && (
                      <Badge className="border-0 bg-orange-500 text-white hover:bg-orange-600">
                        <AlertTriangle className="mr-1 h-3 w-3" /> Atrasado
                      </Badge>
                    )}
                  </div>
                  <div className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
                    {l.telefone && <span className="flex items-center gap-1"><Phone className="h-3 w-3" />{l.telefone}</span>}
                    <span className="flex items-center gap-1"><CalendarClock className="h-3 w-3" />{fmtWhen(l.next_follow_up_at)}</span>
                  </div>
                </div>
                {whatsappLink(l.telefone) && (
                  <button
                    type="button"
                    title="Abrir no WhatsApp"
                    onClick={(e) => { e.preventDefault(); e.stopPropagation(); window.open(whatsappLink(l.telefone)!, "_blank", "noopener,noreferrer"); }}
                    className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-emerald-500/15 text-emerald-600 transition hover:bg-emerald-500/25 dark:text-emerald-400"
                  >
                    <WhatsAppIcon className="h-4 w-4" />
                  </button>
                )}
                <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
              </Card>
            </Link>
          );
        })}
      </div>
    </AppShell>
  );
}
