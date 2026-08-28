// Lembretes automáticos de follow-up: pop-up em tela + notificação do navegador
// para retornos atrasados e chamadas agendadas na antecedência configurada.
// Só avisa dentro da janela de horário configurada pela consultora.
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link } from "@tanstack/react-router";
import { CalendarClock, Phone, AlertTriangle, Settings2, BellRing } from "lucide-react";
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

const SNOOZE_KEY = "followup-popup-snooze";
const CONFIG_KEY = "followup-reminder-config";
const NOTIFIED_KEY = "followup-reminder-notified";
const SNOOZE_MIN = 10;
const REESCALATION_MIN = 5; // reabre o popup se nenhuma ação em 5 min

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

type Lead = { id: string; nome: string; telefone: string | null; next_follow_up_at: string };

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
  const [leads, setLeads] = useState<Lead[]>([]);
  const [open, setOpen] = useState(false);
  const [urgente, setUrgente] = useState(false);
  const [config, setConfig] = useState<Config>(DEFAULT_CONFIG);
  const [configOpen, setConfigOpen] = useState(false);
  const lastShownRef = useRef<number>(0);
  const actionTakenRef = useRef<boolean>(false);

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

  // Re-escalation: if popup was shown but no action was taken, reopen after REESCALATION_MIN
  useEffect(() => {
    if (!config.enabled || leads.length === 0) return;
    const id = setInterval(() => {
      if (actionTakenRef.current) return;
      const elapsed = Date.now() - lastShownRef.current;
      if (elapsed >= REESCALATION_MIN * 60_000 && lastShownRef.current > 0) {
        setUrgente(true);
        setOpen(true);
        if (config.som) playAlertSound();
        lastShownRef.current = Date.now();
      }
    }, 30_000);
    return () => clearInterval(id);
  }, [config.enabled, config.som, leads.length]);

  useEffect(() => {
    if (!user || !config.enabled) return;
    let cancelled = false;

    const notificar = (rows: Lead[]) => {
      if (!config.notificacao || typeof Notification === "undefined") return;
      if (Notification.permission !== "granted") return;
      const vistos = jaNotificados();
      const novos = rows.filter((l) => !vistos.includes(`${l.id}:${l.next_follow_up_at}`));
      if (novos.length === 0) return;
      const primeiro = novos[0]!;
      new Notification(
        novos.length === 1 ? "\u26A0\uFE0F Follow-up agora" : `\u26A0\uFE0F ${novos.length} follow-ups aguardando`,
        {
          body: novos.length === 1
            ? `${primeiro.nome} \u00B7 ${new Date(primeiro.next_follow_up_at).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}`
            : `Comece por ${primeiro.nome}. N\u00E3o perca a venda!`,
          tag: "followup-reminder",
          requireInteraction: true,
        },
      );
      marcarNotificados(novos.map((l) => `${l.id}:${l.next_follow_up_at}`));
    };

    const load = async () => {
      if (!dentroDaJanela(config)) return;
      if (Date.now() < snoozedUntil()) return;
      const limite = new Date(Date.now() + config.antecedenciaMin * 60_000).toISOString();
      const { data } = await supabase
        .from("prospect_leads")
        .select("id,nome,telefone,next_follow_up_at")
        .eq("consultant_id", user.id)
        .not("next_follow_up_at", "is", null)
        .lte("next_follow_up_at", limite)
        .not("status", "in", "(ganho,perdido)")
        .order("next_follow_up_at", { ascending: true })
        .limit(20);
      if (cancelled) return;
      const rows = (data ?? []) as Lead[];
      setLeads(rows);
      if (rows.length > 0) {
        setOpen(true);
        setUrgente(false);
        actionTakenRef.current = false;
        lastShownRef.current = Date.now();
        notificar(rows);
        if (config.som) playAlertSound();
      }
    };

    load();
    const id = setInterval(load, Math.max(1, config.checarMin) * 60_000);
    return () => { cancelled = true; clearInterval(id); };
  }, [user, config]);

  const proximos = useMemo(() => leads.slice(0, 5), [leads]);
  const atrasados = useMemo(
    () => leads.filter((l) => new Date(l.next_follow_up_at).getTime() < Date.now()).length,
    [leads],
  );

  if (!user) return null;

  const snooze = () => {
    try { window.localStorage.setItem(SNOOZE_KEY, String(Date.now() + SNOOZE_MIN * 60_000)); } catch { /* ignore */ }
    setOpen(false);
    setUrgente(false);
  };

  const markAction = () => {
    actionTakenRef.current = true;
    setOpen(false);
    setUrgente(false);
  };

  return (
    <>
      <Dialog open={open && leads.length > 0} onOpenChange={(v) => (v ? setOpen(true) : snooze())}>
        <DialogContent className={cn("sm:max-w-md", urgente && "border-orange-500 ring-2 ring-orange-500/30")}>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <CalendarClock className={cn("h-5 w-5", urgente ? "text-red-500 animate-pulse" : "text-orange-500")} />
              {urgente && <span className="text-xs font-bold uppercase text-red-500">URGENTE — </span>}
              {leads.length === 1 ? "Você tem 1 follow-up agora" : `Você tem ${leads.length} follow-ups agora`}
            </DialogTitle>
            <div className="flex flex-wrap items-center gap-2">
              <DialogDescription>
                {urgente
                  ? "Esse lembrete já foi exibido antes. Faça o contato agora para não perder a venda!"
                  : "Retorne o contato para não perder a venda."}
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
              const atrasado = new Date(l.next_follow_up_at).getTime() < Date.now();
              return (
                <div key={l.id} className={cn("flex items-center gap-2 rounded-lg border p-2", atrasado && "border-rose-500/40 bg-rose-500/5")}>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{l.nome}</p>
                    <p className={cn("text-xs", atrasado ? "text-rose-600 dark:text-rose-400" : "text-muted-foreground")}>
                      {new Date(l.next_follow_up_at).toLocaleString("pt-BR", {
                        day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit",
                      })}
                      {atrasado ? " · atrasado" : ""}
                    </p>
                  </div>
                  {l.telefone && (
                    <a
                      href={`tel:${l.telefone.replace(/\D/g, "")}`}
                      className="inline-flex h-8 w-8 items-center justify-center rounded-md bg-primary/15 text-primary"
                      title="Ligar"
                      onClick={markAction}
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
                      onClick={markAction}
                    >
                      <WhatsAppIcon className="h-4 w-4" />
                    </a>
                  )}
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
            <Button asChild onClick={markAction}>
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

            <div className="rounded-lg border border-amber-500/30 bg-amber-500/5 p-3">
              <p className="text-xs text-amber-700 dark:text-amber-300">
                <strong>Reescalonamento:</strong> se você não agir em {REESCALATION_MIN} minutos após o aviso, o lembrete reabrirá como urgente com som.
              </p>
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
