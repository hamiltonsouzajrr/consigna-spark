import { useEffect, useRef, useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Bell, Clock } from "lucide-react";

const GOLDEN_HOURS = [10, 14, 16]; // início (h) — lembrete 10min antes
const LEAD_MINUTES = 10;
const FIRED_KEY = "horarios_ouro_reminder_fired"; // { "YYYY-MM-DD-HH": true }

type FiredMap = Record<string, boolean>;

function loadFired(): FiredMap {
  try { return JSON.parse(localStorage.getItem(FIRED_KEY) || "{}"); } catch { return {}; }
}
function saveFired(m: FiredMap) {
  try { localStorage.setItem(FIRED_KEY, JSON.stringify(m)); } catch {}
}
function todayKey(hour: number) {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}-${hour}`;
}

export function HorariosOuroReminder() {
  const [open, setOpen] = useState(false);
  const [targetHour, setTargetHour] = useState<number | null>(null);
  const firedRef = useRef<FiredMap>(loadFired());

  useEffect(() => {
    const check = () => {
      const now = new Date();
      for (const h of GOLDEN_HOURS) {
        const target = new Date(now);
        target.setHours(h, 0, 0, 0);
        const diffMs = target.getTime() - now.getTime();
        const diffMin = diffMs / 60000;
        // dispara quando faltam <= 10min e ainda não chegou no horário
        if (diffMin > 0 && diffMin <= LEAD_MINUTES) {
          const key = todayKey(h);
          if (!firedRef.current[key]) {
            firedRef.current[key] = true;
            saveFired(firedRef.current);
            setTargetHour(h);
            setOpen(true);
          }
          break;
        }
      }
    };
    check();
    const id = setInterval(check, 30_000);
    return () => clearInterval(id);
  }, []);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-lg">
            <Bell className="h-5 w-5 text-warning" />
            Horário de Ouro em {LEAD_MINUTES} minutos
          </DialogTitle>
          <DialogDescription className="sr-only">
            Lembrete para preparar as ligações antes do próximo horário de maior conversão.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3 text-sm">
          <div className="flex items-center gap-2 rounded-lg border border-warning/30 bg-warning/10 p-3 font-medium">
            <Clock className="h-4 w-4 text-warning" />
            Prepare-se para o horário das <strong>{targetHour}h às {(targetHour ?? 0) + 1}h</strong>
          </div>
          <p className="text-muted-foreground">
            Esse é um dos horários com maior índice de atendimento e conversão.
            Mantenha o foco e a presença para aproveitar as oportunidades.
          </p>
          <p className="text-center font-semibold text-primary">ÓTIMAS VENDAS! 🚀</p>
        </div>
        <DialogFooter>
          <Button onClick={() => setOpen(false)} className="w-full sm:w-auto">Entendi</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
