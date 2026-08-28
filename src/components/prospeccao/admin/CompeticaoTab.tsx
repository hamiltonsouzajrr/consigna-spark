import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { toast } from "sonner";
import { Gift, Ban, Flag, Pause, Play, Trash2 } from "lucide-react";
import {
  adminDefinirPremio,
  adminExtratoPontos,
  adminAnularPonto,
  adminFecharSemana,
  adminPausarCompeticao,
  adminRetomarCompeticao,
  adminExcluirCompeticao,
  getCompeticao,
} from "@/lib/prospeccao/competicao.functions";
import { ConfirmDialog } from "./ConfirmDialog";

export function CompeticaoTab() {
  const qc = useQueryClient();
  const definirPremio = useServerFn(adminDefinirPremio);
  const extrato = useServerFn(adminExtratoPontos);
  const anular = useServerFn(adminAnularPonto);
  const fechar = useServerFn(adminFecharSemana);
  const pausar = useServerFn(adminPausarCompeticao);
  const retomar = useServerFn(adminRetomarCompeticao);
  const excluir = useServerFn(adminExcluirCompeticao);
  const competicao = useServerFn(getCompeticao);

  const [titulo, setTitulo] = useState("");
  const [descricao, setDescricao] = useState("");
  const [busy, setBusy] = useState(false);
  const [confirmExcluir, setConfirmExcluir] = useState(false);

  const { data: semana } = useQuery({ queryKey: ["competicao"], queryFn: () => competicao() });
  const { data: pontos } = useQuery({ queryKey: ["competicao-extrato"], queryFn: () => extrato({ data: {} }) });

  const salvar = async () => {
    if (!titulo.trim()) { toast.error("Informe o prêmio da semana."); return; }
    setBusy(true);
    try {
      await definirPremio({ data: { titulo: titulo.trim(), descricao: descricao.trim() } });
      toast.success("Prêmio da semana definido (fica oculto até sexta 16h).");
      setTitulo(""); setDescricao("");
      qc.invalidateQueries({ queryKey: ["competicao"] });
    } catch (e) { toast.error((e as Error).message); } finally { setBusy(false); }
  };

  const encerrar = async () => {
    setBusy(true);
    try {
      const r = await fechar({ data: { force: true } });
      toast.success(r.vencedor_nome ? `Semana encerrada. Vencedora: ${r.vencedor_nome}.` : "Semana encerrada sem pontos.");
      qc.invalidateQueries({ queryKey: ["competicao"] });
    } catch (e) { toast.error((e as Error).message); } finally { setBusy(false); }
  };

  const handlePausar = async () => {
    setBusy(true);
    try {
      await pausar({ data: {} });
      toast.success("Competição pausada. Nenhum ponto será creditado até retomar.");
      qc.invalidateQueries({ queryKey: ["competicao"] });
    } catch (e) { toast.error((e as Error).message); } finally { setBusy(false); }
  };

  const handleRetomar = async () => {
    setBusy(true);
    try {
      await retomar({ data: {} });
      toast.success("Competição retomada. Pontos voltam a ser creditados normalmente.");
      qc.invalidateQueries({ queryKey: ["competicao"] });
    } catch (e) { toast.error((e as Error).message); } finally { setBusy(false); }
  };

  const handleExcluir = async () => {
    setBusy(true);
    try {
      const r = await excluir({ data: {} });
      toast.success(`Competição da semana excluída. ${r.pontosExcluidos} ponto(s) removido(s).`);
      qc.invalidateQueries({ queryKey: ["competicao"] });
      qc.invalidateQueries({ queryKey: ["competicao-extrato"] });
    } catch (e) { toast.error((e as Error).message); } finally { setBusy(false); setConfirmExcluir(false); }
  };

  const anularPonto = async (id: string) => {
    try {
      await anular({ data: { pontoId: id, motivo: "suspeita de volume artificial" } });
      toast.success("Ponto anulado.");
      qc.invalidateQueries({ queryKey: ["competicao-extrato"] });
      qc.invalidateQueries({ queryKey: ["competicao"] });
    } catch (e) { toast.error((e as Error).message); }
  };

  const isPausada = Boolean(semana?.pausada);

  return (
    <div className="space-y-4">
      {/* Status e controles da competição */}
      <Card className="p-4">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 text-sm font-semibold">
            <Gift className="h-4 w-4 text-amber-600" /> Competição da semana
          </div>
          {isPausada && (
            <Badge variant="destructive" className="text-xs">
              <Pause className="mr-1 h-3 w-3" /> Pausada
            </Badge>
          )}
        </div>
        <p className="mt-1 text-xs text-muted-foreground">
          Semana atual: {semana?.week_start} · encerra {semana?.closes_at ? new Date(semana.closes_at).toLocaleString("pt-BR") : "—"}
          {semana?.premio_titulo ? ` · prêmio: ${semana.premio_titulo}` : " · nenhum prêmio cadastrado"}
          {isPausada && semana?.pausada_em ? ` · pausada em ${new Date(semana.pausada_em).toLocaleString("pt-BR")}` : ""}
        </p>

        <div className="mt-3 flex flex-wrap gap-2">
          {!isPausada ? (
            <Button variant="outline" onClick={handlePausar} disabled={busy} className="border-amber-300 text-amber-700 hover:bg-amber-50">
              <Pause className="mr-2 h-4 w-4" /> Pausar competição
            </Button>
          ) : (
            <Button variant="outline" onClick={handleRetomar} disabled={busy} className="border-green-300 text-green-700 hover:bg-green-50">
              <Play className="mr-2 h-4 w-4" /> Retomar competição
            </Button>
          )}
          <Button variant="outline" onClick={encerrar} disabled={busy}>
            <Flag className="mr-2 h-4 w-4" /> Encerrar semana agora
          </Button>
          <Button variant="destructive" size="sm" onClick={() => setConfirmExcluir(true)} disabled={busy}>
            <Trash2 className="mr-2 h-4 w-4" /> Excluir competição
          </Button>
        </div>
      </Card>

      {/* Prêmio */}
      <Card className="p-4">
        <div className="flex items-center gap-2 text-sm font-semibold">
          <Gift className="h-4 w-4 text-amber-600" /> Prêmio Misterioso da semana
        </div>
        <div className="mt-3 grid gap-2 sm:grid-cols-2">
          <Input placeholder="Prêmio (ex.: Day off + R$ 200)" value={titulo} onChange={(e) => setTitulo(e.target.value)} />
          <Textarea placeholder="Detalhes (opcional)" value={descricao} onChange={(e) => setDescricao(e.target.value)} className="sm:col-span-2" />
        </div>
        <div className="mt-3">
          <Button onClick={salvar} disabled={busy}>Salvar prêmio</Button>
        </div>
      </Card>

      {/* Extrato */}
      <Card className="overflow-x-auto">
        <div className="border-b p-3 text-sm font-semibold">Extrato de pontos da semana</div>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Consultora</TableHead>
              <TableHead>Categoria</TableHead>
              <TableHead>Motivo</TableHead>
              <TableHead className="text-right">Pontos</TableHead>
              <TableHead>Quando</TableHead>
              <TableHead />
            </TableRow>
          </TableHeader>
          <TableBody>
            {(pontos ?? []).length === 0 && (
              <TableRow>
                <TableCell colSpan={6} className="py-6 text-center text-sm text-muted-foreground">
                  Nenhum ponto registrado nesta semana.
                </TableCell>
              </TableRow>
            )}
            {(pontos ?? []).map((p) => (
              <TableRow key={p.id} className={p.anulado_em ? "opacity-50" : ""}>
                <TableCell>{p.nome}</TableCell>
                <TableCell><Badge variant="outline">{p.categoria}</Badge></TableCell>
                <TableCell className="max-w-[280px] truncate text-xs">{p.motivo ?? "—"}</TableCell>
                <TableCell className="text-right">{p.pontos}</TableCell>
                <TableCell className="text-xs">{new Date(p.created_at).toLocaleString("pt-BR")}</TableCell>
                <TableCell className="text-right">
                  {!p.anulado_em && (
                    <Button size="sm" variant="ghost" onClick={() => anularPonto(p.id)}>
                      <Ban className="mr-1 h-3.5 w-3.5" /> Anular
                    </Button>
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>

      {/* Dialog de confirmação para excluir */}
      <ConfirmDialog
        open={confirmExcluir}
        onOpenChange={setConfirmExcluir}
        title="Excluir competição da semana"
        description="Isso vai apagar TODOS os pontos e o registro da semana atual. Essa ação é irreversível. Deseja continuar?"
        confirmLabel="Sim, excluir tudo"
        variant="destructive"
        onConfirm={handleExcluir}
      />
    </div>
  );
}
