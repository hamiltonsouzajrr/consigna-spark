// Card admin de Tomadores AL: devolve ao estoque os leads já trabalhados e
// redistribui, sem repetir o lead para quem já o atendeu.
import { useCallback, useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import { ConfirmDialog } from "@/components/prospeccao/admin/ConfirmDialog";
import { RotateCcw, Loader2 } from "lucide-react";
import { toast } from "sonner";
import {
  previewReiniciarTrabalhados, reiniciarTrabalhadosTomadoresAl,
  type StatusReinicio, type PreviaReinicio,
} from "@/lib/prospeccao/tomadores-al.functions";

const STATUS_LABEL: Record<StatusReinicio, string> = {
  convertido: "Convertidos",
  sem_interesse: "Sem interesse",
  contatado: "Contatados sem evolução",
  proposta_enviada: "Proposta enviada sem desfecho",
};

const TODOS: StatusReinicio[] = ["convertido", "sem_interesse", "contatado", "proposta_enviada"];

export function ReiniciarTrabalhadosCard({ onDone }: { onDone?: () => void }) {
  const previa = useServerFn(previewReiniciarTrabalhados);
  const reiniciar = useServerFn(reiniciarTrabalhadosTomadoresAl);

  const [status, setStatus] = useState<StatusReinicio[]>(["convertido", "sem_interesse"]);
  const [diasMin, setDiasMin] = useState("7");
  const [dados, setDados] = useState<PreviaReinicio | null>(null);
  const [carregando, setCarregando] = useState(false);
  const [rodando, setRodando] = useState(false);

  const carregar = useCallback(async () => {
    if (!status.length) { setDados({ elegiveis: 0, porStatus: {} }); return; }
    setCarregando(true);
    try {
      const res = await previa({ data: { status, diasMin: Number(diasMin), limite: 5000 } });
      setDados(res);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Não foi possível calcular a prévia.");
    } finally {
      setCarregando(false);
    }
  }, [previa, status, diasMin]);

  useEffect(() => { void carregar(); }, [carregar]);

  const alternar = (st: StatusReinicio) =>
    setStatus((prev) => (prev.includes(st) ? prev.filter((x) => x !== st) : [...prev, st]));

  const executar = async () => {
    setRodando(true);
    try {
      const res = await reiniciar({ data: { status, diasMin: Number(diasMin), limite: 5000 } });
      toast.success(
        `${res.reiniciados} lead(s) reiniciado(s) e ${res.distribuidos} entregue(s) para ${res.consultoras} consultora(s).`,
        { description: "Nenhum lead volta para quem já o atendeu." },
      );
      await carregar();
      onDone?.();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Falha ao reiniciar os leads.");
    } finally {
      setRodando(false);
    }
  };

  return (
    <section className="space-y-3 rounded-xl border border-border/60 bg-card p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="flex items-center gap-2 text-sm font-semibold">
          <RotateCcw className="h-4 w-4" /> Reiniciar leads já trabalhados
        </h2>
        <Badge className="bg-sky-500/15 text-sky-700 dark:text-sky-300">
          {carregando ? "calculando…" : `${(dados?.elegiveis ?? 0).toLocaleString("pt-BR")} elegível(is)`}
        </Badge>
      </div>

      <p className="text-xs text-muted-foreground">
        Devolve ao estoque os tomadores já trabalhados e redistribui entre as consultoras ativas.
        O histórico de atendimento é registrado, então nenhum lead volta para quem já o atendeu.
      </p>

      <div className="flex flex-wrap gap-2">
        {TODOS.map((st) => {
          const on = status.includes(st);
          return (
            <button
              key={st}
              type="button"
              aria-pressed={on}
              onClick={() => alternar(st)}
              className={
                on
                  ? "rounded-full border border-primary bg-primary/10 px-3 py-1 text-xs font-medium text-primary"
                  : "rounded-full border border-border px-3 py-1 text-xs text-muted-foreground"
              }
            >
              {STATUS_LABEL[st]}
              {dados?.porStatus?.[st] !== undefined ? ` · ${dados.porStatus[st]}` : ""}
            </button>
          );
        })}
      </div>

      <div className="grid gap-2 sm:grid-cols-[220px_auto] sm:items-end">
        <div>
          <Label className="text-xs">Trabalhados há pelo menos</Label>
          <Select value={diasMin} onValueChange={setDiasMin}>
            <SelectTrigger className="h-10"><SelectValue /></SelectTrigger>
            <SelectContent>
              {["0", "7", "15", "30", "60", "90"].map((d) => (
                <SelectItem key={d} value={d}>{d === "0" ? "Qualquer data" : `${d} dias`}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <ConfirmDialog
          title="Reiniciar e redistribuir leads trabalhados?"
          description={
            <>
              {(dados?.elegiveis ?? 0).toLocaleString("pt-BR")} tomador(es) voltarão para o estoque
              como “novo” e serão entregues novamente às consultoras ativas. O histórico de quem já
              atendeu é preservado e essas consultoras não recebem o mesmo lead de novo.
            </>
          }
          confirmLabel="Reiniciar e distribuir"
          destructive
          requireText="REINICIAR"
          onConfirm={executar}
        >
          <Button
            size="sm"
            className="h-10 w-full sm:w-auto"
            disabled={rodando || carregando || !status.length || (dados?.elegiveis ?? 0) === 0}
          >
            {rodando ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <RotateCcw className="mr-2 h-4 w-4" />}
            {rodando ? "Reiniciando…" : "Reiniciar e distribuir"}
          </Button>
        </ConfirmDialog>
      </div>
    </section>
  );
}
