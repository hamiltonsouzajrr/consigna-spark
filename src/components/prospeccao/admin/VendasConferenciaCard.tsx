import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { BadgeCheck, Check, X, Clock } from "lucide-react";
import { adminVendas, adminConfirmarVenda, adminRecusarVenda } from "@/lib/prospeccao/competicao.functions";

const ORIGEM_LABEL: Record<string, string> = { crm: "CRM", tomadores_al: "Tomadores AL" };

export function VendasConferenciaCard() {
  const qc = useQueryClient();
  const listar = useServerFn(adminVendas);
  const confirmar = useServerFn(adminConfirmarVenda);
  const recusar = useServerFn(adminRecusarVenda);

  const [busy, setBusy] = useState<string | null>(null);
  const [recusandoId, setRecusandoId] = useState<string | null>(null);
  const [motivo, setMotivo] = useState("");

  const { data: pendentes } = useQuery({
    queryKey: ["vendas-pendentes"],
    queryFn: () => listar({ data: { status: "pendente" } }),
    refetchInterval: 60_000,
  });
  const { data: historico } = useQuery({
    queryKey: ["vendas-historico"],
    queryFn: () => listar({ data: { limit: 20 } }),
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
      toast.success(r.pontos > 0 ? `Venda confirmada. +${r.pontos} pontos creditados.` : "Venda confirmada (sem pontos: teto diário ou já pontuada).");
      invalidar();
    } catch (e) { toast.error((e as Error).message); } finally { setBusy(null); }
  };

  const handleRecusar = async (id: string) => {
    if (!motivo.trim()) { toast.error("Informe o motivo da recusa."); return; }
    setBusy(id);
    try {
      await recusar({ data: { vendaId: id, motivo: motivo.trim() } });
      toast.success("Venda recusada. Nenhum ponto foi creditado.");
      setRecusandoId(null); setMotivo("");
      invalidar();
    } catch (e) { toast.error((e as Error).message); } finally { setBusy(null); }
  };

  const lista = pendentes ?? [];
  const revisadas = (historico ?? []).filter((v) => v.status !== "pendente").slice(0, 8);

  return (
    <Card className="p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2 text-sm font-semibold">
          <BadgeCheck className="h-4 w-4 text-emerald-600" /> Vendas aguardando conferência
          {lista.length > 0 && <Badge className="text-xs">{lista.length}</Badge>}
        </div>
        <Button asChild variant="outline" size="sm">
          <Link to="/prospeccao/admin/vendas">Abrir tela completa</Link>
        </Button>
      </div>
      <p className="mt-1 text-xs text-muted-foreground">
        Toda venda fechada entra em stand-by. Os pontos só são creditados depois que você confere e confirma aqui.
      </p>

      <div className="mt-3 space-y-2">
        {lista.length === 0 && <p className="text-sm text-muted-foreground">Nenhuma venda aguardando conferência.</p>}
        {lista.map((v) => (
          <div key={v.id} className="rounded-lg border p-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="min-w-0">
                <div className="flex items-center gap-2 text-sm font-medium">
                  {v.nome}
                  <Badge variant="outline" className="text-xs">{ORIGEM_LABEL[v.origem] ?? v.origem}</Badge>
                  <Badge variant="secondary" className="text-xs"><Clock className="mr-1 h-3 w-3" />stand-by</Badge>
                </div>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  Cliente: {v.cliente_nome ?? "—"} · registrada em {new Date(v.created_at).toLocaleString("pt-BR")}
                  {v.motivo ? ` · ${v.motivo}` : ""}
                </p>
              </div>
              <div className="flex gap-2">
                <Button size="sm" onClick={() => handleConfirmar(v.id)} disabled={busy === v.id}>
                  <Check className="mr-1 h-4 w-4" /> Confirmar
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => { setRecusandoId(recusandoId === v.id ? null : v.id); setMotivo(""); }}
                  disabled={busy === v.id}
                >
                  <X className="mr-1 h-4 w-4" /> Recusar
                </Button>
              </div>
            </div>
            {recusandoId === v.id && (
              <div className="mt-2 flex flex-wrap gap-2">
                <Input
                  placeholder="Motivo da recusa (ex.: contrato não localizado)"
                  value={motivo}
                  onChange={(e) => setMotivo(e.target.value)}
                  className="flex-1 min-w-[220px]"
                />
                <Button size="sm" variant="destructive" onClick={() => handleRecusar(v.id)} disabled={busy === v.id}>
                  Confirmar recusa
                </Button>
              </div>
            )}
          </div>
        ))}
      </div>

      {revisadas.length > 0 && (
        <div className="mt-4 border-t pt-3">
          <p className="text-xs font-semibold text-muted-foreground">Últimas conferidas</p>
          <div className="mt-2 space-y-1">
            {revisadas.map((v) => (
              <div key={v.id} className="flex flex-wrap items-center justify-between gap-2 text-xs">
                <span className="truncate">
                  {v.nome} · {v.cliente_nome ?? "—"} · {ORIGEM_LABEL[v.origem] ?? v.origem}
                </span>
                <span className="flex items-center gap-2">
                  <Badge variant={v.status === "confirmada" ? "default" : "destructive"} className="text-xs">
                    {v.status === "confirmada" ? `+${v.pontos_creditados} pts` : "recusada"}
                  </Badge>
                  <span className="text-muted-foreground">
                    {v.revisado_em ? new Date(v.revisado_em).toLocaleString("pt-BR") : ""}
                    {v.motivo_recusa ? ` · ${v.motivo_recusa}` : ""}
                  </span>
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </Card>
  );
}
