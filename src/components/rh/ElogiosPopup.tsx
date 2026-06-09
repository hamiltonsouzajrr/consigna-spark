import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { PartyPopper } from "lucide-react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from "@/components/ui/dialog";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { getMeusElogios } from "@/lib/rh/ocorrencias.functions";

export function ElogiosPopup() {
  const fetchElogios = useServerFn(getMeusElogios);
  const { data } = useQuery({
    queryKey: ["rh", "meus-elogios"],
    queryFn: () => fetchElogios(),
  });

  const elogios = data ?? [];
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (elogios.length === 0) return;
    const key = `rh-elogios-seen-${elogios.map((e) => e.id).join("_")}`;
    if (sessionStorage.getItem(key)) return;
    setOpen(true);
    sessionStorage.setItem(key, "1");
  }, [elogios]);

  if (elogios.length === 0) return null;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <span className="flex h-8 w-8 items-center justify-center rounded-full bg-emerald-500/15 text-emerald-500">
              <PartyPopper className="h-4 w-4" />
            </span>
            Você recebeu um elogio!
          </DialogTitle>
          <DialogDescription>Parabéns pelo seu trabalho. Continue assim!</DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          {elogios.map((e) => (
            <div key={e.id} className="flex items-start gap-3 rounded-lg border p-3">
              <Avatar className="h-10 w-10">
                <AvatarFallback>{e.colaborador.slice(0, 2)}</AvatarFallback>
              </Avatar>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold">{e.colaborador}</p>
                <p className="mt-1 text-sm text-muted-foreground">{e.descricao}</p>
              </div>
            </div>
          ))}
        </div>
        <Button className="mt-2 w-full" onClick={() => setOpen(false)}>Fechar</Button>
      </DialogContent>
    </Dialog>
  );
}
