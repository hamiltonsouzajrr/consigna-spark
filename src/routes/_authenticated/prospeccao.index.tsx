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
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { toast } from "sonner";
import {
  Flame, Clock, CalendarClock, Target, Timer, Search, Settings2, ChevronRight, Phone, PhoneCall, MapPin, MessageCircle, DoorOpen, CheckCircle2, BarChart3, Award, SlidersHorizontal, X, FileText,
} from "lucide-react";
import {
  STATUS_LABEL, STATUS_TONE, SLA_LABEL, SLA_TONE, whatsappLink, telLink, CALL_OUTCOMES, SITUACAO_TAGS,
  type LeadStatus, type SlaStatus,
} from "@/lib/prospeccao/constants";
import { User } from "lucide-react";
import { WhatsAppIcon } from "@/components/WhatsAppIcon";


export const Route = createFileRoute("/_authenticated/prospeccao/")({
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
  situacao: string | null;
  score: number;
  idade: number | null;
  sexo: string | null;
  sla_status: SlaStatus;
  next_follow_up_at: string | null;
  last_contact_at: string | null;
  first_response_at: string | null;
  created_at: string;
  import_batch?: string | null;
  batch_id?: string | null;
  raw_data?: any;
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
  // Advanced filters the consultant controls freely.
  const [sexoFilter, setSexoFilter] = useState<"todos" | "masculino" | "feminino">("todos");
  const [idadeMin, setIdadeMin] = useState("");
  const [idadeMax, setIdadeMax] = useState("");
  const [scoreMin, setScoreMin] = useState("");
  const [scoreMax, setScoreMax] = useState("");
  const [showFilters, setShowFilters] = useState(false);
  const [prod, setProd] = useState({ abertos: 0, qualificados: 0, ligacoes: 0, whats: 0, followups: 0 });
  // Daily counter of completed calls (lead etiquetado + ligação registrada),
  // kept per-day in localStorage so it survives refreshes.
  const [chamadas, setChamadas] = useState(0);
  const [streak, setStreak] = useState(0);

  const refill = useServerFn(refillMyQueue);

  // Daily call goal used for gamification (progress bar + streak).
  const META_DIARIA = 250;

  const todayKey = () => new Date().toISOString().slice(0, 10);
  const chamadasKey = () => `prospeccao_chamadas_${todayKey()}`;

  // Recompute the streak: consecutive days (up to today) that hit META_DIARIA.
  const computeStreak = () => {
    if (typeof window === "undefined") return 0;
    let count = 0;
    const d = new Date();
    for (let i = 0; i < 365; i++) {
      const key = `prospeccao_chamadas_${d.toISOString().slice(0, 10)}`;
      const val = Number(window.localStorage.getItem(key) ?? "0") || 0;
      if (val >= META_DIARIA) {
        count++;
      } else if (i === 0) {
        // Today not reached yet — keep counting previous days.
      } else {
        break;
      }
      d.setDate(d.getDate() - 1);
    }
    return count;
  };

  useEffect(() => {
    if (typeof window === "undefined") return;
    const raw = window.localStorage.getItem(chamadasKey());
    setChamadas(raw ? Number(raw) || 0 : 0);
    setStreak(computeStreak());
  }, []);

  const bumpChamadas = () => {
    setChamadas((c) => {
      const next = c + 1;
      try {
        window.localStorage.setItem(chamadasKey(), String(next));
        window.dispatchEvent(new Event("chamadas-updated"));
        if (next === META_DIARIA) {
          setStreak(computeStreak());
          toast.success(`🎯 Meta diária de ${META_DIARIA} chamadas atingida! Mandou bem!`);
        }
      } catch { /* ignore */ }
      return next;
    });
  };


  // Productivity panel: counts the consultant's own effort today.
  const loadProd = async (uid: string) => {
    const start = new Date(); start.setHours(0, 0, 0, 0);
    const end = new Date(); end.setHours(23, 59, 59, 999);
    const iso = start.toISOString();
    const cnt = (p: any) => p.then((r: any) => r.count ?? 0);
    const [abertos, qualificados, ligacoes, whats, followups] = await Promise.all([
      cnt(supabase.from("prospect_leads").select("id", { count: "exact", head: true }).eq("consultant_id", uid).gte("opened_at", iso)),
      cnt(supabase.from("prospect_leads").select("id", { count: "exact", head: true }).eq("consultant_id", uid).in("status", ["qualificado", "proposta", "ganho"])),
      cnt(supabase.from("lead_events").select("id", { count: "exact", head: true }).eq("consultant_id", uid).eq("kind", "ligacao").gte("created_at", iso)),
      cnt(supabase.from("lead_events").select("id", { count: "exact", head: true }).eq("consultant_id", uid).eq("kind", "whatsapp").gte("created_at", iso)),
      cnt(supabase.from("lead_tasks").select("id", { count: "exact", head: true }).eq("consultant_id", uid).eq("status", "pending").lte("due_at", end.toISOString())),
    ]);
    setProd({ abertos, qualificados, ligacoes, whats, followups });
  };

  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    const load = async () => {
      // Only show the active queue: untouched, not-yet-prospected leads.
      // Leads that were already worked (responded / moved past "novo")
      // drop out automatically and are replaced by fresh ones.
      const { data } = await supabase
        .from("prospect_leads")
        .select(`
          id,nome,telefone,telefones,cpf,cidade,origem,orcamento,urgencia,status,situacao,
          score,idade,sexo,sla_status,next_follow_up_at,last_contact_at,first_response_at,created_at,
          import_batch,batch_id,raw_data
        `)
        .eq("status", "novo")
        .is("first_response_at", null)
        .is("opened_at", null)
        .order("score", { ascending: false })
        .limit(500);
      if (!cancelled) { setLeads((data ?? []) as any); setLoadingLeads(false); }
      if (!cancelled) loadProd(user.id);
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

  // Register a call result straight from the card (no need to open the lead).
  const logCall = async (leadId: string, outcome: string) => {
    if (!user) return;
    const lead = leads.find((l) => l.id === leadId);
    if (!lead?.situacao) {
      toast.warning("Etiquete o lead (situação) antes de registrar a chamada.");
      return;
    }
    const nowIso = new Date().toISOString();
    await supabase.from("lead_events").insert({ lead_id: leadId, consultant_id: user.id, kind: "ligacao", body: `Resultado: ${outcome}` } as any);
    await supabase.from("prospect_leads").update({ last_contact_at: nowIso } as any).eq("id", leadId);
    bumpChamadas();
    toast.success(`Ligação registrada: ${outcome} — próximo lead!`);
    loadProd(user.id);
  };

  // Mark the situation tag (tratativa) straight from the card.
  const setSituacao = async (leadId: string, situacao: string) => {
    setLeads((prev) => prev.map((l) => (l.id === leadId ? { ...l, situacao } : l)));
    await supabase.from("prospect_leads").update({ situacao } as any).eq("id", leadId);
    toast.success(`Marcado como: ${situacao}`);
  };

  // Quick follow-up scheduling (1h / amanhã 9h / 2 dias).
  const scheduleFollowup = async (leadId: string, label: string, when: Date) => {
    if (!user) return;
    const iso = when.toISOString();
    setLeads((prev) => prev.map((l) => (l.id === leadId ? { ...l, next_follow_up_at: iso } : l)));
    await supabase.from("prospect_leads").update({ next_follow_up_at: iso } as any).eq("id", leadId);
    await supabase.from("lead_tasks").insert({ lead_id: leadId, consultant_id: user.id, title: `Retornar contato (${label})`, due_at: iso, status: "pending" } as any);
    toast.success(`Follow-up agendado: ${label}`);
    loadProd(user.id);
  };

  const followupOptions = (): { label: string; date: Date }[] => {
    const in1h = new Date(Date.now() + 60 * 60 * 1000);
    const tomorrow = new Date(); tomorrow.setDate(tomorrow.getDate() + 1); tomorrow.setHours(9, 0, 0, 0);
    const in2d = new Date(); in2d.setDate(in2d.getDate() + 2); in2d.setHours(9, 0, 0, 0);
    return [
      { label: "Em 1 hora", date: in1h },
      { label: "Amanhã 9h", date: tomorrow },
      { label: "Em 2 dias", date: in2d },
    ];
  };



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
    // Sexo
    if (sexoFilter !== "todos") {
      list = list.filter((l) => (l.sexo ?? "").toLowerCase().startsWith(sexoFilter[0]));
    }
    // Idade range
    const iMin = idadeMin ? Number(idadeMin) : null;
    const iMax = idadeMax ? Number(idadeMax) : null;
    if (iMin !== null) list = list.filter((l) => l.idade != null && l.idade >= iMin);
    if (iMax !== null) list = list.filter((l) => l.idade != null && l.idade <= iMax);
    // Score range
    const sMin = scoreMin ? Number(scoreMin) : null;
    const sMax = scoreMax ? Number(scoreMax) : null;
    if (sMin !== null) list = list.filter((l) => l.score >= sMin);
    if (sMax !== null) list = list.filter((l) => l.score <= sMax);
    return list;
  }, [leads, filter, q, sexoFilter, idadeMin, idadeMax, scoreMin, scoreMax]);

  const activeAdvanced = sexoFilter !== "todos" || !!idadeMin || !!idadeMax || !!scoreMin || !!scoreMax;
  const clearAdvanced = () => {
    setSexoFilter("todos"); setIdadeMin(""); setIdadeMax(""); setScoreMin(""); setScoreMax("");
  };

  if (loading) return null;
  if (!user) return <Navigate to="/login" />;

  return (
    <AppShell>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Prospecção</h1>
          <p className="text-sm text-muted-foreground">Sua fila de leads priorizada por score e prazo de atendimento.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button asChild variant="outline">
            <Link to="/prospeccao/promovidos"><Award className="mr-2 h-4 w-4" /> Recém promovidos</Link>
          </Button>
          {isAdmin && (
            <>
              <Button asChild variant="outline">
                <Link to="/prospeccao/qualidade"><BarChart3 className="mr-2 h-4 w-4" /> Qualidade</Link>
              </Button>
              <Button asChild variant="outline">
                <Link to="/prospeccao/admin"><Settings2 className="mr-2 h-4 w-4" /> Painel admin</Link>
              </Button>
            </>
          )}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
        <RhStatCard label="Leads de hoje" value={stats.hoje} icon={CalendarClock} tone="sky" />
        <RhStatCard label="Follow-ups atrasados" value={stats.atrasados} icon={Clock} tone="rose" />
        <RhStatCard label="Leads quentes" value={stats.quentes} icon={Flame} tone="amber" />
        <RhStatCard label="Taxa de conversão" value={`${stats.conversao}%`} icon={Target} tone="emerald" />
        <RhStatCard label="1ª resposta (méd.)" value={stats.avgMin ? `${stats.avgMin} min` : "—"} icon={Timer} tone="violet" />
      </div>

      <Card className="mt-4 p-4">
        {/* Daily goal + streak gamification */}
        <div className="mb-4 rounded-lg border bg-gradient-to-r from-primary/10 to-transparent p-3">
          <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <Target className="h-4 w-4 text-primary" />
              <p className="text-sm font-semibold">Meta diária de chamadas</p>
            </div>
            <div className="flex items-center gap-3 text-sm">
              <span className="font-semibold tabular-nums">{chamadas}/{META_DIARIA}</span>
              <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/15 px-2 py-0.5 text-xs font-medium text-amber-600 dark:text-amber-400">
                <Flame className="h-3.5 w-3.5" /> {streak} {streak === 1 ? "dia" : "dias"} seguidos
              </span>
            </div>
          </div>
          <div className="h-2.5 w-full overflow-hidden rounded-full bg-muted">
            <div
              className={`h-full rounded-full transition-all ${chamadas >= META_DIARIA ? "bg-emerald-500" : "bg-primary"}`}
              style={{ width: `${Math.min(100, Math.round((chamadas / META_DIARIA) * 100))}%` }}
            />
          </div>
          <p className="mt-1.5 text-xs text-muted-foreground">
            {chamadas >= META_DIARIA
              ? "🎉 Meta batida! Continue para manter sua sequência amanhã."
              : `Faltam ${META_DIARIA - chamadas} chamadas para bater a meta de hoje.`}
          </p>
        </div>
        <div className="mb-3 flex items-center gap-2">
          <Target className="h-4 w-4 text-primary" />
          <p className="text-sm font-semibold">Minha produção de hoje</p>
        </div>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-6">
          <RhStatCard label="Chamadas concluídas" value={chamadas} icon={PhoneCall} tone="rose" />
          <RhStatCard label="Leads abertos" value={prod.abertos} icon={DoorOpen} tone="sky" />
          <RhStatCard label="Qualificados" value={prod.qualificados} icon={CheckCircle2} tone="violet" />
          <RhStatCard label="Ligações feitas" value={prod.ligacoes} icon={PhoneCall} tone="emerald" />
          <RhStatCard label="WhatsApps" value={prod.whats} icon={MessageCircle} tone="emerald" />
          <RhStatCard label="Follow-ups pendentes" value={prod.followups} icon={CalendarClock} tone="amber" />
        </div>
      </Card>

      <div className="mt-6 flex flex-wrap items-center gap-2">
        {(["todos", "hoje", "quentes", "atrasados"] as const).map((f) => (
          <Button key={f} size="sm" variant={filter === f ? "default" : "outline"} onClick={() => setFilter(f)}>
            {f === "todos" ? "Todos" : f === "hoje" ? "Hoje" : f === "quentes" ? "Quentes" : "Atrasados"}
          </Button>
        ))}
        <Button size="sm" variant={showFilters || activeAdvanced ? "default" : "outline"} onClick={() => setShowFilters((v) => !v)}>
          <SlidersHorizontal className="mr-2 h-3.5 w-3.5" /> Filtros{activeAdvanced ? " •" : ""}
        </Button>
        <div className="relative ml-auto w-full max-w-xs">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input className="pl-9" placeholder="Buscar nome, telefone, cidade" value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
      </div>

      {showFilters && (
        <Card className="mt-3 p-4">
          <div className="flex flex-wrap items-end gap-4">
            <div>
              <label className="mb-1 block text-xs font-medium text-muted-foreground">Sexo</label>
              <div className="flex gap-1">
                {(["todos", "masculino", "feminino"] as const).map((s) => (
                  <Button key={s} size="sm" variant={sexoFilter === s ? "default" : "outline"} onClick={() => setSexoFilter(s)}>
                    {s === "todos" ? "Todos" : s === "masculino" ? "Masculino" : "Feminino"}
                  </Button>
                ))}
              </div>
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-muted-foreground">Idade</label>
              <div className="flex items-center gap-2">
                <Input type="number" min={0} placeholder="mín" value={idadeMin} onChange={(e) => setIdadeMin(e.target.value)} className="w-20" />
                <span className="text-muted-foreground">–</span>
                <Input type="number" min={0} placeholder="máx" value={idadeMax} onChange={(e) => setIdadeMax(e.target.value)} className="w-20" />
              </div>
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-muted-foreground">Score</label>
              <div className="flex items-center gap-2">
                <Input type="number" min={0} max={100} placeholder="mín" value={scoreMin} onChange={(e) => setScoreMin(e.target.value)} className="w-20" />
                <span className="text-muted-foreground">–</span>
                <Input type="number" min={0} max={100} placeholder="máx" value={scoreMax} onChange={(e) => setScoreMax(e.target.value)} className="w-20" />
              </div>
            </div>
            {activeAdvanced && (
              <Button size="sm" variant="ghost" onClick={clearAdvanced}>
                <X className="mr-1 h-3.5 w-3.5" /> Limpar
              </Button>
            )}
            <p className="ml-auto self-center text-xs text-muted-foreground">{visible.length} lead(s)</p>
          </div>
        </Card>
      )}

      <div className="mt-4 space-y-2">
        {loadingLeads && <p className="text-sm text-muted-foreground">Carregando fila…</p>}
        {!loadingLeads && visible.length === 0 && (
          <Card className="p-8 text-center text-sm text-muted-foreground">
            Nenhum lead na sua fila. {isAdmin ? "Use o painel admin para importar e atribuir leads." : "Aguarde a distribuição de leads pelo administrador."}
          </Card>
        )}
        {visible.map((l) => (
          <Link key={l.id} to="/prospeccao/$leadId" params={{ leadId: l.id }}>
            <Card className={`flex flex-col gap-3 p-4 transition hover:bg-accent/50 sm:flex-row sm:items-center sm:gap-4 ${l.sla_status === "atrasado" ? "border-rose-500/40" : ""}`}>
              <div className="flex min-w-0 flex-1 items-center gap-3 sm:gap-4">
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl border bg-muted text-muted-foreground">
                  <User className="h-5 w-5" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="truncate font-semibold">{l.nome}</p>
                    <Badge variant="outline" className={STATUS_TONE[l.status]}>{STATUS_LABEL[l.status]}</Badge>
                    {l.situacao && <Badge variant="secondary">{l.situacao}</Badge>}
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
                    {l.idade != null && <span>{l.idade} anos</span>}
                    {l.sexo && <span>{l.sexo}</span>}
                    <span className="rounded bg-muted px-1.5 py-0.5 font-medium">Score {l.score}</span>

                    <span>Follow-up: {fmtWhen(l.next_follow_up_at)}</span>

                  </div>
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-2 sm:flex-nowrap">
                {telLink(l.telefone) && (
                  <a
                    href={telLink(l.telefone)!}
                    title="Ligar pelo celular / discador"
                    onClick={(e) => { e.stopPropagation(); }}
                    className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-sky-500/15 text-sky-600 transition hover:bg-sky-500/25 dark:text-sky-400"
                  >
                    <PhoneCall className="h-4 w-4" />
                  </a>
                )}
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
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <button
                      type="button"
                      title="Resultado, follow-up e situação"
                      onClick={(e) => { e.preventDefault(); e.stopPropagation(); }}
                      className="inline-flex h-8 shrink-0 items-center gap-1 rounded-md border px-2 text-xs text-muted-foreground transition hover:bg-accent"
                    >
                      <Phone className="h-3.5 w-3.5" /> Tratar
                    </button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="max-h-[70vh] overflow-y-auto" onClick={(e) => { e.preventDefault(); e.stopPropagation(); }}>
                    <DropdownMenuLabel>Resultado da ligação</DropdownMenuLabel>
                    <DropdownMenuSeparator />
                    {CALL_OUTCOMES.map((o) => (
                      <DropdownMenuItem key={o} onSelect={() => logCall(l.id, o)}>{o}</DropdownMenuItem>
                    ))}
                    <DropdownMenuSeparator />
                    <DropdownMenuLabel>Agendar follow-up</DropdownMenuLabel>
                    {followupOptions().map((f) => (
                      <DropdownMenuItem key={f.label} onSelect={() => scheduleFollowup(l.id, f.label, f.date)}>
                        <CalendarClock className="mr-2 h-3.5 w-3.5" /> {f.label}
                      </DropdownMenuItem>
                    ))}
                    <DropdownMenuSeparator />
                    <DropdownMenuLabel>Situação</DropdownMenuLabel>
                    {SITUACAO_TAGS.map((t) => (
                      <DropdownMenuItem key={t} onSelect={() => setSituacao(l.id, t)}>{t}</DropdownMenuItem>
                    ))}
                  </DropdownMenuContent>
                </DropdownMenu>

                <Badge variant="outline" className={SLA_TONE[l.sla_status]}>{l.sla_status === "ok" ? "Ainda não prospectado" : SLA_LABEL[l.sla_status]}</Badge>
                <ChevronRight className="ml-auto h-4 w-4 shrink-0 text-muted-foreground sm:ml-0" />
              </div>
            </Card>
          </Link>
        ))}
      </div>
    </AppShell>
  );
}
