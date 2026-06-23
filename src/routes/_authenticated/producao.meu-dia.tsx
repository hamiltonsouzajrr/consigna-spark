import { createFileRoute, Navigate, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/integrations/supabase/client";
import { AppShell } from "@/components/AppShell";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { RhStatCard } from "@/components/rh/RhStatCard";
import { ProducaoRanking } from "@/components/rh/ProducaoRanking";
import { CalendarClock, Flame, Clock, Phone, Target, ChevronRight } from "lucide-react";

export const Route = createFileRoute("/_authenticated/producao/meu-dia")({
  head: () => ({
    meta: [
      { title: "Meu Dia — Produção" },
      { name: "description", content: "Resumo do seu dia: leads novos, follow-ups e ranking de produção." },
      { name: "robots", content: "noindex,nofollow" },
    ],
  }),
  component: Page,
});

function Page() {
  const { user, loading } = useAuth();
  const [stats, setStats] = useState({ hoje: 0, atrasados: 0, quentes: 0 });

  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    const load = async () => {
      const startOfDay = new Date(); startOfDay.setHours(0, 0, 0, 0);
      const [hoje, atrasados, quentes] = await Promise.all([
        supabase.from("prospect_leads").select("id", { count: "exact", head: true })
          .gte("created_at", startOfDay.toISOString()),
        supabase.from("prospect_leads").select("id", { count: "exact", head: true })
          .not("next_follow_up_at", "is", null)
          .lte("next_follow_up_at", new Date().toISOString())
          .not("status", "in", "(ganho,perdido)"),
        supabase.from("prospect_leads").select("id", { count: "exact", head: true })
          .gte("score", 70).not("status", "in", "(ganho,perdido)"),
      ]);
      if (!cancelled) {
        setStats({ hoje: hoje.count ?? 0, atrasados: atrasados.count ?? 0, quentes: quentes.count ?? 0 });
      }
    };
    load();
    const ch = supabase
      .channel("meu_dia_leads")
      .on("postgres_changes", { event: "*", schema: "public", table: "prospect_leads" }, () => load())
      .subscribe();
    return () => { cancelled = true; supabase.removeChannel(ch); };
  }, [user]);

  if (loading) return null;
  if (!user) return <Navigate to="/login" />;

  return (
    <AppShell>
      <div className="mb-6 flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/15 text-primary">
          <Target className="h-5 w-5" />
        </div>
        <div>
          <h1 className="text-2xl font-bold">Meu Dia</h1>
          <p className="text-sm text-muted-foreground">Seu resumo de prospecção e produção de hoje.</p>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
        <RhStatCard label="Leads de hoje" value={stats.hoje} icon={Clock} tone="sky" />
        <RhStatCard label="Follow-ups atrasados" value={stats.atrasados} icon={CalendarClock} tone="amber" />
        <RhStatCard label="Leads quentes" value={stats.quentes} icon={Flame} tone="rose" />
      </div>

      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <Link to="/prospeccao/followups">
          <Card className="flex items-center gap-3 p-4 transition hover:bg-accent/50">
            <CalendarClock className="h-5 w-5 text-orange-500" />
            <span className="flex-1 font-medium">Resolver follow-ups</span>
            <ChevronRight className="h-4 w-4 text-muted-foreground" />
          </Card>
        </Link>
        <Link to="/prospeccao">
          <Card className="flex items-center gap-3 p-4 transition hover:bg-accent/50">
            <Phone className="h-5 w-5 text-primary" />
            <span className="flex-1 font-medium">Abrir fila do CRM</span>
            <ChevronRight className="h-4 w-4 text-muted-foreground" />
          </Card>
        </Link>
      </div>

      <div className="mt-6">
        <ProducaoRanking title="Ranking de Produção" limit={10} />
      </div>
    </AppShell>
  );
}
