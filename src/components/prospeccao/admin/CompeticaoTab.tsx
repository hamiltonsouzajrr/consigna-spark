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
import { Gift, Ban, Flag } from "lucide-react";
import {
  adminDefinirPremio,
  adminExtratoPontos,
  adminAnularPonto,
  adminFecharSemana,
  getCompeticao,
} from "@/lib/prospeccao/competicao.functions";

export function CompeticaoTab() {
  const qc = useQueryClient();
  const definirPremio = useServerFn(adminDefinirPremio);
  const extrato = useServerFn(adminExtratoPontos);
  const anular = useServerFn(adminAnularPonto);
  const fechar = useServerFn(adminFecharSemana);
  const competicao = useServerFn(getCompeticao);

  const [titulo, setTitulo] = useState("");
  const [descricao, setDescricao] = useState("");
  const [busy, setBusy] = useState(false);

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

  const anularPonto = async (id: string) => {
    try {
      await anular({ data: { pontoId: id, motivo: "suspeita de volume artificial" } });
      toast.success("Ponto anulado.");
      qc.invalidateQueries({ queryKey: ["competicao-extrato"] });
      qc.invalidateQueries({ queryKey: ["competicao"] });
    } catch (e) { toast.error((e as Error).message); }
  };

  return (
    <div className="space-y-4">
      <Card className="p-4">
        <div className="flex items-center gap-2 text-sm font-semibold">
          <Gift className="h-4 w-4 text-amber-600" /> Prêmio Misterioso da semana
        </div>
        <p className="mt-1 text-xs text-muted-foreground">
          Semana atual: {semana?.week_start} · encerra {semana?.closes_at ? new Date(semana.closes_at).toLocaleString("pt-BR") : "—"}
          {semana?.premio_titulo ? ` · atual: ${semana.premio_titulo}` : " · nenhum prêmio cadastrado"}
        </p>
        <div className="mt-3 grid gap-2 sm:grid-cols-2">
          <Input placeholder="Prêmio (ex.: Day off + R$ 200)" value={titulo} onChange={(e) => setTitulo(e.target.value)} />
          <Textarea placeholder="Detalhes (opcional)" value={descricao} onChange={(e) => setDescricao(e.target.value)} className="sm:col-span-2" />
        </div>
        <div className="mt-3 flex flex-wrap gap-2">
          <Button onClick={salvar} disabled={busy}>Salvar prêmio</Button>
          <Button variant="outline" onClick={encerrar} disabled={busy}>
            <Flag className="mr-2 h-4 w-4" /> Encerrar semana agora
          </Button>
        </div>
      </Card>

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
    </div>
  );
}
