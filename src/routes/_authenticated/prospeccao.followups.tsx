import { createFileRoute, Navigate, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { useAuth } from "@/lib/auth";
import { useRhAccess } from "@/hooks/use-rh-access";
import { AppShell } from "@/components/AppShell";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { CalendarClock, Phone, AlertTriangle, BellRing, Clock3, CalendarPlus, Check } from "lucide-react";
import { whatsappLink } from "@/lib/prospeccao/constants";
import { WhatsAppIcon } from "@/components/WhatsAppIcon";
import {
  enviarLembretesFollowup, listarMeusFollowups, marcarFollowupVisto,
  reagendarFollowupUnificado, type FollowupUnificado,
} from "@/lib/prospeccao/followups.functions";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/prospeccao/followups")({
  head: () => ({ meta: [
    { title: "Follow-ups — Prospecção" },
    { name: "description", content: "Retornos agendados do CRM e de Tomadores AL em uma única lista." },
    { property: "og:title", content: "Follow-ups — Prospecção" },
    { property: "og:description", content: "Retornos agendados do CRM e de Tomadores AL em uma única lista." },
    { property: "og:type", content: "website" },
    { name: "twitter:card", content: "summary" },
    { name: "robots", content: "noindex,nofollow" },
  ] }),
  component: Page,
});

type Filtro = "atrasados" | "hoje" | "proximos" | "todos";
const FILTROS: { key: Filtro; label: string }[] = [
  { key: "atrasados", label: "Atrasados" }, { key: "hoje", label: "Hoje" },
  { key: "proximos", label: "Próximos" }, { key: "todos", label: "Todos" },
];
const fmtWhen = (iso: string) => new Date(iso).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });
const fimDoDia = () => { const d = new Date(); d.setHours(23, 59, 59, 999); return d.getTime(); };
const amanhaAs9 = () => { const d = new Date(); d.setDate(d.getDate() + 1); d.setHours(9, 0, 0, 0); return d; };

function Page() {
  const { user, loading } = useAuth();
  const { isAdmin } = useRhAccess();
  const listar = useServerFn(listarMeusFollowups);
  const marcarVisto = useServerFn(marcarFollowupVisto);
  const reagendarFn = useServerFn(reagendarFollowupUnificado);
  const dispararLembretes = useServerFn(enviarLembretesFollowup);
  const [items, setItems] = useState<FollowupUnificado[]>([]);
  const [loadingItems, setLoadingItems] = useState(true);
  const [filtro, setFiltro] = useState<Filtro>("atrasados");
  const [busy, setBusy] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);

  const load = async () => {
    try { setItems(await listar({ data: { limit: 300 } })); }
    catch (error) { toast.error(error instanceof Error ? error.message : "Não foi possível carregar os retornos."); }
    finally { setLoadingItems(false); }
  };
  useEffect(() => { if (user) void load(); }, [user]);

  const contagens = useMemo(() => {
    const agora = Date.now(), fim = fimDoDia();
    return {
      atrasados: items.filter((i) => new Date(i.due_at).getTime() <= agora).length,
      hoje: items.filter((i) => { const t = new Date(i.due_at).getTime(); return t > agora && t <= fim; }).length,
      proximos: items.filter((i) => new Date(i.due_at).getTime() > fim).length,
      todos: items.length,
    };
  }, [items]);
  const visiveis = useMemo(() => {
    const agora = Date.now(), fim = fimDoDia();
    return items.filter((i) => { const t = new Date(i.due_at).getTime(); return filtro === "atrasados" ? t <= agora : filtro === "hoje" ? t > agora && t <= fim : filtro === "proximos" ? t > fim : true; });
  }, [items, filtro]);

  const concluir = async (item: FollowupUnificado) => {
    setBusy(item.id);
    try { await marcarVisto({ data: { taskId: item.id } }); setItems((rows) => rows.filter((r) => r.id !== item.id)); window.dispatchEvent(new Event("followups-updated")); toast.success("Marcado como visto e concluído."); }
    catch (error) { toast.error(error instanceof Error ? error.message : "Não foi possível concluir."); }
    finally { setBusy(null); }
  };
  const reagendar = async (item: FollowupUnificado, quando: Date) => {
    setBusy(item.id);
    try { await reagendarFn({ data: { taskId: item.id, dueAt: quando.toISOString() } }); toast.success(`Reagendado para ${fmtWhen(quando.toISOString())}.`); await load(); window.dispatchEvent(new Event("followups-updated")); }
    catch (error) { toast.error(error instanceof Error ? error.message : "Não foi possível reagendar."); }
    finally { setBusy(null); }
  };
  const enviarLembrete = async () => {
    setEnviando(true);
    try { const res = await dispararLembretes(); toast.success(`${res.enviados} consultora(s) notificada(s).`); }
    catch (error) { toast.error(error instanceof Error ? error.message : "Falha ao enviar lembretes."); }
    finally { setEnviando(false); }
  };

  if (loading) return null;
  if (!user) return <Navigate to="/login" />;
  return (
    <AppShell>
      <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-orange-500/15 text-orange-600 dark:text-orange-400"><CalendarClock className="h-5 w-5" /></div>
          <div><h1 className="flex items-center gap-2 text-2xl font-bold">Follow-ups {contagens.atrasados > 0 && <Badge variant="destructive">{contagens.atrasados}</Badge>}</h1><p className="text-sm text-muted-foreground">CRM e Tomadores AL na mesma agenda.</p></div>
        </div>
        {isAdmin && <Button onClick={enviarLembrete} disabled={enviando}><BellRing className="mr-2 h-4 w-4" />{enviando ? "Enviando…" : "Enviar lembrete a todas"}</Button>}
      </div>
      <div className="mb-4 flex flex-wrap gap-2">
        {FILTROS.map((f) => <Button key={f.key} size="sm" variant={filtro === f.key ? "default" : "outline"} onClick={() => setFiltro(f.key)}>{f.label} ({contagens[f.key]})</Button>)}
      </div>
      <div className="space-y-2">
        {loadingItems && <p className="text-sm text-muted-foreground">Carregando…</p>}
        {!loadingItems && visiveis.length === 0 && <Card className="p-8 text-center text-sm text-muted-foreground">Nenhum follow-up neste filtro.</Card>}
        {visiveis.map((item) => {
          const atrasado = new Date(item.due_at).getTime() <= Date.now();
          const destino = item.origem === "crm" ? <Link to="/prospeccao/$leadId" params={{ leadId: item.cliente_id }} className="truncate font-semibold hover:underline">{item.nome}</Link> : <Link to="/tomadores-al" className="truncate font-semibold hover:underline">{item.nome}</Link>;
          return <Card key={item.id} className={cn("flex flex-col gap-3 p-4 sm:flex-row sm:items-center", atrasado && "border-orange-500/40")}>
            <div className="min-w-0 flex-1"><div className="flex flex-wrap items-center gap-2">{destino}<Badge variant="outline">{item.origem === "crm" ? "CRM" : "Tomadores AL"}</Badge>{atrasado && <Badge variant="destructive"><AlertTriangle className="mr-1 h-3 w-3" />Atrasado</Badge>}</div><div className="mt-1 flex flex-wrap gap-3 text-xs text-muted-foreground">{item.telefone && <span className="flex items-center gap-1"><Phone className="h-3 w-3" />{item.telefone}</span>}<span className="flex items-center gap-1"><CalendarClock className="h-3 w-3" />{fmtWhen(item.due_at)}</span></div></div>
            <div className="flex flex-wrap items-center gap-1.5">
              <Button variant="outline" size="sm" disabled={busy === item.id} onClick={() => reagendar(item, new Date(Date.now() + 3_600_000))}><Clock3 className="mr-1 h-3.5 w-3.5" />+1h</Button>
              <Button variant="outline" size="sm" disabled={busy === item.id} onClick={() => reagendar(item, amanhaAs9())}><CalendarPlus className="mr-1 h-3.5 w-3.5" />Amanhã 9h</Button>
              {item.telefone && <Button variant="outline" size="icon" asChild><a href={`tel:${item.telefone.replace(/\D/g, "")}`} title="Ligar"><Phone className="h-4 w-4" /></a></Button>}
              {whatsappLink(item.telefone) && <Button variant="outline" size="icon" asChild><a href={whatsappLink(item.telefone) ?? "#"} target="_blank" rel="noopener noreferrer" title="WhatsApp"><WhatsAppIcon className="h-4 w-4" /></a></Button>}
              <Button size="sm" disabled={busy === item.id} onClick={() => concluir(item)}><Check className="mr-1 h-4 w-4" />Marcar como visto</Button>
            </div>
          </Card>;
        })}
      </div>
    </AppShell>
  );
}