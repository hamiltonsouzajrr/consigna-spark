import { useState, useEffect, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Award } from "lucide-react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { getReconhecimentos, type Reconhecimento } from "@/lib/rh/reconhecimentos.functions";

const tipoCor: Record<string, string> = {
  "Trabalho em equipe": "bg-sky-100 text-sky-700 dark:bg-sky-500/15 dark:text-sky-400",
  Liderança: "bg-violet-100 text-violet-700 dark:bg-violet-500/15 dark:text-violet-400",
  Inovação: "bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-400",
  "Destaque do mês": "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-400",
};

function isActive(r: Reconhecimento, today: string) {
  if (!r.popup) return false;
  if (!r.periodo_inicio && !r.periodo_fim) return false;
  if (r.periodo_inicio && today < r.periodo_inicio) return false;
  if (r.periodo_fim && today > r.periodo_fim) return false;
  return true;
}

export function ReconhecimentosPopup() {
  const fetchRecs = useServerFn(getReconhecimentos);
  const { data } = useQuery({
    queryKey: ["rh", "reconhecimentos"],
    queryFn: () => fetchRecs(),
  });

  const today = new Date().toISOString().slice(0, 10);
  const active = useMemo(
    () => (data?.items ?? []).filter((r) => isActive(r, today)),
    [data, today],
  );

  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (active.length === 0) return;
    const key = `rh-recs-seen-${active.map((r) => r.id).join("_")}`;
    if (sessionStorage.getItem(key)) return;
    setOpen(true);
    sessionStorage.setItem(key, "1");
  }, [active]);

  if (active.length === 0) return null;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <span className="flex h-8 w-8 items-center justify-center rounded-full bg-amber-500/15 text-amber-500">
              <Award className="h-4 w-4" />
            </span>
            Reconhecimentos em destaque
          </DialogTitle>
          <DialogDescription>Parabéns aos colaboradores reconhecidos neste período!</DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          {active.map((r) => (
            <div key={r.id} className="flex items-start gap-3 rounded-lg border p-3">
              <Avatar className="h-10 w-10">
                <AvatarFallback>{r.para.slice(0, 2)}</AvatarFallback>
              </Avatar>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="text-sm font-semibold">{r.de}</p>
                  <span className="text-xs text-muted-foreground">→</span>
                  <p className="text-sm font-semibold">{r.para}</p>
                </div>
                <Badge variant="secondary" className={`mt-1 border-0 ${tipoCor[r.tipo] ?? "bg-muted text-muted-foreground"}`}>
                  {r.tipo}
                </Badge>
                <p className="mt-2 text-sm text-muted-foreground">{r.mensagem}</p>
              </div>
            </div>
          ))}
        </div>
        <Button className="mt-2 w-full" onClick={() => setOpen(false)}>Fechar</Button>
      </DialogContent>
    </Dialog>
  );
}
