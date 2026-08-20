import { createFileRoute, Navigate, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { useAuth } from "@/lib/auth";
import { useRhAccess } from "@/hooks/use-rh-access";
import { supabase } from "@/integrations/supabase/client";
import { AppShell } from "@/components/AppShell";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { CalendarClock, ChevronRight, Phone, AlertTriangle, BellRing, Clock3, CalendarPlus } from "lucide-react";
import {
  STATUS_LABEL, STATUS_TONE, type LeadStatus, whatsappLink,
} from "@/lib/prospeccao/constants";
import { WhatsAppIcon } from "@/components/WhatsAppIcon";
import { enviarLembretesFollowup } from "@/lib/prospeccao/followups.functions";
import { cn } from "@/lib/utils";

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

type Filtro = "atrasados" | "hoje" | "proximos" | "todos";

const FILTROS: { key: Filtro; label: string }[] = [
  { key: "atrasados", label: "Atrasados" },
  { key: "hoje", label: "Hoje" },
  { key: "proximos", label: "Próximos" },
  { key: "todos", label: "Todos" },
];

function fmtWhen(iso: string): string {
  return new Date(iso).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });
}

function fimDoDia(): number {
  const d = new Date(); d.setHours(23, 59, 59, 999); return d.getTime();
}

function amanhaAs(hora: number): Date {
  const d = new Date(); d.setDate(d.getDate() + 1); d.setHours(hora, 0, 0, 0); return d;
}

function Page() {
  const { user, loading } = useAuth();
  const { isAdmin } = useRhAccess();
  const [leads, setLeads] = useState<Lead[]>([]);
  const [loadingLeads, setLoadingLeads] = useState(true);
  const [filtro, setFiltro] = useState<Filtro>("atrasados");
  const [enviando, setEnviando] = useState(false);
  const dispararLembretes = useServerFn(enviarLembretesFollowup);

  const load = async () => {
    const { data } = await supabase
      .from("prospect_leads")
      .select("id,nome,telefone,status,next_follow_up_at")
      .not("next_follow_up_at", "is", null)
      .not("status", "in", "(ganho,perdido)")
      .order("next_follow_up_at", { ascending: true })
      .limit(200);
    setLeads((data ?? []) as any);
    setLoadingLeads(false);
  };

  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    const run = () => { if (!cancelled) void load(); };
    run();
    const ch = supabase
      .channel("prospect_leads_followups_page")
      .on("postgres_changes", { event: "*", schema: "public", table: "prospect_leads" }, () => run())
      .subscribe();
    return () => { cancelled = true; supabase.removeChannel(ch); };
  }, [user]);

  const atrasados = useMemo(
    () => leads.filter((l) => new Date(l.next_follow_up_at).getTime() <= Date.now()).length,
    [leads],
  );

  const contagens = useMemo(() => {
    const agora = Date.now();
    const fim = fimDoDia();
    return {
      atrasados: leads.filter((l) => new Date(l.next_follow_up_at).getTime() <= agora).length,
      hoje: leads.filter((l) => {
        const t = new Date(l.next_follow_up_at).getTime();
        return t > agora && t <= fim;
      }).length,
      proximos: leads.filter((l) => new Date(l.next_follow_up_at).getTime() > fim).length,
      todos: leads.length,
    };
  }, [leads]);

  const visiveis = useMemo(() => {
    const agora = Date.now();
    const fim = fimDoDia();
    return leads.filter((l) => {
      const t = new Date(l.next_follow_up_at).getTime();
      if (filtro === "atrasados") return t <= agora;
      if (filtro === "hoje") return t > agora && t <= fim;
      if (filtro === "proximos") return t > fim;
      return true;
    });
  }, [leads, filtro]);

  const reagendar = async (id: string, quando: Date) => {
    const { error } = await supabase
      .from("prospect_leads")
      .update({ next_follow_up_at: quando.toISOString() } as any)
      .eq("id", id);
    if (error) { toast.error("Não foi possível reagendar", { description: error.message }); return; }
    toast.success("Follow-up reagendado", { description: fmtWhen(quando.toISOString()) });
    void load();
  };

  const enviarLembrete = async () => {
    setEnviando(true);
    try {
      const res: any = await dispararLembretes();
      toast.success("Lembretes enviados", {
        description: `${res?.enviados ?? 0} consultora(s) notificada(s) — ${res?.pendentes ?? 0} follow-ups pendentes.`,
      });
    } catch (e: any) {
      toast.error("Falha ao enviar lembretes", { description: e?.message });
    } finally {
      setEnviando(false);
    }
  };

  if (loading) return null;
  if (!user) return <Navigate to="/login" />;

  return (
    <AppShell>
      <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
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
            <p className="text-sm text-muted-foreground">
              Retornos agendados — o pop-up de lembrete aparece em tela quando o horário chega.
            </p>
          </div>
        </div>
        {isAdmin && (
          <Button onClick={enviarLembrete} disabled={enviando}>
            <BellRing className="mr-2 h-4 w-4" />
            {enviando ? "Enviando…" : "Enviar lembrete a todas"}
          </Button>
        )}
      </div>

      {isAdmin && (
        <p className="mb-4 text-xs text-muted-foreground">
          O sistema também envia esses lembretes automaticamente quando o horário do agendamento chega,
          mesmo sem acionar o botão.
        </p>
      )}

      <div className="mb-4 flex flex-wrap gap-2">
        {FILTROS.map((f) => (
          <button
            key={f.key}
            type="button"
            onClick={() => setFiltro(f.key)}
            className={cn(
              "rounded-full border px-3 py-1.5 text-sm transition",
              filtro === f.key
                ? "border-primary bg-primary text-primary-foreground"
                : "hover:bg-accent",
            )}
          >
            {f.label} <span className="tabular-nums opacity-80">({contagens[f.key]})</span>
          </button>
        ))}
      </div>

      <div className="space-y-2">
        {loadingLeads && <p className="text-sm text-muted-foreground">Carregando…</p>}
        {!loadingLeads && visiveis.length === 0 && (
          <Card className="p-8 text-center text-sm text-muted-foreground">Nenhum follow-up neste filtro.</Card>
        )}
        {visiveis.map((l) => {
          const overdue = new Date(l.next_follow_up_at).getTime() <= Date.now();
          return (
            <Card
              key={l.id}
              className={`flex flex-wrap items-center gap-3 p-4 transition hover:bg-accent/50 ${overdue ? "border-orange-500/40" : ""}`}
            >
              <Link to="/prospeccao/$leadId" params={{ leadId: l.id }} className="min-w-0 flex-1">
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
              </Link>

              <div className="flex items-center gap-1.5">
                <Button
                  variant="outline"
                  size="sm"
                  title="Adiar 1 hora"
                  onClick={() => reagendar(l.id, new Date(Date.now() + 3_600_000))}
                >
                  <Clock3 className="mr-1 h-3.5 w-3.5" /> +1h
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  title="Reagendar para amanhã às 9h"
                  onClick={() => reagendar(l.id, amanhaAs(9))}
                >
                  <CalendarPlus className="mr-1 h-3.5 w-3.5" /> Amanhã 9h
                </Button>
                {l.telefone && (
                  <a
                    href={`tel:${l.telefone.replace(/\D/g, "")}`}
                    title="Ligar"
                    className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-primary/15 text-primary transition hover:bg-primary/25"
                  >
                    <Phone className="h-4 w-4" />
                  </a>
                )}
                {whatsappLink(l.telefone) && (
                  <a
                    href={whatsappLink(l.telefone)!}
                    target="_blank"
                    rel="noopener noreferrer"
                    title="Abrir no WhatsApp"
                    className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-emerald-500/15 text-emerald-600 transition hover:bg-emerald-500/25 dark:text-emerald-400"
                  >
                    <WhatsAppIcon className="h-4 w-4" />
                  </a>
                )}
                <Link to="/prospeccao/$leadId" params={{ leadId: l.id }}>
                  <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
                </Link>
              </div>
            </Card>
          );
        })}
      </div>
    </AppShell>
  );
}
