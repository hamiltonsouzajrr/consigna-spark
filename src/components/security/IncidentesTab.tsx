import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { ShieldAlert, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { listIncidents, releaseAccount } from "@/lib/security/session.functions";

/** Histórico de incidentes de acesso simultâneo, com liberação de conta. */
export function IncidentesTab() {
  const fetchIncidents = useServerFn(listIncidents);
  const release = useServerFn(releaseAccount);
  const qc = useQueryClient();
  const [busca, setBusca] = useState("");
  const [somentePendentes, setSomentePendentes] = useState(false);
  const [dias, setDias] = useState(30);

  const { data, isLoading } = useQuery({
    queryKey: ["security-incidents", somentePendentes, dias],
    queryFn: () => fetchIncidents({ data: { pendentes: somentePendentes, dias } }),
  });

  const liberar = useMutation({
    mutationFn: (userId: string) => release({ data: { userId } }),
    onSuccess: () => {
      toast.success("Conta liberada");
      void qc.invalidateQueries({ queryKey: ["security-incidents"] });
    },
    onError: (e: any) => toast.error("Não foi possível liberar", { description: e?.message }),
  });

  const lista = (data ?? []).filter((i) =>
    busca ? (i.user_email ?? "").toLowerCase().includes(busca.toLowerCase()) : true,
  );

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <Input
          value={busca}
          onChange={(e) => setBusca(e.target.value)}
          placeholder="Filtrar por e-mail…"
          className="h-10 max-w-xs"
        />
        <Button
          variant={somentePendentes ? "default" : "outline"}
          onClick={() => setSomentePendentes((v) => !v)}
        >
          Somente bloqueadas
        </Button>
        {[7, 30, 90].map((d) => (
          <Button key={d} variant={dias === d ? "default" : "outline"} onClick={() => setDias(d)}>
            {d}d
          </Button>
        ))}
      </div>

      {isLoading && <p className="text-sm text-muted-foreground">Carregando…</p>}
      {!isLoading && lista.length === 0 && (
        <Card className="flex items-center gap-3 p-6 text-sm text-muted-foreground">
          <ShieldCheck className="h-5 w-5 text-emerald-600" />
          Nenhum acesso simultâneo registrado no período.
        </Card>
      )}

      <div className="space-y-2">
        {lista.map((i) => (
          <Card key={i.id} className="flex flex-wrap items-start justify-between gap-3 p-4">
            <div className="min-w-0 space-y-1">
              <div className="flex items-center gap-2">
                <ShieldAlert className="h-4 w-4 text-destructive" />
                <span className="truncate font-medium">{i.user_email ?? "conta sem e-mail"}</span>
                {i.resolvido_em ? (
                  <Badge variant="secondary">Liberada</Badge>
                ) : (
                  <Badge className="bg-destructive text-destructive-foreground">Bloqueada</Badge>
                )}
              </div>
              <p className="text-xs text-muted-foreground">
                {new Date(i.created_at).toLocaleString("pt-BR", { timeZone: "America/Maceio" })}
              </p>
              {(i.detalhes?.sessoes ?? []).map((s, idx) => (
                <p key={idx} className="truncate text-xs text-muted-foreground">
                  • IP {s.ip ?? "—"} · {s.navegador ?? "navegador desconhecido"}
                </p>
              ))}
            </div>
            {!i.resolvido_em && (
              <Button
                size="sm"
                disabled={liberar.isPending}
                onClick={() => liberar.mutate(i.user_id)}
              >
                Liberar conta
              </Button>
            )}
          </Card>
        ))}
      </div>
    </div>
  );
}
