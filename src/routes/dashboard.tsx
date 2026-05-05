import { createFileRoute, Navigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useAuth } from "@/lib/auth";
import { AppShell } from "@/components/AppShell";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Clock, CheckCircle2, AlertCircle, FileText, Loader2 } from "lucide-react";

export const Route = createFileRoute("/dashboard")({ component: Page });

interface Stats { total: number; pendente: number; processando: number; concluido: number; erro: number; avg: number | null; }

function Page() {
  const { user, loading } = useAuth();
  const [stats, setStats] = useState<Stats | null>(null);

  useEffect(() => {
    if (!user) return;
    const load = async () => {
      const { data } = await supabase
        .from("consultas_margem")
        .select("status, created_at, processed_at");
      if (!data) return setStats({ total: 0, pendente: 0, processando: 0, concluido: 0, erro: 0, avg: null });
      const s: Stats = { total: data.length, pendente: 0, processando: 0, concluido: 0, erro: 0, avg: null };
      const durations: number[] = [];
      data.forEach((r) => {
        const k = r.status as "pendente" | "processando" | "concluido" | "erro";
        s[k] = (s[k] as number) + 1;
        if (r.processed_at && r.created_at) durations.push((+new Date(r.processed_at) - +new Date(r.created_at)) / 1000);
      });
      s.avg = durations.length ? durations.reduce((a, b) => a + b, 0) / durations.length : null;
      setStats(s);
    };
    load();
    const ch = supabase
      .channel("dashboard-stats")
      .on("postgres_changes", { event: "*", schema: "public", table: "consultas_margem" }, load)
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [user]);

  if (loading) return null;
  if (!user) return <Navigate to="/login" />;

  const cards = [
    { label: "Total", value: stats?.total ?? 0, icon: FileText, color: "text-primary bg-primary/10" },
    { label: "Pendentes", value: stats?.pendente ?? 0, icon: Clock, color: "text-warning bg-warning/10" },
    { label: "Processando", value: stats?.processando ?? 0, icon: Loader2, color: "text-primary bg-primary/10" },
    { label: "Concluídas", value: stats?.concluido ?? 0, icon: CheckCircle2, color: "text-success bg-success/10" },
    { label: "Com erro", value: stats?.erro ?? 0, icon: AlertCircle, color: "text-destructive bg-destructive/10" },
  ];

  return (
    <AppShell>
      <div className="mb-8">
        <h1 className="text-2xl font-bold">Dashboard</h1>
        <p className="text-sm text-muted-foreground">Visão geral das consultas de margem.</p>
      </div>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
        {cards.map((c) => (
          <Card key={c.label} className="p-5">
            <div className={`mb-3 inline-flex h-10 w-10 items-center justify-center rounded-lg ${c.color}`}>
              <c.icon className="h-5 w-5" />
            </div>
            <p className="text-2xl font-bold">{c.value}</p>
            <p className="text-sm text-muted-foreground">{c.label}</p>
          </Card>
        ))}
      </div>
      <Card className="mt-6 p-6">
        <h3 className="text-sm font-medium text-muted-foreground">Tempo médio de processamento</h3>
        <p className="mt-1 text-3xl font-bold">
          {stats?.avg ? `${stats.avg.toFixed(1)}s` : "—"}
        </p>
        <p className="text-xs text-muted-foreground">por registro concluído</p>
      </Card>
    </AppShell>
  );
}
