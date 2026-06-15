import { createFileRoute, Navigate, Link, useParams } from "@tanstack/react-router";
import { useCallback, useEffect, useState } from "react";
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
import { toast } from "sonner";
import {
  ArrowLeft, Phone, MessageCircle, StickyNote, CalendarClock, Sparkles, Loader2, CheckCircle2,
} from "lucide-react";
import {
  STATUS_FLOW, STATUS_LABEL, STATUS_TONE, SLA_LABEL, SLA_TONE, EVENT_LABEL, LOSS_REASONS,
  PLAYBOOK, URGENCIA_LABEL, whatsappLink,
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
  origem: string | null; orcamento: number | null; urgencia: string | null; status: LeadStatus;
  score: number; quality_score: number | null; sla_status: SlaStatus; loss_reason: string | null; notes: string | null;
  next_follow_up_at: string | null; last_contact_at: string | null; first_response_at: string | null;
  respondeu_whatsapp: boolean; consultant_id: string | null; import_batch: string | null; created_at: string | null;
};
type Ev = { id: string; kind: EventKind; body: string | null; created_at: string };
type Task = { id: string; title: string; due_at: string; status: string };

function fmt(iso: string | null) {
  return iso ? new Date(iso).toLocaleString("pt-BR") : "—";
}

function Page() {
  const { user, loading } = useAuth();
  const { isAdmin } = useRhAccess();
  const { leadId } = useParams({ from: "/prospeccao/$leadId" });
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

  if (loading) return null;
  if (!user) return <Navigate to="/login" />;

  const registerContact = async () => {
    if (!contactBody.trim() || !lead) return;
    setBusy(true);
    const nowIso = new Date().toISOString();
    const { error: evErr } = await supabase.from("lead_events").insert({
      lead_id: leadId, consultant_id: user.id, kind: contactKind, body: contactBody.trim(),
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
  };

  const scheduleFollowUp = async () => {
    if (!fuWhen || !lead) { toast.error("Defina data/hora do follow-up."); return; }
    setBusy(true);
    const dueIso = new Date(fuWhen).toISOString();
    const { error } = await supabase.from("lead_tasks").insert({
      lead_id: leadId, consultant_id: user.id, title: fuTitle.trim() || "Follow-up", due_at: dueIso,
    } as any);
    if (error) { toast.error(error.message); setBusy(false); return; }
    await supabase.from("prospect_leads").update({ next_follow_up_at: dueIso } as any).eq("id", leadId);
    await supabase.from("lead_events").insert({ lead_id: leadId, consultant_id: user.id, kind: "followup", body: `Follow-up agendado: ${fuTitle} (${new Date(dueIso).toLocaleString("pt-BR")})` } as any);
    setFuWhen("");
    toast.success("Follow-up agendado.");
    setBusy(false);
    load();
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
      lead_id: leadId, consultant_id: user.id, kind: "status",
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

  const askAi = async () => {
    setAiBusy(true); setAiText("");
    try {
      const r = await runAi({ data: { leadId } });
      setAiText(r.text);
    } catch (e: any) {
      toast.error(e?.message ?? "Falha ao consultar a IA.");
    } finally { setAiBusy(false); }
  };

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

  return (
    <AppShell>
      <Button asChild variant="ghost" size="sm" className="mb-4"><Link to="/prospeccao"><ArrowLeft className="mr-2 h-4 w-4" /> Voltar</Link></Button>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Left: lead summary + actions */}
        <div className="space-y-4 lg:col-span-1">
          <Card className="p-5">
            <div className="flex items-start gap-3">
              <div className="min-w-0">
                <h1 className="truncate text-xl font-bold">{lead.nome}</h1>
                <div className="mt-1 flex flex-wrap gap-1.5">
                  <Badge variant="outline" className={STATUS_TONE[lead.status]}>{STATUS_LABEL[lead.status]}</Badge>
                  <Badge variant="outline" className={SLA_TONE[lead.sla_status]}>{SLA_LABEL[lead.sla_status]}</Badge>
                </div>
              </div>
            </div>
            <dl className="mt-4 space-y-1.5 text-sm">
              <Row k="Nome" v={lead.nome} />
              <Row k="CPF" v={lead.cpf ?? "—"} />
              {(() => {
                const nums = (lead.telefones && lead.telefones.length ? lead.telefones : (lead.telefone ? [lead.telefone] : []));
                const uniq = Array.from(new Set(nums.map((n) => n.trim()).filter(Boolean)));
                if (!uniq.length) {
                  return (
                    <div className="flex items-center justify-between gap-3">
                      <dt className="text-muted-foreground">Telefone</dt>
                      <dd className="text-right font-medium">—</dd>
                    </div>
                  );
                }
                return uniq.map((num, i) => {
                  const link = whatsappLink(num, `Olá ${lead.nome.split(" ")[0]}, tudo bem?`);
                  return (
                    <div key={`${num}-${i}`} className="flex items-center justify-between gap-3">
                      <dt className="text-muted-foreground">{i === 0 ? "Telefone" : `Telefone ${i + 1}`}</dt>
                      <dd className="flex items-center gap-2 text-right font-medium">
                        <span>{num}</span>
                        {link && (
                          <a
                            href={link}
                            target="_blank"
                            rel="noopener noreferrer"
                            title="Abrir no WhatsApp"
                            className="inline-flex h-7 w-7 items-center justify-center rounded-md bg-emerald-500/15 text-emerald-600 transition hover:bg-emerald-500/25 dark:text-emerald-400"
                          >
                            <WhatsAppIcon className="h-4 w-4" />
                          </a>
                        )}
                      </dd>
                    </div>
                  );
                });
              })()}
              {lead.cidade && <Row k="Município" v={lead.cidade} />}
              {lead.origem && <Row k="Origem" v={lead.origem} />}
              {lead.orcamento != null && <Row k="Orçamento" v={lead.orcamento.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })} />}
              {lead.urgencia && <Row k="Urgência" v={URGENCIA_LABEL[lead.urgencia] ?? lead.urgencia} />}
              {lead.quality_score != null && <Row k="Qualidade" v={String(lead.quality_score)} />}
              <Row k="Respondeu WhatsApp" v={lead.respondeu_whatsapp ? "Sim" : "Não"} />
              {lead.import_batch && <Row k="Lote de importação" v={lead.import_batch} />}
              {lead.created_at && <Row k="Cadastrado em" v={fmt(lead.created_at)} />}
              <Row k="1ª resposta" v={fmt(lead.first_response_at)} />
              <Row k="Último contato" v={fmt(lead.last_contact_at)} />
              <Row k="Próx. follow-up" v={fmt(lead.next_follow_up_at)} />
              {lead.loss_reason && <Row k="Motivo perda" v={lead.loss_reason} />}
            </dl>
          </Card>

          {/* Status change */}
          <Card className="p-5">
            <p className="mb-3 text-sm font-semibold">Mudar status</p>
            <div className="flex flex-wrap gap-2">
              {STATUS_FLOW.map((s) => (
                <Button key={s} size="sm" variant={lead.status === s ? "default" : "outline"} disabled={busy || lead.status === s} onClick={() => changeStatus(s)}>
                  {STATUS_LABEL[s]}
                </Button>
              ))}
            </div>
            <div className="mt-3">
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
              <Textarea className="mt-3" rows={3} placeholder="O que foi tratado?" value={contactBody} onChange={(e) => setContactBody(e.target.value)} />
              <Button className="mt-2 w-full" disabled={busy || !contactBody.trim()} onClick={registerContact}>Salvar contato</Button>
            </Card>

            <Card className="p-5">
              <p className="mb-3 text-sm font-semibold flex items-center gap-2"><CalendarClock className="h-4 w-4" /> Agendar follow-up</p>
              <Input placeholder="Título" value={fuTitle} onChange={(e) => setFuTitle(e.target.value)} />
              <Input className="mt-2" type="datetime-local" value={fuWhen} onChange={(e) => setFuWhen(e.target.value)} />
              <Button className="mt-2 w-full" disabled={busy || !fuWhen} onClick={scheduleFollowUp}>Agendar</Button>
              {tasks.filter((t) => t.status === "pending").length > 0 && (
                <div className="mt-3 space-y-2 border-t pt-3">
                  {tasks.filter((t) => t.status === "pending").map((t) => {
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

function Row({ k, v }: { k: string; v: string }) {
  return (
    <div className="flex justify-between gap-3">
      <dt className="text-muted-foreground">{k}</dt>
      <dd className="text-right font-medium">{v}</dd>
    </div>
  );
}
