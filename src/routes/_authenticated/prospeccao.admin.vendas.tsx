import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { AppShell } from "@/components/AppShell";
import { AdminGate } from "@/components/security/AdminGate";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { RhStatCard } from "@/components/rh/RhStatCard";
import { toast } from "sonner";
import { ArrowLeft, BadgeCheck, Check, X, Clock, RefreshCw, Coins } from "lucide-react";
import { adminVendas, adminConfirmarVenda, adminRecusarVenda } from "@/lib/prospeccao/competicao.functions";

export const Route = createFileRoute("/_authenticated/prospeccao/admin/vendas")({
  head: () => ({
    meta: [
      { title: "Vendas em stand-by — conferência do gestor" },
      { name: "robots", content: "noindex,nofollow" },
    ],
  }),
  component: () => (
    <AdminGate>
      <Page />
    </AdminGate>
  ),
});

const ORIGEM_LABEL: Record<string, string> = { crm: "CRM", tomadores_al: "Tomadores AL" };

const fmtMoeda = (v: number | null) =>
  v == null ? "—" : v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

const fmtData = (iso: string) =>
  new Date(iso).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", year: "2-digit", hour: "2-digit", minute: "2-digit" });

function Page() {
  const qc = useQueryClient();
  const listar = useServerFn(adminVendas);
  const confirmar = useServerFn(adminConfirmarVenda);
  const recusar = useServerFn(adminRecusarVenda);

  const [busy, setBusy] = useState<string | null>(null);
  const [recusandoId, setRecusandoId] = useState<string | null>(null);
  const [motivo, setMotivo] = useState("");

  const pendentesQ = useQuery({
    queryKey: ["vendas-pendentes"],
    queryFn: () => listar({ data: { status: "pendente" } }),
    refetchInterval: 60_000,
  });
  const historicoQ = useQuery({
    queryKey: ["vendas-historico"],
    queryFn: () => listar({ data: { limit: 50 } }),
  });

  const invalidar = () => {
    qc.invalidateQueries({ queryKey: ["vendas-pendentes"] });
    qc.invalidateQueries({ queryKey: ["vendas-historico"] });
    qc.invalidateQueries({ queryKey: ["competicao"] });
    qc.invalidateQueries({ queryKey: ["competicao-extrato"] });
    qc.invalidateQueries({ queryKey: ["competicao-alertas"] });
  };

  const handleConfirmar = async (id: string) => {
    setBusy(id);
    try {
      const r = await confirmar({ data: { vendaId: id } });
      toast.success(
        r.pontos > 0
          ? `Venda liberada. +${r.pontos} pontos creditados.`
          : "Venda liberada (sem pontos: teto diário ou já pontuada).",
      );
      invalidar();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(null);
    }
  };

  const handleRecusar = async (id: string) => {
    if (!motivo.trim()) {
      toast.error("Informe o motivo da recusa.");
      return;
    }
    setBusy(id);
    try {
      await recusar({ data: { vendaId: id, motivo: motivo.trim() } });
      toast.success("Venda rejeitada. Nenhum ponto foi creditado.");
      setRecusandoId(null);
      setMotivo("");
      invalidar();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(null);
    }
  };

  const pendentes = pendentesQ.data ?? [];
  const conferidas = (historicoQ.data ?? []).filter((v) => v.status !== "pendente");
  const totalValor = pendentes.reduce((s, v) => s + (v.valor ?? 0), 0);

  return (
    <AppShell>
      <Button asChild variant="ghost" size="sm" className="mb-4">
        <Link to="/prospeccao/admin">
          <ArrowLeft className="mr-2 h-4 w-4" /> Voltar ao painel
        </Link>
      </Button>

      <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Vendas em stand-by</h1>
          <p className="text-sm text-muted-foreground">
            Confira cada venda fechada e libere para pontuar ou rejeite com o motivo.
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={() => { pendentesQ.refetch(); historicoQ.refetch(); }} disabled={pendentesQ.isFetching}>
          <RefreshCw className={`mr-2 h-4 w-4 ${pendentesQ.isFetching ? "animate-spin" : ""}`} /> Atualizar
        </Button>
      </div>

      <div className="mb-6 grid grid-cols-2 gap-3 md:grid-cols-3">
        <RhStatCard label="Aguardando liberação" value={pendentesQ.isPending ? "—" : pendentes.length} icon={Clock} tone="amber" />
        <RhStatCard label="Valor em análise" value={pendentesQ.isPending ? "—" : fmtMoeda(totalValor)} icon={Coins} tone="sky" />
        <RhStatCard label="Já conferidas" value={historicoQ.isPending ? "—" : conferidas.length} icon={BadgeCheck} tone="violet" />
      </div>

      <Card className="mb-6 p-5">
        <p className="mb-4 flex items-center gap-2 text-sm font-semibold">
          <Clock className="h-4 w-4 text-amber-500" /> Aguardando conferência
        </p>

        {pendentesQ.isPending ? (
          <div className="space-y-2">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-10 w-full" />
            ))}
          </div>
        ) : pendentes.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nenhuma venda aguardando conferência.</p>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Fechada em</TableHead>
                  <TableHead>Consultora</TableHead>
                  <TableHead>Cliente</TableHead>
                  <TableHead>Origem</TableHead>
                  <TableHead className="text-right">Valor</TableHead>
                  <TableHead>Margem</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {pendentes.map((v) => (
                  <TableRow key={v.id}>
                    <TableCell className="whitespace-nowrap text-xs text-muted-foreground">{fmtData(v.created_at)}</TableCell>
                    <TableCell className="max-w-[180px] truncate font-medium">{v.nome}</TableCell>
                    <TableCell className="max-w-[200px] truncate">{v.cliente_nome ?? "—"}</TableCell>
                    <TableCell>
                      <Badge variant="secondary">{ORIGEM_LABEL[v.origem] ?? v.origem}</Badge>
                    </TableCell>
                    <TableCell className="text-right">{fmtMoeda(v.valor)}</TableCell>
                    <TableCell className="whitespace-nowrap text-xs">{v.tipo_margem ? `${v.tipo_margem === "cartao_credito" ? "Cartão crédito" : v.tipo_margem === "cartao_beneficio" ? "Cartão benefício" : "Empréstimo"} · usada ${fmtMoeda(v.margem_usada)} · restante ${fmtMoeda(v.margem_restante_valor)}` : "—"}</TableCell>
                    <TableCell className="text-right">
                      {recusandoId === v.id ? (
                        <div className="flex items-center justify-end gap-2">
                          <Input
                            autoFocus
                            value={motivo}
                            onChange={(e) => setMotivo(e.target.value)}
                            placeholder="Motivo da recusa"
                            className="h-8 w-44"
                          />
                          <Button size="sm" variant="destructive" disabled={busy === v.id} onClick={() => handleRecusar(v.id)}>
                            Rejeitar
                          </Button>
                          <Button size="sm" variant="ghost" onClick={() => { setRecusandoId(null); setMotivo(""); }}>
                            Cancelar
                          </Button>
                        </div>
                      ) : (
                        <div className="flex items-center justify-end gap-2">
                          <Button size="sm" disabled={busy === v.id} onClick={() => handleConfirmar(v.id)}>
                            <Check className="mr-1 h-4 w-4" /> Liberar
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            disabled={busy === v.id}
                            onClick={() => { setRecusandoId(v.id); setMotivo(""); }}
                          >
                            <X className="mr-1 h-4 w-4" /> Rejeitar
                          </Button>
                        </div>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </Card>

      <Card className="p-5">
        <p className="mb-4 flex items-center gap-2 text-sm font-semibold">
          <BadgeCheck className="h-4 w-4 text-emerald-500" /> Histórico de conferências
        </p>
        {historicoQ.isPending ? (
          <div className="space-y-2">
            {Array.from({ length: 3 }).map((_, i) => (
              <Skeleton key={i} className="h-8 w-full" />
            ))}
          </div>
        ) : conferidas.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nenhuma venda conferida ainda.</p>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Conferida em</TableHead>
                  <TableHead>Consultora</TableHead>
                  <TableHead>Cliente</TableHead>
                  <TableHead className="text-right">Valor</TableHead>
                  <TableHead>Situação</TableHead>
                  <TableHead className="text-right">Pontos</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {conferidas.map((v) => (
                  <TableRow key={v.id}>
                    <TableCell className="whitespace-nowrap text-xs text-muted-foreground">
                      {v.revisado_em ? fmtData(v.revisado_em) : fmtData(v.created_at)}
                    </TableCell>
                    <TableCell className="max-w-[180px] truncate">{v.nome}</TableCell>
                    <TableCell className="max-w-[200px] truncate">{v.cliente_nome ?? "—"}</TableCell>
                    <TableCell className="text-right">{fmtMoeda(v.valor)}</TableCell>
                    <TableCell>
                      {v.status === "confirmada" ? (
                        <Badge className="bg-emerald-500/15 text-emerald-600 hover:bg-emerald-500/20">Liberada</Badge>
                      ) : (
                        <Badge variant="destructive" title={v.motivo_recusa ?? undefined}>Rejeitada</Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-right">{v.pontos_creditados || 0}</TableCell>
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
