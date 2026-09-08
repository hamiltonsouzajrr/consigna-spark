// Indicador de ritmo de prospecção do dia (topbar) + pop-up que instiga a
// consultora a manter o ritmo necessário para bater a meta diária.
import { useEffect, useMemo, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { Gauge, Zap } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { getJornadaHoje } from "@/lib/prospeccao/jornada.functions";
import { agoraMinutosMaceio, calcularRitmo, formatarDuracao } from "@/lib/prospeccao/jornada";
import { JornadaDialog } from "@/components/prospeccao/JornadaDialog";
import { cn } from "@/lib/utils";

const NUDGE_MS = 30 * 60 * 1000; // lembrete a cada 30 minutos de uso

function nudgeKey() {
  return `ritmo-nudge-${new Date().toISOString().slice(0, 10)}`;
}

export function RitmoDiario() {
  const fetchJornada = useServerFn(getJornadaHoje);
  const q = useQuery({
    queryKey: ["prospeccao", "jornada"],
    queryFn: () => fetchJornada(),
    staleTime: 60_000,
    refetchInterval: 120_000,
  });

  const [agora, setAgora] = useState<number | null>(null);
  const [configOpen, setConfigOpen] = useState(false);
  const [nudgeOpen, setNudgeOpen] = useState(false);
  // Só perguntamos a jornada uma vez por sessão: se a consultora fechar sem
  // salvar, a janela não volta sozinha a cada atualização dos contadores.
  const jaPerguntou = useRef(false);

  useEffect(() => {
    setAgora(agoraMinutosMaceio());
    const id = setInterval(() => setAgora(agoraMinutosMaceio()), 60_000);
    return () => clearInterval(id);
  }, []);

  // Primeiro acesso: pergunta a jornada e o horário do almoço.
  useEffect(() => {
    if (!q.data || q.data.configurada || jaPerguntou.current) return;
    jaPerguntou.current = true;
    setConfigOpen(true);
  }, [q.data]);


  const ritmo = useMemo(() => {
    if (!q.data || agora === null) return null;
    return calcularRitmo(q.data.jornada, agora, q.data.feitas);
  }, [q.data, agora]);

  // Pop-up periódico de ritmo enquanto a jornada está ativa.
  useEffect(() => {
    if (!ritmo) return;
    const check = () => {
      if (!["em_dia", "atras", "adiantada"].includes(ritmo.estado)) return;
      let ultimo = 0;
      try { ultimo = Number(window.localStorage.getItem(nudgeKey()) ?? 0); } catch { /* ignore */ }
      if (Date.now() - ultimo < NUDGE_MS) return;
      try { window.localStorage.setItem(nudgeKey(), String(Date.now())); } catch { /* ignore */ }
      setNudgeOpen(true);
    };
    const id = setTimeout(check, 20_000);
    const iv = setInterval(check, 5 * 60 * 1000);
    return () => { clearTimeout(id); clearInterval(iv); };
  }, [ritmo]);

  if (!q.data || !ritmo) return null;

  const tom =
    ritmo.estado === "concluida" ? "text-success"
    : ritmo.estado === "atras" ? "text-destructive"
    : ritmo.estado === "adiantada" ? "text-success"
    : "text-foreground";

  const rotulo =
    ritmo.estado === "concluida" ? "meta batida 🎉"
    : ritmo.estado === "fora" ? "fora do expediente"
    : ritmo.estado === "almoco" ? "almoço"
    : ritmo.estado === "atras" ? `${ritmo.porHora}/h p/ virar`
    : `${ritmo.porHora}/h`;

  return (
    <>
      <button
        type="button"
        onClick={() => setConfigOpen(true)}
        title="Ritmo de prospecção do dia — clique para ajustar jornada e almoço"
        className="flex items-center gap-2 rounded-full bg-accent px-4 py-1 transition hover:bg-accent/80"
      >
        <Gauge className={cn("h-4 w-4", tom)} />
        <span className="text-sm text-muted-foreground">Ritmo</span>
        <span className={cn("text-xl font-bold leading-none tabular-nums", tom)}>
          {ritmo.feitas}/{ritmo.meta}
        </span>
        <span className="h-1.5 w-16 overflow-hidden rounded-full bg-border">
          <span
            className={cn("block h-full rounded-full", ritmo.estado === "atras" ? "bg-destructive" : "bg-success")}
            style={{ width: `${ritmo.pct}%` }}
          />
        </span>
        <span className="hidden text-xs text-muted-foreground lg:inline">{rotulo}</span>
      </button>

      <JornadaDialog open={configOpen} onOpenChange={setConfigOpen} jornada={q.data.jornada} />

      <Dialog open={nudgeOpen} onOpenChange={setNudgeOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Zap className="h-5 w-5 text-primary" />
              {ritmo.estado === "atras" ? "Você está atrás do ritmo" : "Ritmo em dia — mantenha o pé no acelerador"}
            </DialogTitle>
            <DialogDescription>
              Meta de {ritmo.meta} prospecções hoje, dividida pelo seu expediente (almoço já descontado).
            </DialogDescription>
          </DialogHeader>

          <div className="grid grid-cols-2 gap-2 text-sm">
            <div className="rounded-lg border bg-muted/30 p-3">
              <p className="text-xs text-muted-foreground">Feitas</p>
              <p className="text-2xl font-bold tabular-nums">{ritmo.feitas}</p>
              <p className="text-[11px] text-muted-foreground">
                {q.data.ligacoes} ligações · {q.data.whatsapps} WhatsApp
              </p>
            </div>
            <div className="rounded-lg border bg-muted/30 p-3">
              <p className="text-xs text-muted-foreground">Esperado agora</p>
              <p className="text-2xl font-bold tabular-nums">{ritmo.esperado}</p>
              <p className="text-[11px] text-muted-foreground">
                {ritmo.saldo >= 0 ? `+${ritmo.saldo} adiantada` : `${ritmo.saldo} atrás`}
              </p>
            </div>
            <div className="rounded-lg border bg-muted/30 p-3">
              <p className="text-xs text-muted-foreground">Faltam</p>
              <p className="text-2xl font-bold tabular-nums">{ritmo.faltam}</p>
              <p className="text-[11px] text-muted-foreground">em {formatarDuracao(ritmo.minutosRestantes)}</p>
            </div>
            <div className="rounded-lg border bg-primary/10 p-3">
              <p className="text-xs text-muted-foreground">Ritmo necessário</p>
              <p className="text-2xl font-bold tabular-nums text-primary">{ritmo.porHora}/h</p>
              <p className="text-[11px] text-muted-foreground">≈ {ritmo.por10min} a cada 10 min</p>
            </div>
          </div>

          <Badge variant="outline" className="w-fit text-[11px]">
            {ritmo.estado === "atras"
              ? "Dá tempo: faça blocos de 10 chamadas sem pausa e reavalie."
              : "Cada contato agora vale mais do que dobrar o esforço no fim do dia."}
          </Badge>

          <DialogFooter className="gap-2">
            <Button variant="ghost" onClick={() => { setNudgeOpen(false); setConfigOpen(true); }}>
              Ajustar jornada
            </Button>
            <Button onClick={() => setNudgeOpen(false)}>Vou prospectar agora</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
