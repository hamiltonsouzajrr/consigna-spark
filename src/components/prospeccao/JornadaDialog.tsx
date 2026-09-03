// Pergunta o horário de trabalho e o horário de almoço da consultora.
// Abre automaticamente no primeiro acesso (jornada não configurada) e também
// pode ser aberto pelo indicador de ritmo no topo.
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { salvarJornada } from "@/lib/prospeccao/jornada.functions";
import { planoPorHora, type Jornada } from "@/lib/prospeccao/jornada";

export function JornadaDialog({
  open,
  onOpenChange,
  jornada,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  jornada: Jornada;
}) {
  const [inicio, setInicio] = useState(jornada.inicio);
  const [fim, setFim] = useState(jornada.fim);
  const [almoco, setAlmoco] = useState(jornada.almoco_inicio);
  const [minutos, setMinutos] = useState(jornada.almoco_minutos);

  useEffect(() => {
    if (!open) return;
    setInicio(jornada.inicio);
    setFim(jornada.fim);
    setAlmoco(jornada.almoco_inicio);
    setMinutos(jornada.almoco_minutos);
  }, [open, jornada]);

  const salvar = useServerFn(salvarJornada);
  const qc = useQueryClient();
  const mut = useMutation({
    mutationFn: () =>
      salvar({
        data: {
          inicio,
          fim,
          almoco_inicio: almoco,
          almoco_minutos: Number(minutos) || 0,
          meta_diaria: jornada.meta_diaria,
        },
      }),
    onSuccess: () => {
      toast.success("Jornada salva — sua meta foi redistribuída pelo dia.");
      qc.invalidateQueries({ queryKey: ["prospeccao", "jornada"] });
      onOpenChange(false);
    },
    onError: (e: any) => toast.error(e?.message ?? "Não foi possível salvar."),
  });

  const preview: Jornada = {
    inicio,
    fim,
    almoco_inicio: almoco,
    almoco_minutos: Number(minutos) || 0,
    meta_diaria: jornada.meta_diaria,
  };
  const blocos = planoPorHora(preview).filter((b) => b.alvo > 0);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Sua jornada e o horário do almoço</DialogTitle>
          <DialogDescription>
            A meta de <strong>{jornada.meta_diaria} prospecções por dia</strong> é dividida pelo
            tempo que você realmente está em operação — o almoço é descontado.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-1">
            <Label htmlFor="j-inicio">Início do expediente</Label>
            <Input id="j-inicio" type="time" value={inicio} onChange={(e) => setInicio(e.target.value)} />
          </div>
          <div className="space-y-1">
            <Label htmlFor="j-fim">Fim do expediente</Label>
            <Input id="j-fim" type="time" value={fim} onChange={(e) => setFim(e.target.value)} />
          </div>
          <div className="space-y-1">
            <Label htmlFor="j-almoco">Vou almoçar às</Label>
            <Input id="j-almoco" type="time" value={almoco} onChange={(e) => setAlmoco(e.target.value)} />
          </div>
          <div className="space-y-1">
            <Label htmlFor="j-min">Tempo de almoço (min)</Label>
            <Input
              id="j-min"
              type="number"
              min={0}
              max={240}
              value={minutos}
              onChange={(e) => setMinutos(Number(e.target.value))}
            />
          </div>
        </div>

        <div className="rounded-lg border bg-muted/30 p-3 text-xs">
          <p className="font-medium">Seu plano de hoje por faixa de horário</p>
          <div className="mt-2 grid grid-cols-2 gap-1 sm:grid-cols-3">
            {blocos.map((b) => (
              <span key={b.faixa} className="rounded border bg-background px-2 py-1 tabular-nums">
                {b.faixa} · <strong>{b.alvo}</strong>
              </span>
            ))}
          </div>
        </div>

        <DialogFooter>
          <Button onClick={() => mut.mutate()} disabled={mut.isPending}>
            {mut.isPending ? "Salvando…" : "Salvar minha jornada"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
