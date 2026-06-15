import { createFileRoute, Navigate, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useAuth } from "@/lib/auth";
import { useRhAccess } from "@/hooks/use-rh-access";
import { supabase } from "@/integrations/supabase/client";
import { refillMyQueue } from "@/lib/prospeccao/prospeccao.functions";
import { AppShell } from "@/components/AppShell";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { RhStatCard } from "@/components/rh/RhStatCard";
import {
  Flame, Clock, CalendarClock, Target, Timer, Search, Settings2, ChevronRight, Phone, MapPin, MessageCircle, Video,
} from "lucide-react";
import {
  STATUS_LABEL, STATUS_TONE, SLA_LABEL, SLA_TONE, whatsappLink,
  type LeadStatus, type SlaStatus,
} from "@/lib/prospeccao/constants";
import { User } from "lucide-react";
import { WhatsAppIcon } from "@/components/WhatsAppIcon";

export const Route = createFileRoute("/prospeccao/")({
  head: () => ({
    meta: [
      { title: "Prospecção — Fila inteligente de leads" },
      { name: "description", content: "Fila priorizada por score, SLA de atendimento e follow-ups para consultoras de consignado." },
      { name: "robots", content: "noindex,nofollow" },
    ],
  }),
  component: Page,
});

type Lead = {
  id: string;
  nome: string;
  telefone: string | null;
  telefones: string[] | null;
  cpf: string | null;
  cidade: string | null;
  origem: string | null;
  orcamento: number | null;
  urgencia: string | null;
  status: LeadStatus;
  score: number;
  sla_status: SlaStatus;
  next_follow_up_at: string | null;
  last_contact_at: string | null;
  first_response_at: string | null;
  created_at: string;
};

function fmtWhen(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });
}

function Page() {
  const { user, loading } = useAuth();
  const { isAdmin } = useRhAccess();
  const [leads, setLeads] = useState<Lead[]>([]);
  const [loadingLeads, setLoadingLeads] = useState(true);
  const [q, setQ] = useState("");
  const [filter, setFilter] = useState<"todos" | "hoje" | "quentes" | "atrasados">("todos");

  const refill = useServerFn(refillMyQueue);

  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    const load = async () => {
      // Only show the active queue: untouched, not-yet-prospected leads.
      // Leads that were already worked (responded / moved past "novo")
      // drop out automatically and are replaced by fresh ones.
      const { data } = await supabase
        .from("prospect_leads")
        .select("id,nome,telefone,telefones,cpf,cidade,origem,orcamento,urgencia,status,score,sla_status,next_follow_up_at,last_contact_at,first_response_at,created_at")
        .eq("status", "novo")
        .is("first_response_at", null)
        .is("opened_at", null)
        .order("score", { ascending: false })
        .limit(500);
      if (!cancelled) { setLeads((data ?? []) as any); setLoadingLeads(false); }
    };
    // Consultants get their queue topped up from the pool before loading.
    const init = async () => {
      if (!isAdmin) {
        try { await refill({ data: {} }); } catch { /* non-blocking */ }
      }
      if (!cancelled) await load();
    };
    init();
    const ch = supabase
      .channel("prospect_leads_queue")
      .on("postgres_changes", { event: "*", schema: "public", table: "prospect_leads" }, () => load())
      .subscribe();
    return () => { cancelled = true; supabase.removeChannel(ch); };
  }, [user, isAdmin]);


  const stats = useMemo(() => {
    const now = Date.now();
    const startOfDay = new Date(); startOfDay.setHours(0, 0, 0, 0);
    const open = leads.filter((l) => !["ganho", "perdido"].includes(l.status));
    const hoje = leads.filter((l) => new Date(l.created_at) >= startOfDay).length;
    const atrasados = open.filter((l) => l.sla_status === "atrasado").length;
    const quentes = open.filter((l) => l.score >= 70).length;
    const ganhos = leads.filter((l) => l.status === "ganho").length;
    const conversao = leads.length ? Math.round((ganhos / leads.length) * 100) : 0;
    const respondidos = leads.filter((l) => l.first_response_at);
    const avgMin = respondidos.length
      ? Math.round(
          respondidos.reduce((s, l) => s + (new Date(l.first_response_at!).getTime() - new Date(l.created_at).getTime()) / 60000, 0) /
            respondidos.length,
        )
      : 0;
    void now;
    return { hoje, atrasados, quentes, conversao, avgMin };
  }, [leads]);

  const visible = useMemo(() => {
    const startOfDay = new Date(); startOfDay.setHours(0, 0, 0, 0);
    let list = leads;
    if (filter === "hoje") list = list.filter((l) => new Date(l.created_at) >= startOfDay);
    if (filter === "quentes") list = list.filter((l) => l.score >= 70 && !["ganho", "perdido"].includes(l.status));
    if (filter === "atrasados") list = list.filter((l) => l.sla_status === "atrasado" && !["ganho", "perdido"].includes(l.status));
    const term = q.trim().toLowerCase();
    if (term) list = list.filter((l) => l.nome.toLowerCase().includes(term) || (l.telefone ?? "").includes(term) || (l.cidade ?? "").toLowerCase().includes(term));
    return list;
  }, [leads, filter, q]);

  if (loading) return null;
  if (!user) return <Navigate to="/login" />;

  return (
    <AppShell>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Prospecção</h1>
          <p className="text-sm text-muted-foreground">Sua fila de leads priorizada por score e prazo de atendimento.</p>
        </div>
        {isAdmin && (
          <div className="flex flex-wrap gap-2">
            <Button asChild variant="outline">
              <Link to="/prospeccao/gravacoes"><Video className="mr-2 h-4 w-4" /> Gravações</Link>
            </Button>
            <Button asChild variant="outline">
              <Link to="/prospeccao/admin"><Settings2 className="mr-2 h-4 w-4" /> Painel admin</Link>
            </Button>
          </div>
        )}
      </div>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
        <RhStatCard label="Leads de hoje" value={stats.hoje} icon={CalendarClock} tone="sky" />
        <RhStatCard label="Follow-ups atrasados" value={stats.atrasados} icon={Clock} tone="rose" />
        <RhStatCard label="Leads quentes" value={stats.quentes} icon={Flame} tone="amber" />
        <RhStatCard label="Taxa de conversão" value={`${stats.conversao}%`} icon={Target} tone="emerald" />
        <RhStatCard label="1ª resposta (méd.)" value={stats.avgMin ? `${stats.avgMin} min` : "—"} icon={Timer} tone="violet" />
      </div>

      <div className="mt-6 flex flex-wrap items-center gap-2">
        {(["todos", "hoje", "quentes", "atrasados"] as const).map((f) => (
          <Button key={f} size="sm" variant={filter === f ? "default" : "outline"} onClick={() => setFilter(f)}>
            {f === "todos" ? "Todos" : f === "hoje" ? "Hoje" : f === "quentes" ? "Quentes" : "Atrasados"}
          </Button>
        ))}
        <div className="relative ml-auto w-full max-w-xs">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input className="pl-9" placeholder="Buscar nome, telefone, cidade" value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
      </div>

      <div className="mt-4 space-y-2">
        {loadingLeads && <p className="text-sm text-muted-foreground">Carregando fila…</p>}
        {!loadingLeads && visible.length === 0 && (
          <Card className="p-8 text-center text-sm text-muted-foreground">
            Nenhum lead na sua fila. {isAdmin ? "Use o painel admin para importar e atribuir leads." : "Aguarde a distribuição de leads pelo administrador."}
          </Card>
        )}
        {visible.map((l) => (
          <Link key={l.id} to="/prospeccao/$leadId" params={{ leadId: l.id }}>
            <Card className={`flex items-center gap-4 p-4 transition hover:bg-accent/50 ${l.sla_status === "atrasado" ? "border-rose-500/40" : ""}`}>
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl border bg-muted text-muted-foreground">
                <User className="h-5 w-5" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <p className="truncate font-semibold">{l.nome}</p>
                  <Badge variant="outline" className={STATUS_TONE[l.status]}>{STATUS_LABEL[l.status]}</Badge>
                </div>
                <div className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
                  {l.cpf && <span>CPF: {l.cpf}</span>}
                  {(() => {
                    const nums = (l.telefones && l.telefones.length ? l.telefones : (l.telefone ? [l.telefone] : []));
                    const uniq = Array.from(new Set(nums.map((n) => n.trim()).filter(Boolean)));
                    return uniq.map((num, i) => (
                      <span key={`${num}-${i}`} className="flex items-center gap-1"><Phone className="h-3 w-3" />{num}</span>
                    ));
                  })()}
                  {l.cidade && <span className="flex items-center gap-1"><MapPin className="h-3 w-3" />{l.cidade}</span>}
                  {l.orcamento != null && <span>{l.orcamento.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}</span>}
                  <span>Follow-up: {fmtWhen(l.next_follow_up_at)}</span>
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
              <Badge variant="outline" className={SLA_TONE[l.sla_status]}>{SLA_LABEL[l.sla_status]}</Badge>
              <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
            </Card>
          </Link>
        ))}
      </div>
    </AppShell>
  );
}
