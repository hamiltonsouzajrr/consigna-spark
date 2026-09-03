// Cartão administrativo: consultoras cadastradas que não possuem conta de acesso.
// Leads presos com esses nomes ficam invisíveis (a permissão casa pelo e-mail do
// usuário logado), então aqui o admin vê o problema e devolve tudo ao rateio.

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { AlertTriangle, CheckCircle2, Loader2, UserX } from "lucide-react";
import { ConfirmDialog } from "@/components/prospeccao/admin/ConfirmDialog";
import { useState } from "react";
import {
  devolverLeadsSemConta,
  getConsultorasSemConta,
} from "@/lib/radar/promovidos-recentes.functions";

export function ConsultorasSemContaCard() {
  const fetchItens = useServerFn(getConsultorasSemConta);
  const devolver = useServerFn(devolverLeadsSemConta);
  const qc = useQueryClient();
  const [confirmOpen, setConfirmOpen] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ["radar-consultoras-sem-conta"],
    queryFn: () => fetchItens({ data: undefined as never }),
    refetchInterval: 120_000,
  });

  const mut = useMutation({
    mutationFn: () => devolver({ data: undefined as never }),
    onSuccess: (r) => {
      toast.success(
        `${r.liberados} lead(s) liberado(s) e ${r.atribuidos} redistribuído(s) entre ${r.consultoras} consultora(s).`,
      );
      void qc.invalidateQueries({ queryKey: ["radar-consultoras-sem-conta"] });
      void qc.invalidateQueries({ queryKey: ["radar-carteiras"] });
      void qc.invalidateQueries({ queryKey: ["radar-saude"] });
    },
    onError: (e: any) => toast.error(e?.message ?? "Não foi possível devolver os leads."),
  });

  if (isLoading || !data) {
    return (
      <Card className="flex items-center gap-2 p-4 text-sm text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" /> Verificando consultoras sem conta…
      </Card>
    );
  }

  const invisiveis = data.leadsInvisiveis;

  return (
    <Card className="space-y-3 p-4">
      <div className="flex flex-wrap items-center gap-2">
        <UserX className="h-4 w-4 text-muted-foreground" />
        <h3 className="text-sm font-semibold">Consultoras cadastradas sem conta de acesso</h3>
        <Badge variant={data.itens.length ? "secondary" : "outline"}>{data.itens.length}</Badge>
        {invisiveis > 0 ? (
          <span className="flex items-center gap-1 text-xs font-medium text-amber-600 dark:text-amber-400">
            <AlertTriangle className="h-3.5 w-3.5" />
            {invisiveis} lead(s) invisível(is) presos com esses nomes
          </span>
        ) : (
          <span className="flex items-center gap-1 text-xs text-emerald-600 dark:text-emerald-400">
            <CheckCircle2 className="h-3.5 w-3.5" /> Nenhum lead invisível
          </span>
        )}
      </div>

      {data.itens.length === 0 ? (
        <p className="text-xs text-muted-foreground">
          Todas as consultoras do cadastro possuem conta de acesso no sistema.
        </p>
      ) : (
        <div className="max-h-64 overflow-auto rounded-md border">
          <table className="w-full text-xs">
            <thead className="bg-muted/50 text-left">
              <tr>
                <th className="px-2 py-1.5 font-medium">Consultora</th>
                <th className="px-2 py-1.5 font-medium">E-mail cadastrado</th>
                <th className="px-2 py-1.5 text-right font-medium">Leads presos</th>
              </tr>
            </thead>
            <tbody>
              {data.itens.map((i) => (
                <tr key={i.nome} className="border-t">
                  <td className="px-2 py-1.5">{i.nome}</td>
                  <td className="px-2 py-1.5 text-muted-foreground">{i.email ?? "— sem e-mail —"}</td>
                  <td className="px-2 py-1.5 text-right tabular-nums">
                    {i.leads > 0 ? (
                      <span className="font-semibold text-amber-600 dark:text-amber-400">{i.leads}</span>
                    ) : (
                      0
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div className="flex flex-wrap items-center gap-2">
        <Button
          size="sm"
          disabled={invisiveis === 0 || mut.isPending}
          onClick={() => setConfirmOpen(true)}
        >
          {mut.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
          Devolver leads ao rateio igualitário
        </Button>
        <span className="text-xs text-muted-foreground">
          Os leads voltam ao estoque e são redistribuídos apenas entre consultoras com conta ativa.
        </span>
      </div>

      <ConfirmDialog
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        title="Devolver leads sem dono válido?"
        description={`${invisiveis} lead(s) atribuído(s) a nomes sem conta serão liberados e redistribuídos igualmente entre as consultoras ativas.`}
        confirmLabel="Devolver e redistribuir"
        onConfirm={() => mut.mutate()}
      />
    </Card>
  );
}

export default ConsultorasSemContaCard;
