// Liberação administrativa dos promovidos encontrados pelo Radar.
// Nada aparece para as consultoras antes de o administrador liberar o lote.

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "sonner";
import { Loader2, Send, Undo2 } from "lucide-react";
import {
  getPromovidosPendentesLiberacao,
  liberarPromovidos,
  recolherPromovidos,
} from "@/lib/radar/promovidos-recentes.functions";

export function LiberacaoPromovidosCard() {
  const fetchPendentes = useServerFn(getPromovidosPendentesLiberacao);
  const liberar = useServerFn(liberarPromovidos);
  const recolher = useServerFn(recolherPromovidos);
  const qc = useQueryClient();
  const [sel, setSel] = useState<string[]>([]);

  const { data, isLoading } = useQuery({
    queryKey: ["promovidos-pendentes-liberacao"],
    queryFn: () => fetchPendentes(),
    refetchInterval: 120_000,
  });

  const invalidar = () => {
    void qc.invalidateQueries({ queryKey: ["promovidos-pendentes-liberacao"] });
    void qc.invalidateQueries({ queryKey: ["radar-saude"] });
  };

  const mutLiberar = useMutation({
    mutationFn: (vars: { datas?: string[]; todos?: boolean }) =>
      liberar({ data: { ...vars, distribuir: true } }),
    onSuccess: (r: any) => {
      toast.success(`${r.liberados} lead(s) liberados para as consultoras (${r.distribuidos} distribuídos).`);
      setSel([]);
      invalidar();
    },
    onError: (e: any) => toast.error(e?.message ?? "Falha ao liberar."),
  });

  const mutRecolher = useMutation({
    mutationFn: (datas: string[]) => recolher({ data: { datas } }),
    onSuccess: (r: any) => {
      toast.success(`${r.recolhidos} lead(s) recolhidos.`);
      setSel([]);
      invalidar();
    },
    onError: (e: any) => toast.error(e?.message ?? "Falha ao recolher."),
  });

  const lotes = data?.lotes ?? [];
  const ocupado = mutLiberar.isPending || mutRecolher.isPending;

  return (
    <Card className="p-4">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div>
          <h3 className="text-sm font-semibold">Liberação de promovidos</h3>
          <p className="text-xs text-muted-foreground">
            As consultoras só enxergam os leads depois que você libera o lote.
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            size="sm"
            variant="outline"
            disabled={ocupado || sel.length === 0}
            onClick={() => mutRecolher.mutate(sel)}
          >
            <Undo2 className="mr-2 h-4 w-4" /> Recolher selecionados
          </Button>
          <Button
            size="sm"
            disabled={ocupado || (sel.length === 0 && lotes.length === 0)}
            onClick={() =>
              sel.length > 0 ? mutLiberar.mutate({ datas: sel }) : mutLiberar.mutate({ todos: true })
            }
          >
            {ocupado ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Send className="mr-2 h-4 w-4" />}
            {sel.length > 0 ? `Liberar ${sel.length} lote(s)` : "Liberar tudo"}
          </Button>
        </div>
      </div>

      {isLoading ? (
        <p className="py-8 text-center text-sm text-muted-foreground">Carregando lotes…</p>
      ) : lotes.length === 0 ? (
        <p className="py-8 text-center text-sm text-muted-foreground">
          Nenhum lote aguardando liberação. Tudo já foi entregue às consultoras.
        </p>
      ) : (
        <div className="space-y-2">
          {lotes.map((l) => {
            const key = l.data_publicacao ?? "sem-data";
            const marcado = sel.includes(key);
            return (
              <label
                key={key}
                className="flex cursor-pointer items-center gap-3 rounded-lg border p-3 text-sm hover:bg-muted/40"
              >
                <Checkbox
                  checked={marcado}
                  onCheckedChange={(v) =>
                    setSel((s) => (v ? [...s, key] : s.filter((x) => x !== key)))
                  }
                  disabled={!l.data_publicacao}
                />
                <span className="w-28 font-medium tabular-nums">
                  {l.data_publicacao
                    ? new Date(`${l.data_publicacao}T12:00:00Z`).toLocaleDateString("pt-BR")
                    : "Sem data"}
                </span>
                <span className="tabular-nums">{l.total} lead(s)</span>
                <span className="text-muted-foreground">· {l.comCpf} com CPF</span>
                {l.semConsultora > 0 && (
                  <span className="text-amber-600 dark:text-amber-400">
                    · {l.semConsultora} sem consultora
                  </span>
                )}
              </label>
            );
          })}
        </div>
      )}
    </Card>
  );
}
