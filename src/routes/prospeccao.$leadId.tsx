import { createFileRoute, Navigate, Link, useParams, useNavigate } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/integrations/supabase/client";
import { AppShell } from "@/components/AppShell";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { toast } from "sonner";
import {
  ArrowLeft, Phone, PhoneCall, MessageCircle, StickyNote, CalendarClock, Sparkles, Loader2, CheckCircle2,
  Copy, SkipForward, Tag, ChevronDown, ChevronUp, AlertTriangle, MapPin, Activity,
} from "lucide-react";
import {
  STATUS_FLOW, STATUS_LABEL, STATUS_TONE, SLA_LABEL, SLA_TONE, EVENT_LABEL, LOSS_REASONS,
  PLAYBOOK, whatsappLink, telLink, CALL_OUTCOMES, SITUACAO_TAGS, scoreTone, scoreLabel,
  type LeadStatus, type SlaStatus, type EventKind,
} from "@/lib/prospeccao/constants";
import { WhatsAppIcon } from "@/components/WhatsAppIcon";
import { aiLeadAssist, markLeadOpened } from "@/lib/prospeccao/prospeccao.functions";
import { CentralAprovacao } from "@/components/legal/CentralAprovacao";
import { useRhAccess } from "@/hooks/use-rh-access";

export const Route = createFileRoute("/prospeccao/$leadId")({
  head: () => ({ meta: [{ title: "Lead — Prospecção" }, { name: "robots", content: "noindex,nofollow" }] }),
  component: Page,
});

type Lead = {
  id: string; nome: string; telefone: string | null; telefones: string[] | null; cpf: string | null; cidade: string | null;
  origem: string | null; orcamento: number | null; urgencia: string | null; status: LeadStatus; situacao: string | null;
  score: number; quality_score: number | null; sla_status: SlaStatus; loss_reason: string | null; notes: string | null;
  next_follow_up_at: string | null; last_contact_at: string | null; first_response_at: string | null;
  respondeu_whatsapp: boolean; consultant_id: string | null; import_batch: string | null; created_at: string | null;
};
type Ev = { id: string; kind: EventKind; body: string | null; created_at: string };
type Task = { id: string; title: string; due_at: string; status: string };

function fmt(iso: string | null) {
  return iso ? new Date(iso).toLocaleString("pt-BR") : "—";
}

function dayKey(iso: string) {
  const d = new Date(iso);
  return d.toLocaleDateString("pt-BR", { weekday: "short", day: "2-digit", month: "short", year: "numeric" });
}

function timeOnly(iso: string) {
  return new Date(iso).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
}

function EventIcon({ kind }: { kind: EventKind }) {
  const cls = "h-3.5 w-3.5";
  if (kind === "ligacao") return <PhoneCall className={cls} />;
  if (kind === "whatsapp") return <MessageCircle className={cls} />;
  if (kind === "nota") return <StickyNote className={cls} />;
  if (kind === "followup") return <CalendarClock className={cls} />;
  if (kind === "status") return <Activity className={cls} />;
  return <Activity className={cls} />;
}

function leadPhones(lead: Lead): string[] {
  const nums = lead.telefones && lead.telefones.length ? lead.telefones : (lead.telefone ? [lead.telefone] : []);
  return Array.from(new Set(nums.map((n) => n.trim()).filter(Boolean)));
}

function Page() {
  const { user, loading } = useAuth();
  const { isAdmin } = useRhAccess();
  const { leadId } = useParams({ from: "/prospeccao/$leadId" });
  const navigate = useNavigate();
  const runAi = useServerFn(aiLeadAssist);
  const markOpened = useServerFn(markLeadOpened);

  const [lead, setLead] = useState<Lead | null>(null);
  const [events, setEvents] = useState<Ev[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [notFound, setNotFound] = useState(false);

  const [contactKind, setContactKind] = useState<EventKind>("ligacao");
  const [contactBody, setContactBody] = useState("");
  const [fuTitle, setFuTitle] = useState("Retornar contato");
  const [fuWhen, setFuWhen] = useState("");
  const [lossReason, setLossReason] = useState<string>("");
  const [busy, setBusy] = useState(false);
  const [aiText, setAiText] = useState("");
  const [aiBusy, setAiBusy] = useState(false);
  const [showMore, setShowMore] = useState(false);
  const noteRef = useRef<HTMLTextAreaElement>(null);

  const load = useCallback(async () => {
    const { data, error } = await supabase.from("prospect_leads").select("*").eq("id", leadId).maybeSingle();
    if (error || !data) { setNotFound(true); return; }
    setLead(data as any);
    const { data: ev } = await supabase.from("lead_events").select("id,kind,body,created_at").eq("lead_id", leadId).order("created_at", { ascending: false });
    setEvents((ev ?? []) as any);
    const { data: tk } = await supabase.from("lead_tasks").select("id,title,due_at,status").eq("lead_id", leadId).order("due_at", { ascending: true });
    setTasks((tk ?? []) as any);
  }, [leadId]);

  useEffect(() => { if (user) load(); }, [user, load]);

  // Opening a lead removes it from the active queue (and tops it up with a fresh
  // one). Fire once per lead; non-blocking.
  useEffect(() => {
    if (!user || !leadId) return;
    markOpened({ data: { leadId } }).catch(() => { /* non-blocking */ });
  }, [user, leadId]);

  const phones = lead ? leadPhones(lead) : [];
  const primaryPhone = phones[0] ?? null;

  const registerContact = useCallback(async () => {
    if (!contactBody.trim() || !lead) return;
    setBusy(true);
    const nowIso = new Date().toISOString();
    const { error: evErr } = await supabase.from("lead_events").insert({
      lead_id: leadId, consultant_id: user!.id, kind: contactKind, body: contactBody.trim(),
    } as any);
    if (evErr) { toast.error(evErr.message); setBusy(false); return; }
    const patch: any = { last_contact_at: nowIso };
    if (!lead.first_response_at) patch.first_response_at = nowIso;
    if (contactKind === "whatsapp") patch.respondeu_whatsapp = true;
    await supabase.from("prospect_leads").update(patch).eq("id", leadId);
    setContactBody("");
    toast.success("Contato registrado.");
    setBusy(false);
    load();
  }, [contactBody, contactKind, lead, leadId, user, load]);

  // One-click call result, straight from the header (no typing required).
  const logOutcome = useCallback(async (outcome: string) => {
    if (!lead || !user) return;
    const nowIso = new Date().toISOString();
    await supabase.from("lead_events").insert({ lead_id: leadId, consultant_id: user.id, kind: "ligacao", body: `Resultado: ${outcome}` } as any);
    const patch: any = { last_contact_at: nowIso };
    if (!lead.first_response_at) patch.first_response_at = nowIso;
    await supabase.from("prospect_leads").update(patch).eq("id", leadId);
    toast.success(`Ligação registrada: ${outcome}`);
    load();
  }, [lead, user, leadId, load]);

  const setSituacao = useCallback(async (situacao: string) => {
    if (!lead) return;
    setLead((prev) => (prev ? { ...prev, situacao } : prev));
    await supabase.from("prospect_leads").update({ situacao } as any).eq("id", leadId);
    toast.success(`Marcado como: ${situacao}`);
  }, [lead, leadId]);

  const scheduleFollowUp = async () => {
    if (!fuWhen || !lead) { toast.error("Defina data/hora do follow-up."); return; }
    await doScheduleFollowUp(fuTitle.trim() || "Follow-up", new Date(fuWhen));
    setFuWhen("");
  };

  // Quick follow-up presets (1h / amanhã 9h / 2 dias).
  const doScheduleFollowUp = useCallback(async (title: string, when: Date) => {
    if (!lead || !user) return;
    setBusy(true);
    const dueIso = when.toISOString();
    const { error } = await supabase.from("lead_tasks").insert({
      lead_id: leadId, consultant_id: user.id, title, due_at: dueIso,
    } as any);
    if (error) { toast.error(error.message); setBusy(false); return; }
    await supabase.from("prospect_leads").update({ next_follow_up_at: dueIso } as any).eq("id", leadId);
    await supabase.from("lead_events").insert({ lead_id: leadId, consultant_id: user.id, kind: "followup", body: `Follow-up agendado: ${title} (${when.toLocaleString("pt-BR")})` } as any);
    toast.success("Follow-up agendado.");
    setBusy(false);
    load();
  }, [lead, user, leadId, load]);

  const followupPresets = () => {
    const in1h = new Date(Date.now() + 60 * 60 * 1000);
    const tomorrow = new Date(); tomorrow.setDate(tomorrow.getDate() + 1); tomorrow.setHours(9, 0, 0, 0);
    const in2d = new Date(); in2d.setDate(in2d.getDate() + 2); in2d.setHours(9, 0, 0, 0);
    return [
      { label: "Em 1 hora", date: in1h },
      { label: "Amanhã 9h", date: tomorrow },
      { label: "Em 2 dias", date: in2d },
    ];
  };

  const changeStatus = async (status: LeadStatus) => {
    if (!lead) return;
    if (status === "perdido" && !lossReason) { toast.error("Selecione o motivo da perda."); return; }
    setBusy(true);
    const patch: any = { status };
    if (status === "perdido") patch.loss_reason = lossReason;
    const { error } = await supabase.from("prospect_leads").update(patch).eq("id", leadId);
    if (error) { toast.error(error.message); setBusy(false); return; }
    await supabase.from("lead_events").insert({
      lead_id: leadId, consultant_id: user!.id, kind: "status",
      body: `Status → ${STATUS_LABEL[status]}${status === "perdido" ? ` (motivo: ${lossReason})` : ""}`,
    } as any);
    toast.success("Status atualizado.");
    setBusy(false);
    load();
  };

  const completeTask = async (id: string) => {
    await supabase.from("lead_tasks").update({ status: "done" } as any).eq("id", id);
    load();
  };

  // Jump straight to the next untouched lead in the queue (call-in-sequence).
  const goNextLead = useCallback(async () => {
    const { data } = await supabase
      .from("prospect_leads")
      .select("id")
      .eq("status", "novo")
      .is("first_response_at", null)
      .is("opened_at", null)
      .neq("id", leadId)
      .order("score", { ascending: false })
      .limit(1);
    const next = data?.[0]?.id as string | undefined;
    if (next) navigate({ to: "/prospeccao/$leadId", params: { leadId: next } });
    else { toast.info("Não há mais leads na fila."); navigate({ to: "/prospeccao" }); }
  }, [leadId, navigate]);

  const copyPhone = useCallback(() => {
    if (!primaryPhone) return;
    navigator.clipboard?.writeText(primaryPhone).then(() => toast.success("Número copiado.")).catch(() => {});
  }, [primaryPhone]);

  const askAi = async () => {
    setAiBusy(true); setAiText("");
    try {
      const r = await runAi({ data: { leadId } });
      setAiText(r.text);
    } catch (e: any) {
      toast.error(e?.message ?? "Falha ao consultar a IA.");
    } finally { setAiBusy(false); }
  };

  // Keyboard shortcuts: L = ligar, W = WhatsApp, N = foco na nota.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null;
      if (t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.isContentEditable)) return;
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      const k = e.key.toLowerCase();
      if (k === "l" && primaryPhone) { const link = telLink(primaryPhone); if (link) window.location.href = link; }
      else if (k === "w" && primaryPhone) { const link = whatsappLink(primaryPhone, lead ? `Olá ${lead.nome.split(" ")[0]}, tudo bem?` : undefined); if (link) window.open(link, "_blank", "noopener,noreferrer"); }
      else if (k === "n") { e.preventDefault(); setContactKind("nota"); noteRef.current?.focus(); }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [primaryPhone, lead]);

  const pendingTasks = useMemo(() => tasks.filter((t) => t.status === "pending"), [tasks]);
  const overdueFollowup = lead?.next_follow_up_at ? new Date(lead.next_follow_up_at) < new Date() : false;
  const groupedEvents = useMemo(() => {
    const groups: { day: string; items: Ev[] }[] = [];
    for (const e of events) {
      const day = dayKey(e.created_at);
      const last = groups[groups.length - 1];
      if (last && last.day === day) last.items.push(e);
      else groups.push({ day, items: [e] });
    }
    return groups;
  }, [events]);

  if (loading) return null;
  if (!user) return <Navigate to="/login" />;

  if (notFound) {
    return (
      <AppShell>
        <div className="mx-auto max-w-md py-16 text-center">
          <p className="text-lg font-semibold">Lead não encontrado</p>
          <p className="mt-1 text-sm text-muted-foreground">Ele pode não estar atribuído a você.</p>
          <Button asChild className="mt-4"><Link to="/prospeccao">Voltar para a fila</Link></Button>
        </div>
      </AppShell>
    );
  }
  if (!lead) return <AppShell><p className="py-10 text-sm text-muted-foreground">Carregando…</p></AppShell>;

  const playbook = PLAYBOOK[lead.status];
  const telHref = telLink(primaryPhone);
  const waHref = whatsappLink(primaryPhone, `Olá ${lead.nome.split(" ")[0]}, tudo bem?`);

  return (
    <AppShell>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <Button asChild variant="ghost" size="sm"><Link to="/prospeccao"><ArrowLeft className="mr-2 h-4 w-4" /> Voltar</Link></Button>
        <Button variant="outline" size="sm" onClick={goNextLead}><SkipForward className="mr-2 h-4 w-4" /> Próximo lead</Button>
      </div>

      {overdueFollowup && (
        <div className="mb-4 flex items-center gap-2 rounded-md border border-rose-500/40 bg-rose-500/10 px-3 py-2 text-sm font-medium text-rose-700 dark:text-rose-300">
          <AlertTriangle className="h-4 w-4 shrink-0" />
          Follow-up vencido — agendado para {fmt(lead.next_follow_up_at)}. Retorne o contato.
        </div>
      )}


      {/* Sticky quick-action bar */}
      <Card className="mb-6 p-4">
        <div className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-4 sm:flex sm:flex-wrap sm:items-center sm:justify-between">
          <div className="min-w-0">
            <h1 className="truncate text-xl font-bold sm:text-2xl">{lead.nome}</h1>
            <div className="mt-1.5 flex flex-wrap gap-1.5">
              <Badge variant="outline" className={STATUS_TONE[lead.status]}>{STATUS_LABEL[lead.status]}</Badge>
              <Badge variant="outline" className={SLA_TONE[lead.sla_status]}>{lead.sla_status === "ok" ? "Ainda não prospectado" : SLA_LABEL[lead.sla_status]}</Badge>
              <Badge variant="outline" className={scoreTone(lead.score)}>{scoreLabel(lead.score)} · {lead.score}</Badge>
              {lead.situacao && <Badge variant="secondary"><Tag className="mr-1 h-3 w-3" />{lead.situacao}</Badge>}
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {telHref && (
              <Button asChild size="sm" className="bg-sky-600 hover:bg-sky-700">
                <a href={telHref} title="Ligar (L)"><PhoneCall className="mr-1.5 h-4 w-4" /> Ligar</a>
              </Button>
            )}
            {waHref && (
              <Button asChild size="sm" className="bg-emerald-600 hover:bg-emerald-700">
                <a href={waHref} target="_blank" rel="noopener noreferrer" title="WhatsApp (W)"><WhatsAppIcon className="mr-1.5 h-4 w-4" /> WhatsApp</a>
              </Button>
            )}
            {primaryPhone && (
              <Button size="sm" variant="outline" onClick={copyPhone} title="Copiar número"><Copy className="mr-1.5 h-4 w-4" /> Copiar</Button>
            )}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button size="sm" variant="outline"><Phone className="mr-1.5 h-4 w-4" /> Resultado</Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="max-h-[70vh] overflow-y-auto">
                <DropdownMenuLabel>Resultado da ligação</DropdownMenuLabel>
                <DropdownMenuSeparator />
                {CALL_OUTCOMES.map((o) => (
                  <DropdownMenuItem key={o} onSelect={() => logOutcome(o)}>{o}</DropdownMenuItem>
                ))}
                <DropdownMenuSeparator />
                <DropdownMenuLabel>Situação</DropdownMenuLabel>
                {SITUACAO_TAGS.map((t) => (
                  <DropdownMenuItem key={t} onSelect={() => setSituacao(t)}>{t}</DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
        <p className="mt-3 text-xs text-muted-foreground">Atalhos: <kbd className="rounded border px-1">L</kbd> ligar · <kbd className="rounded border px-1">W</kbd> WhatsApp · <kbd className="rounded border px-1">N</kbd> nota</p>
      </Card>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Left: lead summary + actions */}
        <div className="space-y-4 lg:col-span-1">
          <Card className="p-5">
            <p className="mb-3 text-sm font-semibold">Dados do lead</p>

            {/* Highlights: phones + city + score */}
            <div className="space-y-2">
              {phones.map((num, i) => {
                const link = whatsappLink(num, `Olá ${lead.nome.split(" ")[0]}, tudo bem?`);
                return (
                  <div key={`${num}-${i}`} className="flex items-center justify-between gap-3 rounded-lg border bg-muted/30 px-3 py-2">
                    <div className="min-w-0">
                      <p className="text-[11px] uppercase tracking-wide text-muted-foreground">{i === 0 ? "Telefone" : `Telefone ${i + 1}`}</p>
                      <p className="truncate text-base font-semibold">{num}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      {telLink(num) && (
                        <a href={telLink(num)!} title="Ligar" className="inline-flex h-8 w-8 items-center justify-center rounded-md bg-sky-500/15 text-sky-600 transition hover:bg-sky-500/25 dark:text-sky-400">
                          <PhoneCall className="h-4 w-4" />
                        </a>
                      )}
                      {link && (
                        <a href={link} target="_blank" rel="noopener noreferrer" title="Abrir no WhatsApp" className="inline-flex h-8 w-8 items-center justify-center rounded-md bg-emerald-500/15 text-emerald-600 transition hover:bg-emerald-500/25 dark:text-emerald-400">
                          <WhatsAppIcon className="h-4 w-4" />
                        </a>
                      )}
                    </div>
                  </div>
                );
              })}
              {!phones.length && <p className="rounded-lg border bg-muted/30 px-3 py-2 text-sm text-muted-foreground">Sem telefone cadastrado</p>}

              <div className="flex gap-2">
                <div className="flex-1 rounded-lg border bg-muted/30 px-3 py-2">
                  <p className="text-[11px] uppercase tracking-wide text-muted-foreground flex items-center gap-1"><MapPin className="h-3 w-3" /> Município</p>
                  <p className="truncate text-sm font-semibold">{lead.cidade ?? "—"}</p>
                </div>
                <div className="flex-1 rounded-lg border bg-muted/30 px-3 py-2">
                  <p className="text-[11px] uppercase tracking-wide text-muted-foreground">Pontuação</p>
                  <p className={`text-sm font-semibold ${scoreTone(lead.score)}`}>{scoreLabel(lead.score)} · {lead.score}</p>
                </div>
              </div>
            </div>

            <button
              type="button"
              onClick={() => setShowMore((v) => !v)}
              className="mt-3 inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline"
            >
              {showMore ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
              {showMore ? "Ver menos" : "Ver mais detalhes"}
            </button>

            {showMore && (
              <dl className="mt-3 space-y-1.5 border-t pt-3 text-sm">
                <Row k="CPF" v={lead.cpf} />
                <Row k="Origem" v={lead.origem} />
                <Row k="Respondeu WhatsApp" v={lead.respondeu_whatsapp ? "Sim" : null} />
                <Row k="Lote de importação" v={lead.import_batch} />
                <Row k="Cadastrado em" v={lead.created_at ? fmt(lead.created_at) : null} />
                <Row k="1ª resposta" v={lead.first_response_at ? fmt(lead.first_response_at) : null} />
                <Row k="Último contato" v={lead.last_contact_at ? fmt(lead.last_contact_at) : null} />
                <Row
                  k="Próx. follow-up"
                  v={lead.next_follow_up_at ? fmt(lead.next_follow_up_at) : null}
                  tone={overdueFollowup ? "text-rose-600 dark:text-rose-400" : undefined}
                />
                <Row k="Motivo perda" v={lead.loss_reason} />
              </dl>
            )}
          </Card>


          {/* Tags: status + situação */}
          <Card className="p-5">
            <p className="mb-2 text-sm font-semibold flex items-center gap-2"><Tag className="h-4 w-4" /> Status</p>
            <div className="flex flex-wrap gap-2">
              {STATUS_FLOW.map((s) => {
                const active = lead.status === s;
                return (
                  <button
                    key={s}
                    type="button"
                    disabled={busy || active}
                    onClick={() => changeStatus(s)}
                    className={`rounded-full border px-3 py-1 text-xs font-medium transition disabled:opacity-100 ${active ? `${STATUS_TONE[s]} ring-2 ring-primary/40` : "border-border text-muted-foreground hover:bg-muted"}`}
                  >
                    {STATUS_LABEL[s]}
                  </button>
                );
              })}
            </div>

            <p className="mb-2 mt-4 text-sm font-semibold flex items-center gap-2"><Tag className="h-4 w-4" /> Situação</p>
            <div className="flex flex-wrap gap-2">
              {SITUACAO_TAGS.map((t) => {
                const active = lead.situacao === t;
                return (
                  <button
                    key={t}
                    type="button"
                    onClick={() => setSituacao(active ? "" : t)}
                    className={`rounded-full border px-3 py-1 text-xs font-medium transition ${active ? "border-primary bg-primary/10 text-primary ring-2 ring-primary/40" : "border-border text-muted-foreground hover:bg-muted"}`}
                  >
                    {t}
                  </button>
                );
              })}
            </div>

            <div className="mt-4">
              <Label className="text-xs">Motivo da perda (obrigatório p/ "Perdido")</Label>
              <Select value={lossReason} onValueChange={setLossReason}>
                <SelectTrigger className="mt-1"><SelectValue placeholder="Selecionar motivo" /></SelectTrigger>
                <SelectContent>
                  {LOSS_REASONS.map((r) => <SelectItem key={r} value={r}>{r}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </Card>

          {/* AI assistant */}
          <Card className="p-5">
            <div className="flex items-center justify-between">
              <p className="text-sm font-semibold flex items-center gap-2"><Sparkles className="h-4 w-4 text-primary" /> Assistente IA</p>
              <Button size="sm" variant="outline" onClick={askAi} disabled={aiBusy}>
                {aiBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : "Analisar"}
              </Button>
            </div>
            {aiText && <div className="mt-3 whitespace-pre-wrap rounded-md bg-muted/40 p-3 text-sm">{aiText}</div>}
            {!aiText && !aiBusy && <p className="mt-2 text-xs text-muted-foreground">Resume o histórico, identifica objeções e sugere a próxima ação.</p>}
          </Card>
        </div>

        {/* Right: playbook, actions, timeline */}
        <div className="space-y-4 lg:col-span-2">
          <Card className="border-primary/30 bg-primary/5 p-5">
            <p className="text-sm font-semibold">Playbook — {playbook.title}</p>
            <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-muted-foreground">
              {playbook.items.map((it, i) => <li key={i}>{it}</li>)}
            </ul>
          </Card>

          <div className="grid gap-4 md:grid-cols-2">
            <Card className="p-5">
              <p className="mb-3 text-sm font-semibold">Registrar contato</p>
              <div className="flex gap-2">
                {(["ligacao", "whatsapp", "nota"] as EventKind[]).map((k) => (
                  <Button key={k} size="sm" variant={contactKind === k ? "default" : "outline"} onClick={() => setContactKind(k)}>
                    {k === "ligacao" ? <Phone className="mr-1 h-3.5 w-3.5" /> : k === "whatsapp" ? <MessageCircle className="mr-1 h-3.5 w-3.5" /> : <StickyNote className="mr-1 h-3.5 w-3.5" />}
                    {EVENT_LABEL[k]}
                  </Button>
                ))}
              </div>
              <Textarea ref={noteRef} className="mt-3" rows={3} placeholder="O que foi tratado?" value={contactBody} onChange={(e) => setContactBody(e.target.value)} />
              <Button className="mt-2 w-full" disabled={busy || !contactBody.trim()} onClick={registerContact}>Salvar contato</Button>
            </Card>

            <Card className="p-5">
              <p className="mb-3 text-sm font-semibold flex items-center gap-2"><CalendarClock className="h-4 w-4" /> Agendar follow-up</p>
              <div className="mb-3 flex flex-wrap gap-2">
                {followupPresets().map((p) => (
                  <Button key={p.label} size="sm" variant="outline" disabled={busy} onClick={() => doScheduleFollowUp("Retornar contato", p.date)}>
                    {p.label}
                  </Button>
                ))}
              </div>
              <Input placeholder="Título" value={fuTitle} onChange={(e) => setFuTitle(e.target.value)} />
              <Input className="mt-2" type="datetime-local" value={fuWhen} onChange={(e) => setFuWhen(e.target.value)} />
              <Button className="mt-2 w-full" disabled={busy || !fuWhen} onClick={scheduleFollowUp}>Agendar data específica</Button>
              {pendingTasks.length > 0 && (
                <div className="mt-3 space-y-2 border-t pt-3">
                  {pendingTasks.map((t) => {
                    const late = new Date(t.due_at) < new Date();
                    return (
                      <div key={t.id} className="flex items-center gap-2 text-sm">
                        <span className={`flex-1 ${late ? "text-rose-600 dark:text-rose-400 font-medium" : ""}`}>{t.title} · {fmt(t.due_at)}</span>
                        <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => completeTask(t.id)} title="Concluir"><CheckCircle2 className="h-4 w-4" /></Button>
                      </div>
                    );
                  })}
                </div>
              )}
            </Card>
          </div>

          <Card className="p-5">
            <p className="mb-4 text-sm font-semibold">Timeline</p>
            {events.length === 0 && <p className="text-sm text-muted-foreground">Sem interações ainda. Registre o primeiro contato.</p>}
            <ol className="relative space-y-4 border-l pl-5">
              {events.map((e) => (
                <li key={e.id} className="relative">
                  <span className="absolute -left-[26px] top-1 h-3 w-3 rounded-full border-2 border-background bg-primary" />
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className="text-xs">{EVENT_LABEL[e.kind]}</Badge>
                    <span className="text-xs text-muted-foreground">{fmt(e.created_at)}</span>
                  </div>
                  {e.body && <p className="mt-1 text-sm">{e.body}</p>}
                </li>
              ))}
            </ol>
          </Card>

          {isAdmin && <CentralAprovacao lead={{ id: lead.id, nome: lead.nome, cpf: lead.cpf }} />}
        </div>
      </div>
    </AppShell>
  );
}

function Row({ k, v, tone }: { k: string; v: string | null; tone?: string }) {
  if (!v) return null;
  return (
    <div className="flex justify-between gap-3">
      <dt className="text-muted-foreground">{k}</dt>
      <dd className={`text-right font-medium ${tone ?? ""}`}>{v}</dd>
    </div>
  );
}
