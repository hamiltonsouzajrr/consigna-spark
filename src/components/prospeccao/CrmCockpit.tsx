import { useCallback, useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { supabase } from "@/integrations/supabase/client";
import { getMyCallQuality } from "@/lib/prospeccao/prospeccao.functions";
import {
  registrarContato, concluirFollowup, reagendarFollowup, pularFollowup,
} from "@/lib/prospeccao/competicao.functions";
import { CompeticaoRanking } from "@/components/prospeccao/CompeticaoRanking";
import { cn } from "@/lib/utils";
import {
  Target, Flame, PhoneCall, PhoneIncoming, Percent, CalendarClock, CheckCircle2,
  MessageCircle, DoorOpen, ChevronRight, Clock, AlertTriangle, Phone, Loader2,
  CalendarPlus, SkipForward,
} from "lucide-react";

type Prod = { abertos: number; qualificados: number; ligacoes: number; whats: number; followups: number };

type Followup = {
  id: string;
  title: string;
  due_at: string;
  lead_id: string;
  lead_nome: string | null;
  telefone: string | null;
};


type Props = {
  chamadas: number;
  metaDiaria: number;
  streak: number;
  prod: Prod;
  filaHoje: number;
  filaQuentes: number;
  filaAtrasados: number;
  filaTotal: number;
};

function MiniStat({ label, value, tone = "default" }: { label: string; value: string | number; tone?: string }) {
  return (
    <div className="rounded-lg border bg-muted/30 p-2.5">
      <p className="text-[11px] leading-tight text-muted-foreground">{label}</p>
      <p className={cn("mt-0.5 text-lg font-bold tabular-nums", tone)}>{value}</p>
    </div>
  );
}

function hora(iso: string) {
  return new Date(iso).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
}

export function CrmCockpit({
  chamadas, metaDiaria, streak, prod, filaHoje, filaQuentes, filaAtrasados, filaTotal,
}: Props) {
  const fetchQuality = useServerFn(getMyCallQuality);
  const { data: quality, isLoading: loadingQuality } = useQuery({
    queryKey: ["my-call-quality"],
    queryFn: () => fetchQuality(),
    refetchInterval: 120_000,
  });

  const doContato = useServerFn(registrarContato);
  const doConcluir = useServerFn(concluirFollowup);
  const doReagendar = useServerFn(reagendarFollowup);
  const doPular = useServerFn(pularFollowup);

  const [followups, setFollowups] = useState<Followup[]>([]);
  const [busy, setBusy] = useState<string | null>(null);

  const loadFollowups = useCallback(async () => {
    const end = new Date(); end.setHours(23, 59, 59, 999);
    const { data } = await supabase
      .from("lead_tasks")
      .select("id,title,due_at,lead_id,prospect_leads(nome,telefone,telefones)")
      .eq("status", "pending")
      .lte("due_at", end.toISOString())
      .order("due_at", { ascending: true })
      .limit(6);
    return ((data ?? []) as any[]).map((t) => ({
      id: t.id as string,
      title: t.title as string,
      due_at: t.due_at as string,
      lead_id: t.lead_id as string,
      lead_nome: (t.prospect_leads?.nome as string) ?? null,
      telefone: (t.prospect_leads?.telefone as string) ?? t.prospect_leads?.telefones?.[0] ?? null,
    }));
  }, []);

  useEffect(() => {
    let cancelled = false;
    loadFollowups().then((rows) => { if (!cancelled) setFollowups(rows); });
    return () => { cancelled = true; };
  }, [loadFollowups]);

  const refresh = useCallback(async () => {
    setFollowups(await loadFollowups());
  }, [loadFollowups]);

  const ligar = async (f: Followup) => {
    if (!f.telefone) { toast.error("Lead sem telefone cadastrado."); return; }
    setBusy(f.id);
    try {
      const r = await doContato({ data: { leadId: f.lead_id, kind: "ligacao", body: `Ligação do follow-up: ${f.title}` } });
      window.location.href = `tel:${f.telefone.replace(/\D/g, "")}`;
      toast.success(r.pontos ? `Ligação registrada (+${r.pontos} pts)` : "Ligação registrada", { description: r.motivo });
    } catch (e: any) {
      toast.error(e?.message ?? "Não foi possível registrar a ligação.");
    } finally { setBusy(null); }
  };

  const atender = async (f: Followup) => {
    setBusy(f.id);
    try {
      const r = await doConcluir({ data: { taskId: f.id } });
      toast.success(r.pontos ? `Follow-up cumprido (+${r.pontos} pts)` : "Follow-up concluído", { description: r.motivo });
      await refresh();
    } catch (e: any) {
      toast.error(e?.message ?? "Não foi possível concluir o follow-up.");
    } finally { setBusy(null); }
  };

  const reagendar = async (f: Followup, when: Date, label: string) => {
    setBusy(f.id);
    try {
      await doReagendar({ data: { taskId: f.id, dueAt: when.toISOString() } });
      toast.success(`Reagendado para ${label}.`);
      await refresh();
    } catch (e: any) {
      toast.error(e?.message ?? "Não foi possível reagendar.");
    } finally { setBusy(null); }
  };

  const pular = async (f: Followup) => {
    setBusy(f.id);
    try {
      await doPular({ data: { taskId: f.id, motivo: "pulado no CRM" } });
      toast.success("Follow-up pulado.");
      await refresh();
    } catch (e: any) {
      toast.error(e?.message ?? "Não foi possível pular.");
    } finally { setBusy(null); }
  };


  const pct = Math.min(100, Math.round((chamadas / metaDiaria) * 100));
  const maxDay = Math.max(1, ...(quality?.daily ?? []).map((d) => d.total));

  return (
    <div className="grid gap-4 xl:grid-cols-3">
      {/* 1. Meta diária + produção */}
      <Card className="flex flex-col gap-4 p-4">
        <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3">
          <div className="flex min-w-0 items-center gap-2">
            <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-primary/15 text-primary">
              <Target className="h-4.5 w-4.5" />
            </span>
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold">Meta diária de chamadas</p>
              <p className="text-xs text-muted-foreground">
                {chamadas >= metaDiaria ? "Meta batida 🎉" : `Faltam ${metaDiaria - chamadas}`}
              </p>
            </div>
          </div>
          <Badge variant="outline" className="gap-1 text-xs">
            <Flame className="h-3 w-3 text-amber-500" /> {streak}d
          </Badge>
        </div>

        <div>
          <div className="mb-1 flex items-end justify-between">
            <span className="text-3xl font-bold tabular-nums leading-none">{chamadas}</span>
            <span className="text-xs text-muted-foreground">de {metaDiaria} · {pct}%</span>
          </div>
          <div className="h-2.5 w-full overflow-hidden rounded-full bg-muted">
            <div
              className={cn("h-full rounded-full transition-all", chamadas >= metaDiaria ? "bg-emerald-500" : "bg-primary")}
              style={{ width: `${pct}%` }}
            />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          <MiniStat label="Leads abertos" value={prod.abertos} />
          <MiniStat label="Qualificados" value={prod.qualificados} />
          <MiniStat label="Ligações" value={prod.ligacoes} />
          <MiniStat label="WhatsApps" value={prod.whats} />
          <MiniStat label="Follow-ups" value={prod.followups} />
          <MiniStat label="Fila hoje" value={filaHoje} />
        </div>

        <div className="mt-auto flex flex-wrap gap-2 text-xs text-muted-foreground">
          <span className="inline-flex items-center gap-1"><DoorOpen className="h-3 w-3" />{filaTotal} na fila</span>
          <span className="inline-flex items-center gap-1"><Flame className="h-3 w-3 text-amber-500" />{filaQuentes} quentes</span>
          <span className="inline-flex items-center gap-1"><AlertTriangle className="h-3 w-3 text-rose-500" />{filaAtrasados} atrasados</span>
        </div>
      </Card>

      {/* 2. Qualidade de ligações */}
      <Card className="flex flex-col gap-4 p-4">
        <div className="flex items-center gap-2">
          <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-sky-500/15 text-sky-600 dark:text-sky-400">
            <PhoneCall className="h-4.5 w-4.5" />
          </span>
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold">Qualidade das minhas ligações</p>
            <p className="text-xs text-muted-foreground">Últimos 7 dias</p>
          </div>
        </div>

        {loadingQuality && <Skeleton className="h-40 w-full" />}

        {!loadingQuality && quality && (
          <>
            <div className="grid grid-cols-3 gap-2">
              <MiniStat label="Ligações" value={quality.total7d} />
              <MiniStat label="Atendidas" value={quality.answered7d} tone="text-emerald-600 dark:text-emerald-400" />
              <MiniStat label="Taxa atend." value={`${quality.answerRate}%`} tone="text-sky-600 dark:text-sky-400" />
            </div>

            <div>
              <p className="mb-2 text-xs text-muted-foreground">
                Média de {quality.avgPerDay} ligações/dia · {quality.qualified7d} leads qualificados
              </p>
              <div className="flex h-24 items-end gap-1.5">
                {quality.daily.map((d) => (
                  <div key={d.date} className="flex min-w-0 flex-1 flex-col items-center gap-1">
                    <div className="flex h-16 w-full items-end justify-center rounded bg-muted/40">
                      <div
                        className="w-full rounded bg-primary/70"
                        style={{ height: `${Math.round((d.total / maxDay) * 100)}%` }}
                        title={`${d.total} ligações · ${d.answered} atendidas`}
                      />
                    </div>
                    <span className="truncate text-[10px] text-muted-foreground">{d.label}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="flex flex-wrap gap-1.5">
              {quality.outcomes.length === 0 && (
                <p className="text-xs text-muted-foreground">Nenhuma ligação registrada nos últimos 7 dias.</p>
              )}
              {quality.outcomes.map((o) => (
                <Badge key={o.outcome} variant="secondary" className="gap-1 text-xs">
                  <PhoneIncoming className="h-3 w-3" /> {o.outcome} · {o.count}
                </Badge>
              ))}
            </div>

            <p className="mt-auto inline-flex items-center gap-1 text-xs text-muted-foreground">
              <Percent className="h-3 w-3" /> Etiquetar a situação antes de registrar melhora sua taxa.
            </p>
          </>
        )}
      </Card>

      {/* 3. Follow-ups + competição */}
      <div className="flex flex-col gap-4">
        <Card className="p-4">
          <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-2">
            <div className="flex min-w-0 items-center gap-2">
              <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-amber-500/15 text-amber-600 dark:text-amber-400">
                <CalendarClock className="h-4.5 w-4.5" />
              </span>
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold">Follow-ups de hoje</p>
                <p className="text-xs text-muted-foreground">{followups.length} pendente(s)</p>
              </div>
            </div>
            <Button asChild size="sm" variant="ghost">
              <Link to="/prospeccao/followups">Ver todos <ChevronRight className="ml-1 h-3.5 w-3.5" /></Link>
            </Button>
          </div>

          <div className="mt-3 space-y-1.5">
            {followups.length === 0 && (
              <p className="rounded-lg border border-dashed p-3 text-xs text-muted-foreground">
                Nenhum follow-up para hoje. Agende retornos direto no card do lead.
              </p>
            )}
            {followups.map((f) => {
              const atrasado = new Date(f.due_at).getTime() < Date.now();
              return (
                <Link
                  key={f.id}
                  to="/prospeccao/$leadId"
                  params={{ leadId: f.lead_id }}
                  className="flex items-center gap-2 rounded-lg border p-2 text-xs transition hover:bg-accent/50"
                >
                  <span className={cn(
                    "grid h-7 w-7 shrink-0 place-items-center rounded-md",
                    atrasado ? "bg-rose-500/15 text-rose-600 dark:text-rose-400" : "bg-muted text-muted-foreground",
                  )}>
                    {atrasado ? <AlertTriangle className="h-3.5 w-3.5" /> : <Clock className="h-3.5 w-3.5" />}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-medium">{f.lead_nome ?? "Lead"}</span>
                    <span className="block truncate text-muted-foreground">{f.title}</span>
                  </span>
                  <span className={cn("shrink-0 tabular-nums", atrasado ? "text-rose-600 dark:text-rose-400" : "text-muted-foreground")}>
                    {hora(f.due_at)}
                  </span>
                </Link>
              );
            })}
          </div>

          <div className="mt-3 flex flex-wrap gap-2 text-xs text-muted-foreground">
            <span className="inline-flex items-center gap-1"><CheckCircle2 className="h-3 w-3 text-emerald-500" /> Concluir no prazo pontua</span>
            <span className="inline-flex items-center gap-1"><MessageCircle className="h-3 w-3" /> WhatsApp antes da ligação</span>
          </div>
        </Card>

        <Link to="/producao/competicao" className="block">
          <CompeticaoRanking compact />
        </Link>
      </div>
    </div>
  );
}
