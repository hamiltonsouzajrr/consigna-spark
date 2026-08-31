import { useCallback, useEffect, useRef, useState } from "react";
import { Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { AlertTriangle, BellRing, Check, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { registrarAlertaBaseEsgotadaTomadores } from "@/lib/prospeccao/tomadores-al.notificacoes";

// Situações que contam como lead "em aberto" na base de Tomadores AL.
const STATUS_ABERTOS = ["novo", "contatado", "proposta_enviada"];
const KEY_OCULTO = "tomadores_al_base_esgotada_oculto_ate";

async function contarLeadsLivres(): Promise<number> {
  const { count, error } = await supabase
    .from("tomadores_al")
    .select("id", { count: "exact", head: true })
    .is("consultora_responsavel", null)
    .in("status_abordagem", STATUS_ABERTOS);
  if (error) throw error;
  return count ?? 0;
}

// Beep curto (dois tons) para chamar a atenção do admin quando a base acabar.
function tocarAlarme() {
  if (typeof window === "undefined") return;
  try {
    const Ctx =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctx) return;
    const ctx = new Ctx();
    const beep = (freq: number, inicio: number, duracao: number) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "sine";
      osc.frequency.value = freq;
      osc.connect(gain);
      gain.connect(ctx.destination);
      gain.gain.setValueAtTime(0.0001, ctx.currentTime + inicio);
      gain.gain.exponentialRampToValueAtTime(0.15, ctx.currentTime + inicio + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + inicio + duracao);
      osc.start(ctx.currentTime + inicio);
      osc.stop(ctx.currentTime + inicio + duracao + 0.05);
    };
    beep(880, 0, 0.35);
    beep(660, 0.45, 0.45);
  } catch {
    // Navegador sem suporte a áudio.
  }
}

// Notificação nativa do navegador (fora do app).
function notificarNavegador() {
  if (typeof window === "undefined" || !("Notification" in window)) return;
  if (Notification.permission === "default") {
    Notification.requestPermission().catch(() => {});
  }
  if (Notification.permission === "granted") {
    try {
      new Notification("Base de Tomadores AL acabou", {
        body: "Não há leads livres com margem para distribuir. Importe uma nova planilha ou libere leads parados.",
        icon: "/favicon.png",
      });
    } catch {
      // Alguns navegadores bloqueiam notificação fora de HTTPS.
    }
  }
}

export function BaseTomadoresEsgotadaBanner() {
  const registrarAlerta = useServerFn(registrarAlertaBaseEsgotadaTomadores);
  const [livres, setLivres] = useState<number | null>(null);
  const [vistoAte, setVistoAte] = useState<number>(() => {
    if (typeof window === "undefined") return 0;
    try {
      return Number(window.localStorage.getItem(KEY_OCULTO)) || 0;
    } catch {
      return 0;
    }
  });
  const alertou = useRef(false);

  const esgotada = livres !== null && livres === 0 && Date.now() > vistoAte;

  const verificar = useCallback(async () => {
    try {
      const n = await contarLeadsLivres();
      setLivres(n);
    } catch {
      // Sem permissão de leitura: mantém o estado anterior.
    }
  }, []);

  useEffect(() => {
    void verificar();
    const id = setInterval(verificar, 60_000);
    return () => clearInterval(id);
  }, [verificar]);

  useEffect(() => {
    if (!esgotada || alertou.current) return;
    alertou.current = true;
    tocarAlarme();
    notificarNavegador();
    // Registra o alerta no banco (diario_alertas) para ficar documentado.
    registrarAlerta().catch(() => {});
  }, [esgotada, registrarAlerta]);

  if (!esgotada) return null;

  const marcarVisto = () => {
    const ate = Date.now() + 30 * 60_000;
    try {
      window.localStorage.setItem(KEY_OCULTO, String(ate));
    } catch {
      // Armazenamento indisponível.
    }
    setVistoAte(ate);
  };

  return (
    <div className="mb-4 flex flex-col gap-3 rounded-xl border border-amber-400/60 bg-amber-50 p-4 shadow-sm dark:border-amber-500/30 dark:bg-amber-950/30 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex items-start gap-3">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-amber-500/20">
          <AlertTriangle className="h-5 w-5 text-amber-600 dark:text-amber-400" />
        </span>
        <div className="min-w-0">
          <p className="flex flex-wrap items-center gap-2 text-sm font-semibold text-amber-900 dark:text-amber-200">
            <BellRing className="h-4 w-4" />
            Base de Tomadores AL acabou
          </p>
          <p className="mt-1 text-xs leading-relaxed text-amber-800 dark:text-amber-300">
            Não há mais leads livres com margem para distribuir entre as consultoras. As carteiras
            só serão repostas depois de importar uma nova planilha ou liberar leads parados em
            carteiras de consultoras inativas. O aviso é reavaliado a cada 60 segundos e também fica
            registrado como alerta no sistema.
          </p>
        </div>
      </div>
      <div className="flex shrink-0 flex-wrap gap-2">
        <Button size="sm" variant="outline" onClick={marcarVisto}>
          <Check className="mr-2 h-4 w-4" /> Já vi (30 min)
        </Button>
        <Button size="sm" asChild>
          <Link to="/prospeccao/admin">
            <Upload className="mr-2 h-4 w-4" /> Distribuir / importar
          </Link>
        </Button>
      </div>
    </div>
  );
}
