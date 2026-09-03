import { useCallback, useEffect, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Timer } from "lucide-react";
import { getUsoAtivo, registrarUsoAtivo } from "@/lib/uso/uso-ativo.functions";
import { useAuth } from "@/lib/auth";

/** Tempo sem interação que encerra a contagem (segundos). */
const IDLE_LIMIT = 30;
/** Intervalo de envio ao servidor (segundos). */
const FLUSH_EVERY = 30;

function fmt(total: number) {
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  return h > 0
    ? `${h}h${String(m).padStart(2, "0")}m`
    : `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

/**
 * Relógio de tempo realmente usado na plataforma. Só conta segundos em que a
 * aba está visível e houve interação (clique, teclado, scroll, mouse) nos
 * últimos 30 segundos — tempo fora do sistema não entra na conta.
 */
export function TempoAtivoBadge() {
  const { user } = useAuth();
  const ping = useServerFn(registrarUsoAtivo);
  const ler = useServerFn(getUsoAtivo);

  const [hoje, setHoje] = useState(0);
  const [semana, setSemana] = useState(0);
  const [ativo, setAtivo] = useState(false);

  const lastActivity = useRef(Date.now());
  const pending = useRef(0);
  const sinceFlush = useRef(0);

  const flush = useCallback(async () => {
    const segundos = pending.current;
    if (!segundos) return;
    pending.current = 0;
    try {
      const res = await ping({ data: { segundos: Math.min(segundos, 300) } });
      setHoje(res.hoje);
      setSemana(res.semana);
    } catch {
      pending.current += segundos; // tenta de novo no próximo ciclo
    }
  }, [ping]);

  useEffect(() => {
    if (!user) return;
    let alive = true;
    ler({ data: undefined as never })
      .then((res) => {
        if (!alive) return;
        setHoje(res.hoje);
        setSemana(res.semana);
      })
      .catch(() => undefined);
    return () => {
      alive = false;
    };
  }, [user, ler]);

  useEffect(() => {
    if (!user) return;

    const marcar = () => {
      lastActivity.current = Date.now();
    };
    const evts: Array<keyof DocumentEventMap> = [
      "pointerdown",
      "keydown",
      "wheel",
      "scroll",
      "mousemove",
      "touchstart",
    ];
    for (const e of evts) document.addEventListener(e, marcar, { passive: true });

    const tick = window.setInterval(() => {
      const idle = (Date.now() - lastActivity.current) / 1000;
      const contando = document.visibilityState === "visible" && idle <= IDLE_LIMIT;
      setAtivo(contando);
      if (!contando) return;
      pending.current += 1;
      setHoje((h) => h + 1);
      setSemana((s) => s + 1);
      sinceFlush.current += 1;
      if (sinceFlush.current >= FLUSH_EVERY) {
        sinceFlush.current = 0;
        void flush();
      }
    }, 1000);

    const onHide = () => {
      if (document.visibilityState === "hidden") void flush();
    };
    document.addEventListener("visibilitychange", onHide);
    window.addEventListener("pagehide", () => void flush());

    return () => {
      for (const e of evts) document.removeEventListener(e, marcar);
      window.clearInterval(tick);
      document.removeEventListener("visibilitychange", onHide);
      void flush();
    };
  }, [user, flush]);

  if (!user) return null;

  return (
    <div
      title={`Tempo ativo hoje. Nesta semana: ${fmt(semana)}. A contagem pausa após ${IDLE_LIMIT}s sem interação.`}
      className="flex items-center gap-2 rounded-full bg-accent px-3 py-1"
    >
      <span className="relative flex h-2 w-2">
        <span
          className={
            ativo
              ? "h-2 w-2 animate-pulse rounded-full bg-success"
              : "h-2 w-2 rounded-full bg-muted-foreground/40"
          }
        />
      </span>
      <Timer className="h-4 w-4 text-primary" />
      <span className="hidden text-xs text-muted-foreground lg:inline">Tempo ativo</span>
      <span className="text-lg font-bold leading-none tabular-nums text-foreground">{fmt(hoje)}</span>

    </div>
  );
}

export default TempoAtivoBadge;
