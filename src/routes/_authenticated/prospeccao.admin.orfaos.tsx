import { createFileRoute, Link } from "@tanstack/react-router";
import { useCallback, useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { AppShell } from "@/components/AppShell";
import { AdminGate } from "@/components/security/AdminGate";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { toast } from "sonner";
import { ArrowLeft, Loader2, RefreshCw, Send, AlertTriangle } from "lucide-react";
import {
  getLeadsOrfaos,
  distribuirLeadsOrfaos,
  PRAZO_DIAS,
  type LeadsOrfaosResult,
} from "@/lib/radar/orfaos.functions";

export const Route = createFileRoute("/_authenticated/prospeccao/admin/orfaos")({
  head: () => ({
    meta: [
      { title: "Leads sem consultora — Painel admin" },
      { name: "description", content: "Promovidos que nunca chegaram a nenhuma consultora, com data de promoção e prazo para redistribuir." },
      { property: "og:title", content: "Leads sem consultora" },
      { property: "og:description", content: "Fila de promovidos não distribuídos e prazo limite de redistribuição." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex,nofollow" },
    ],
  }),
  component: () => (
    <AdminGate>
      <Page />
    </AdminGate>
  ),
});

function Page() {
  const fetchOrfaos = useServerFn(getLeadsOrfaos);
  const distribuir = useServerFn(distribuirLeadsOrfaos);
  const [dados, setDados] = useState<LeadsOrfaosResult | null>(null);
  const [carregando, setCarregando] = useState(true);
  const [apenasVencidos, setApenasVencidos] = useState(false);
  const [distribuindo, setDistribuindo] = useState(false);

  const carregar = useCallback(
    (silencioso = false) => {
      if (!silencioso) setCarregando(true);
      return fetchOrfaos({ data: { apenasVencidos, limite: 200 } })
        .then(setDados)
        .catch((e: unknown) => {
          if (!silencioso) toast.error(e instanceof Error ? e.message : "Falha ao carregar");
        })
        .finally(() => setCarregando(false));
    },
    [fetchOrfaos, apenasVencidos],
  );

  useEffect(() => {
    carregar();
    const id = setInterval(() => carregar(true), 60000);
    return () => clearInterval(id);
  }, [carregar]);

  const onDistribuir = async () => {
    setDistribuindo(true);
    try {
      const r = await distribuir();
      toast.success(`${r.atribuidos} leads distribuídos entre ${r.consultoras} consultoras.`);
      await carregar(true);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Falha ao distribuir");
    } finally {
      setDistribuindo(false);
    }
  };

  return (
    <AppShell>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <div>
          <h1 className="text-2xl font-bold">Leads sem consultora</h1>
          <p className="text-sm text-muted-foreground">
            Promovidos que nunca chegaram a nenhuma consultora. Prazo de redistribuição: {PRAZO_DIAS} dias após a promoção.
          </p>
        </div>
        <Button asChild variant="ghost" size="sm">
          <Link to="/prospeccao/admin"><ArrowLeft className="mr-2 h-4 w-4" /> Painel admin</Link>
        </Button>
      </div>

      <Card className="p-4">
        <div className="mb-4 grid grid-cols-1 gap-3 md:grid-cols-3">
          <div className="rounded-lg border bg-muted/30 p-3">
            <div className="text-xs text-muted-foreground">Sem consultora</div>
            <div className="text-2xl font-bold">{dados?.total ?? "—"}</div>
          </div>
          <div className="rounded-lg border bg-muted/30 p-3">
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <AlertTriangle className="h-3.5 w-3.5" /> Prazo vencido
            </div>
            <div className="text-2xl font-bold text-destructive">{dados?.vencidos ?? "—"}</div>
          </div>
          <div className="rounded-lg border bg-muted/30 p-3">
            <div className="text-xs text-muted-foreground">Dentro do prazo</div>
            <div className="text-2xl font-bold">{dados?.aVencer ?? "—"}</div>
          </div>
        </div>

        <div className="mb-3 flex flex-wrap items-center gap-3">
          <label className="flex items-center gap-2 text-sm">
            <Checkbox
              checked={apenasVencidos}
              onCheckedChange={(v) => setApenasVencidos(v === true)}
            />
            Mostrar apenas com prazo vencido
          </label>
          <Button variant="outline" size="sm" onClick={() => carregar()} disabled={carregando}>
            {carregando ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <RefreshCw className="mr-2 h-4 w-4" />}
            Atualizar
          </Button>
          <Button size="sm" onClick={onDistribuir} disabled={distribuindo || (dados?.total ?? 0) === 0}>
            {distribuindo ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Send className="mr-2 h-4 w-4" />}
            Distribuir agora
          </Button>
          {dados && (
            <span className="text-xs text-muted-foreground">
              Atualizado às {new Date(dados.atualizadoEm).toLocaleTimeString("pt-BR")} · atualiza a cada 60s
            </span>
          )}
        </div>

        {carregando && !dados ? (
          <div className="flex items-center gap-2 py-8 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" /> Carregando fila…
          </div>
        ) : !dados || dados.itens.length === 0 ? (
          <p className="py-6 text-sm text-muted-foreground">Nenhum lead órfão no momento.</p>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Servidor</TableHead>
                  <TableHead>CPF</TableHead>
                  <TableHead>Órgão / cargo</TableHead>
                  <TableHead>Movimentação</TableHead>
                  <TableHead>Promovido em</TableHead>
                  <TableHead className="text-right">Parado</TableHead>
                  <TableHead className="text-right">Prazo</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {dados.itens.map((l) => (
                  <TableRow key={l.id}>
                    <TableCell className="font-medium">{l.nome}</TableCell>
                    <TableCell className="text-muted-foreground">{l.cpfParcial ?? "—"}</TableCell>
                    <TableCell className="text-muted-foreground">
                      {l.orgao ?? "—"}
                      {l.cargo ? <div className="text-xs">{l.cargo}</div> : null}
                    </TableCell>
                    <TableCell className="text-muted-foreground">{l.tipoMovimentacao ?? "—"}</TableCell>
                    <TableCell>
                      {l.dataPromovido ? new Date(`${l.dataPromovido}T12:00:00`).toLocaleDateString("pt-BR") : "—"}
                    </TableCell>
                    <TableCell className="text-right">{l.diasParado} d</TableCell>
                    <TableCell className="text-right">
                      {l.vencido ? (
                        <Badge variant="destructive">vencido há {Math.abs(l.diasRestantes)} d</Badge>
                      ) : (
                        <Badge variant="secondary">{l.diasRestantes} d restantes</Badge>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </Card>
    </AppShell>
  );
}
