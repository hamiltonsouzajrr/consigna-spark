// Lembretes automáticos de follow-up: pop-up em tela + notificação do navegador
// para retornos atrasados e chamadas agendadas na antecedência configurada.
// Só avisa dentro da janela de horário configurada pela consultora.
import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "@tanstack/react-router";
import { CalendarClock, Phone, AlertTriangle, Settings2, BellRing, Check, Clock3 } from "lucide-react";
import { useServerFn } from "@tanstack/react-start";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { whatsappLink } from "@/lib/prospeccao/constants";
import { WhatsAppIcon } from "@/components/WhatsAppIcon";
import { cn } from "@/lib/utils";
import { listarMeusFollowups, marcarFollowupVisto, reagendarFollowupUnificado, type FollowupUnificado } from "@/lib/prospeccao/followups.functions";
import { toast } from "sonner";

const SNOOZE_KEY = "followup-popup-snooze";
const CONFIG_KEY = "followup-reminder-config";
const NOTIFIED_KEY = "followup-reminder-notified";
const SNOOZE_MIN = 10;

type Config = {
  enabled: boolean;
  antecedenciaMin: number;
  checarMin: number;
  horaInicio: string;
  horaFim: string;
  notificacao: boolean;
  som: boolean;
};

const DEFAULT_CONFIG: Config = {
  enabled: true,
  antecedenciaMin: 15,
  checarMin: 1,
  horaInicio: "08:00",
  horaFim: "19:00",
  notificacao: true,
  som: true,
};

function readConfig(): Config {
  try {
    const raw = window.localStorage.getItem(CONFIG_KEY);
    return raw ? { ...DEFAULT_CONFIG, ...(JSON.parse(raw) as Partial<Config>) } : DEFAULT_CONFIG;
  } catch { return DEFAULT_CONFIG; }
}

function snoozedUntil(): number {
  try { return Number(window.localStorage.getItem(SNOOZE_KEY)) || 0; } catch { return 0; }
}

function dentroDaJanela(cfg: Config) {
  const now = new Date();
  const min = now.getHours() * 60 + now.getMinutes();
  const toMin = (v: string) => {
    const [h, m] = v.split(":").map(Number);
    return (h ?? 0) * 60 + (m ?? 0);
  };
  const ini = toMin(cfg.horaInicio);
  const fim = toMin(cfg.horaFim);
  return ini <= fim ? min >= ini && min <= fim : min >= ini || min <= fim;
}

function jaNotificados(): string[] {
  try { return JSON.parse(window.localStorage.getItem(NOTIFIED_KEY) ?? "[]") as string[]; } catch { return []; }
}

function marcarNotificados(ids: string[]) {
  try {
    const merged = Array.from(new Set([...jaNotificados(), ...ids])).slice(-200);
    window.localStorage.setItem(NOTIFIED_KEY, JSON.stringify(merged));
  } catch { /* ignore */ }
}

function playAlertSound() {
  try {
    const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.type = "sine";
    osc.frequency.setValueAtTime(880, ctx.currentTime);
    osc.frequency.setValueAtTime(660, ctx.currentTime + 0.15);
    osc.frequency.setValueAtTime(880, ctx.currentTime + 0.3);
    gain.gain.setValueAtTime(0.3, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.5);
    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + 0.5);
  } catch { /* ignore browsers that block audio */ }
}

export function FollowupPopup() {
  const { user } = useAuth();
  const listar = useServerFn(listarMeusFollowups);
  const marcarVisto = useServerFn(marcarFollowupVisto);
  const reagendar = useServerFn(reagendarFollowupUnificado);
  const [leads, setLeads] = useState<FollowupUnificado[]>([]);
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [config, setConfig] = useState<Config>(DEFAULT_CONFIG);
  const [configOpen, setConfigOpen] = useState(false);

  useEffect(() => { setConfig(readConfig()); }, []);

  const salvarConfig = useCallback((patch: Partial<Config>) => {
    setConfig((prev) => {
      const next = { ...prev, ...patch };
      try { window.localStorage.setItem(CONFIG_KEY, JSON.stringify(next)); } catch { /* ignore */ }
      return next;
    });
  }, []);

  const pedirPermissao = useCallback(async () => {
    if (typeof Notification === "undefined") return;
    if (Notification.permission === "default") await Notification.requestPermission();
  }, []);

  useEffect(() => {
    if (!user || !config.enabled) return;
    let cancelled = false;

    const notificar = (rows: FollowupUnificado[]) => {
      if (!config.notificacao || typeof Notification === "undefined") return;
      if (Notification.permission !== "granted") return;
      const vistos = jaNotificados();
      const novos = rows.filter((l) => !vistos.includes(`${l.id}:${l.due_at}`));
      if (novos.length === 0) return;
      const primeiro = novos[0]!;
      new Notification(
        novos.length === 1 ? "\u26A0\uFE0F Follow-up agora" : `\u26A0\uFE0F ${novos.length} follow-ups aguardando`,
        {
          body: novos.length === 1
            ? `${primeiro.nome} \u00B7 ${new Date(primeiro.due_at).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}`
            : `Comece por ${primeiro.nome}. N\u00E3o perca a venda!`,
          tag: "followup-reminder",
          requireInteraction: true,
        },
      );
      marcarNotificados(novos.map((l) => `${l.id}:${l.due_at}`));
    };

    const load = async () => {
      if (!dentroDaJanela(config)) return;
      if (Date.now() < snoozedUntil()) return;
      const limite = new Date(Date.now() + config.antecedenciaMin * 60_000).toISOString();
      const data = await listar({ data: { ate: limite, limit: 20 } });
      if (cancelled) return;
      const rows = data ?? [];
      setLeads(rows);
      if (rows.length > 0) {
        setOpen(true);
        notificar(rows);
        if (config.som) playAlertSound();
      }
    };

    load();
    const id = setInterval(load, Math.max(1, config.checarMin) * 60_000);
    return () => { cancelled = true; clearInterval(id); };
  }, [user, config, listar]);

  const proximos = useMemo(() => leads.slice(0, 5), [leads]);
  const atrasados = useMemo(
    () => leads.filter((l) => new Date(l.due_at).getTime() < Date.now()).length,
    [leads],
  );

  if (!user) return null;

  const snooze = () => {
    try { window.localStorage.setItem(SNOOZE_KEY, String(Date.now() + SNOOZE_MIN * 60_000)); } catch { /* ignore */ }
    setOpen(false);
  };

  const concluir = async (id: string) => {
    setBusy(id);
    try {
      await marcarVisto({ data: { taskId: id } });
      setLeads((rows) => rows.filter((row) => row.id !== id));
      window.dispatchEvent(new Event("followups-updated"));
      toast.success("Follow-up concluído. Este aviso não aparecerá novamente.");
    } catch (error) { toast.error(error instanceof Error ? error.message : "Não foi possível concluir."); }
    finally { setBusy(null); }
  };

  const adiar = async (id: string) => {
    setBusy(id);
    try {
      const dueAt = new Date(Date.now() + 60 * 60 * 1000).toISOString();
      await reagendar({ data: { taskId: id, dueAt } });
      setLeads((rows) => rows.filter((row) => row.id !== id));
      window.dispatchEvent(new Event("followups-updated"));
      toast.success("Follow-up reagendado para daqui a 1 hora.");
    } catch (error) { toast.error(error instanceof Error ? error.message : "Não foi possível reagendar."); }
    finally { setBusy(null); }
  };

  return (
    <>
      <Dialog open={open && leads.length > 0} onOpenChange={(v) => (v ? setOpen(true) : snooze())}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <CalendarClock className="h-5 w-5 text-orange-500" />
              {leads.length === 1 ? "Você tem 1 follow-up agora" : `Você tem ${leads.length} follow-ups agora`}
            </DialogTitle>
            <div className="flex flex-wrap items-center gap-2">
              <DialogDescription>
                Retorne, reagende ou marque como visto para encerrar definitivamente.
              </DialogDescription>
              {atrasados > 0 && (
                <Badge variant="destructive" className="gap-1 text-[10px]">
                  <AlertTriangle className="h-3 w-3" /> {atrasados} atrasado(s)
                </Badge>
              )}
            </div>
          </DialogHeader>

          <div className="space-y-2">
            {proximos.map((l) => {
              const atrasado = new Date(l.due_at).getTime() < Date.now();
              return (
                <div key={l.id} className={cn("flex items-center gap-2 rounded-lg border p-2", atrasado && "border-rose-500/40 bg-rose-500/5")}>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{l.nome}</p>
                    <p className={cn("text-xs", atrasado ? "text-rose-600 dark:text-rose-400" : "text-muted-foreground")}>
                       {new Date(l.due_at).toLocaleString("pt-BR", {
                        day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit",
                      })}
                      {atrasado ? " · atrasado" : ""}
                    </p>
                    <Badge variant="outline" className="mt-1 text-[10px]">{l.origem === "tomadores_al" ? "Tomadores AL" : "CRM"}</Badge>
                  </div>
                  {l.telefone && (
                    <a
                      href={`tel:${l.telefone.replace(/\D/g, "")}`}
                      className="inline-flex h-8 w-8 items-center justify-center rounded-md bg-primary/15 text-primary"
                      title="Ligar"
                    >
                      <Phone className="h-4 w-4" />
                    </a>
                  )}
                  {whatsappLink(l.telefone) && (
                    <a
                      href={whatsappLink(l.telefone)!}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex h-8 w-8 items-center justify-center rounded-md bg-emerald-500/15 text-emerald-600 dark:text-emerald-400"
                      title="WhatsApp"
                    >
                      <WhatsAppIcon className="h-4 w-4" />
                    </a>
                  )}
                   <Button size="sm" variant="outline" onClick={() => adiar(l.id)} disabled={busy === l.id} title="Reagendar para daqui a uma hora"><Clock3 className="h-4 w-4" /></Button>
                   <Button size="sm" onClick={() => concluir(l.id)} disabled={busy === l.id}><Check className="mr-1 h-4 w-4" /> Visto</Button>
                </div>
              );
            })}
            {leads.length > proximos.length && (
              <p className="text-xs text-muted-foreground">+ {leads.length - proximos.length} outros agendamentos.</p>
            )}
          </div>

          <DialogFooter className="gap-2 sm:justify-between">
            <div className="flex items-center gap-1">
              <Button variant="ghost" onClick={snooze}>Lembrar em {SNOOZE_MIN} min</Button>
              <Button variant="ghost" size="icon" title="Configurar lembretes" onClick={() => setConfigOpen(true)}>
                <Settings2 className="h-4 w-4" />
              </Button>
            </div>
            <Button asChild onClick={() => setOpen(false)}>
              <Link to="/prospeccao/followups">Abrir Follow-ups</Link>
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={configOpen} onOpenChange={setConfigOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <BellRing className="h-5 w-5 text-amber-500" /> Lembretes automáticos
            </DialogTitle>
            <DialogDescription>
              Defina quando você quer ser avisada dos follow-ups atrasados e das chamadas agendadas.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="flex items-center justify-between gap-3">
              <Label htmlFor="fu-enabled" className="text-sm">Lembretes ativos</Label>
              <Switch
                id="fu-enabled"
                checked={config.enabled}
                onCheckedChange={(v) => salvarConfig({ enabled: v })}
              />
            </div>

            <div className="flex items-center justify-between gap-3">
              <Label htmlFor="fu-notif" className="text-sm">Notificação do navegador</Label>
              <Switch
                id="fu-notif"
                checked={config.notificacao}
                onCheckedChange={async (v) => { salvarConfig({ notificacao: v }); if (v) await pedirPermissao(); }}
              />
            </div>

            <div className="flex items-center justify-between gap-3">
              <Label htmlFor="fu-som" className="text-sm">Som de alerta</Label>
              <Switch
                id="fu-som"
                checked={config.som}
                onCheckedChange={(v) => salvarConfig({ som: v })}
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label htmlFor="fu-ini" className="text-xs">Avisar a partir de</Label>
                <Input
                  id="fu-ini" type="time" value={config.horaInicio}
                  onChange={(e) => salvarConfig({ horaInicio: e.target.value })}
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="fu-fim" className="text-xs">Avisar até</Label>
                <Input
                  id="fu-fim" type="time" value={config.horaFim}
                  onChange={(e) => salvarConfig({ horaFim: e.target.value })}
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-xs">Antecedência</Label>
                <Select
                  value={String(config.antecedenciaMin)}
                  onValueChange={(v) => salvarConfig({ antecedenciaMin: Number(v) })}
                >
                  <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="0">Na hora</SelectItem>
                    <SelectItem value="5">5 min antes</SelectItem>
                    <SelectItem value="10">10 min antes</SelectItem>
                    <SelectItem value="15">15 min antes</SelectItem>
                    <SelectItem value="30">30 min antes</SelectItem>
                    <SelectItem value="60">1 hora antes</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Verificar a cada</Label>
                <Select
                  value={String(config.checarMin)}
                  onValueChange={(v) => salvarConfig({ checarMin: Number(v) })}
                >
                  <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="1">1 minuto</SelectItem>
                    <SelectItem value="2">2 minutos</SelectItem>
                    <SelectItem value="3">3 minutos</SelectItem>
                    <SelectItem value="5">5 minutos</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

          </div>

          <DialogFooter>
            <Button onClick={() => setConfigOpen(false)}>Concluir</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
