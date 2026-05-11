import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Clock, Sparkles } from "lucide-react";

const STORAGE_KEY = "horarios_ouro_dismissed_at";
const ONE_DAY_MS = 24 * 60 * 60 * 1000;

export function HorariosOuroDialog() {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    try {
      const last = localStorage.getItem(STORAGE_KEY);
      if (!last || Date.now() - Number(last) > ONE_DAY_MS) {
        setOpen(true);
      }
    } catch {
      setOpen(true);
    }
  }, []);

  const handleClose = () => {
    try { localStorage.setItem(STORAGE_KEY, String(Date.now())); } catch {}
    setOpen(false);
  };

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) handleClose(); }}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-xl">
            <Sparkles className="h-5 w-5 text-warning" />
            ATENÇÃO: HORÁRIOS DE OURO
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 text-sm leading-relaxed">
          <div className="rounded-lg border border-warning/30 bg-warning/10 p-4">
            <div className="mb-2 flex items-center gap-2 font-semibold text-warning">
              <Clock className="h-4 w-4" /> Horários de pico
            </div>
            <ul className="space-y-1 pl-1 font-medium text-foreground">
              <li>• 10h às 11h</li>
              <li>• 14h às 15h</li>
              <li>• 16h às 17h</li>
            </ul>
          </div>

          <p>
            Esses são os horários com <strong>maior índice de atendimento</strong> nas ligações
            e <strong>maior chance de conversão</strong>.
          </p>

          <p className="text-muted-foreground">
            Não é proibido ir ao banheiro ou se levantar nesse período. Porém, considerando a alta
            probabilidade de contatos atendidos, o ideal é manter o máximo de <strong className="text-foreground">foco, presença e produtividade</strong> nesses
            horários para aproveitar melhor as oportunidades.
          </p>

          <p className="text-center text-base font-bold text-primary">
            ÓTIMAS VENDAS! 🚀
          </p>
        </div>

        <DialogFooter>
          <Button onClick={handleClose} className="w-full sm:w-auto">
            Entendi, fechar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
