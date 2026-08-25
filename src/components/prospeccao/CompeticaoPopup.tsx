import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Trophy, Gift, PartyPopper } from "lucide-react";
import { getFechamentoPendente } from "@/lib/prospeccao/competicao.functions";
import { useAuth } from "@/lib/auth";

type Fechamento = Awaited<ReturnType<typeof getFechamentoPendente>>;

/** Short celebratory chime via Web Audio (no asset needed). */
function tocarSom() {
  try {
    const Ctx = window.AudioContext || (window as any).webkitAudioContext;
    if (!Ctx) return;
    const ctx = new Ctx();
    [523.25, 659.25, 783.99, 1046.5].forEach((freq, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "triangle";
      osc.frequency.value = freq;
      const start = ctx.currentTime + i * 0.16;
      gain.gain.setValueAtTime(0.0001, start);
      gain.gain.exponentialRampToValueAtTime(0.25, start + 0.03);
      gain.gain.exponentialRampToValueAtTime(0.0001, start + 0.4);
      osc.connect(gain).connect(ctx.destination);
      osc.start(start);
      osc.stop(start + 0.45);
    });
  } catch { /* som é opcional */ }
}

export function CompeticaoPopup() {
  const { user } = useAuth();
  const fetchFechamento = useServerFn(getFechamentoPendente);
  const [data, setData] = useState<Fechamento>(null);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    const check = async () => {
      try {
        const res = await fetchFechamento();
        if (cancelled || !res) return;
        const key = `competicao-vista:${user.id}:${res.week_start}`;
        if (window.localStorage.getItem(key)) return;
        setData(res);
        setOpen(true);
        tocarSom();
      } catch { /* silencioso */ }
    };
    check();
    // Re-checa a cada 5 minutos para pegar o fechamento da sexta 16:00.
    const t = setInterval(check, 5 * 60_000);
    return () => { cancelled = true; clearInterval(t); };
  }, [user]);

  const fechar = () => {
    if (user && data) {
      try { window.localStorage.setItem(`competicao-vista:${user.id}:${data.week_start}`, "1"); } catch { /* ignore */ }
    }
    setOpen(false);
  };

  if (!data) return null;
  const vencedora = data.podio[0];

  return (
    <Dialog open={open} onOpenChange={(v) => (v ? setOpen(true) : fechar())}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <PartyPopper className="h-5 w-5 text-amber-500" />
            {data.sou_vencedor ? "Você ganhou a semana!" : "Competição encerrada!"}
          </DialogTitle>
          <DialogDescription>
            Semana de {new Date(`${data.week_start}T12:00:00`).toLocaleDateString("pt-BR")} — resultado oficial.
          </DialogDescription>
        </DialogHeader>

        <div className="rounded-xl border border-amber-500/40 bg-amber-500/10 p-4 text-center">
          <Trophy className="mx-auto h-8 w-8 text-amber-500" />
          <div className="mt-2 text-lg font-bold">{vencedora?.nome ?? "Sem vencedora"}</div>
          <div className="text-sm text-muted-foreground">{vencedora?.total ?? 0} pontos</div>
        </div>

        <div className="space-y-1 text-sm">
          {data.podio.map((r, i) => (
            <div key={r.user_id} className="flex items-center justify-between rounded-lg bg-muted/50 px-3 py-1.5">
              <span>{i + 1}º {r.nome}</span>
              <span className="font-semibold">{r.total} pts</span>
            </div>
          ))}
        </div>

        <div className="rounded-xl border p-3">
          <div className="flex items-center gap-2 text-sm font-semibold">
            <Gift className="h-4 w-4 text-amber-600" /> Prêmio revelado
          </div>
          <div className="mt-1 font-bold">{data.premio_titulo ?? "🎁 Prêmio Misterioso"}</div>
          {data.premio_descricao && (
            <p className="text-xs text-muted-foreground">{data.premio_descricao}</p>
          )}
        </div>

        <Button onClick={fechar} className="w-full">Ver o novo placar</Button>
      </DialogContent>
    </Dialog>
  );
}
