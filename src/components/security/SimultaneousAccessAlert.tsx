import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { ShieldAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { listIncidents, releaseAccount } from "@/lib/security/session.functions";

/** Pop-up urgente para administradores quando há acesso simultâneo. */
export function SimultaneousAccessAlert() {
  const fetchIncidents = useServerFn(listIncidents);
  const release = useServerFn(releaseAccount);
  const qc = useQueryClient();
  const [ignorados, setIgnorados] = useState<string[]>([]);

  const { data } = useQuery({
    queryKey: ["security-incidents", "pendentes"],
    queryFn: () => fetchIncidents({ data: { pendentes: true, dias: 7 } }),
    refetchInterval: 30_000,
  });

  const liberar = useMutation({
    mutationFn: (userId: string) => release({ data: { userId } }),
    onSuccess: () => {
      toast.success("Conta liberada", { description: "A pessoa já pode entrar novamente." });
      void qc.invalidateQueries({ queryKey: ["security-incidents"] });
    },
    onError: (e: any) => toast.error("Não foi possível liberar", { description: e?.message }),
  });

  const atual = (data ?? []).find((i) => !ignorados.includes(i.id));

  useEffect(() => {
    if (atual) {
      // Sinal sonoro/visual extra além do modal.
      toast.error("🚨 Acesso simultâneo detectado", {
        description: atual.user_email ?? "conta sem e-mail",
        duration: 20000,
      });
    }
  }, [atual?.id]);

  if (!atual) return null;
  const sessoes = atual.detalhes?.sessoes ?? [];

  return (
    <Dialog open onOpenChange={() => setIgnorados((v) => [...v, atual.id])}>
      <DialogContent className="max-w-lg border-2 border-destructive">
        <DialogHeader>
          <div className="mb-2 flex justify-center">
            <ShieldAlert className="h-10 w-10 text-destructive" />
          </div>
          <DialogTitle className="text-center text-destructive">
            Acesso simultâneo detectado
          </DialogTitle>
          <DialogDescription className="text-center">
            A conta <strong>{atual.user_email ?? "sem e-mail"}</strong> foi usada em dois
            dispositivos ao mesmo tempo. As duas sessões estão bloqueadas.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-2 rounded-lg bg-muted/60 p-3 text-xs">
          <p className="font-medium">
            {new Date(atual.created_at).toLocaleString("pt-BR", { timeZone: "America/Maceio" })}
          </p>
          {sessoes.map((s, i) => (
            <p key={i} className="truncate text-muted-foreground">
              • IP {s.ip ?? "—"} · {s.navegador ?? "navegador desconhecido"}
            </p>
          ))}
        </div>

        <div className="grid gap-2 sm:grid-cols-2">
          <Button
            variant="outline"
            onClick={() => setIgnorados((v) => [...v, atual.id])}
          >
            Manter bloqueada
          </Button>
          <Button
            disabled={liberar.isPending}
            onClick={() => liberar.mutate(atual.user_id)}
          >
            {liberar.isPending ? "Liberando…" : "Liberar conta"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
