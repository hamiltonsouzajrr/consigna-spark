import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Plus, Pencil, Trash2 } from "lucide-react";
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid } from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { toast } from "sonner";
import { RhPageHeader } from "@/components/rh/RhLayout";
import { brl } from "@/lib/rh/mock";
import {
  producaoMesQueryOptions,
  mesesQueryOptions,
  mesAtual,
  formatMes,
} from "@/lib/rh/producao";

export const Route = createFileRoute("/_authenticated/rh/avaliacoes")({
  component: Avaliacoes,
});

// Avaliação qualitativa por consultora (mantida em memória; a base de desempenho
// vem da produção real lançada em /rh/producao).
type Avaliacao = {
  consultora: string;
  periodo: string;
  notaFinal: number;
  feedback: string;
};

type FormState = {
  consultora: string;
  periodo: string;
  notaFinal: string;
  feedback: string;
};

function Avaliacoes() {
  const { data: meses } = useQuery(mesesQueryOptions());
  const [mes, setMes] = useState(mesAtual());
  const { data: producao } = useQuery(producaoMesQueryOptions(mes));

  const [avaliacoes, setAvaliacoes] = useState<Avaliacao[]>([]);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<string | null>(null);
  const [form, setForm] = useState<FormState>({ consultora: "", periodo: "", notaFinal: "", feedback: "" });

  const lista = producao ?? [];
  const maxValor = useMemo(() => Math.max(1, ...lista.map((p) => p.valor)), [lista]);

  // Junta produção (desempenho) com a avaliação qualitativa da consultora.
  const linhas = useMemo(
    () =>
      lista.map((p) => {
        const av = avaliacoes.find((a) => a.consultora === p.consultora);
        const resultado = Math.round((p.valor / maxValor) * 100);
        return { ...p, resultado, avaliacao: av };
      }),
    [lista, avaliacoes, maxValor],
  );

  const grafico = linhas
    .filter((l) => l.avaliacao)
    .map((l) => ({ nome: l.consultora.split(" ")[0], nota: l.avaliacao!.notaFinal }));

  const openNew = (consultora?: string) => {
    setEditing(null);
    setForm({ consultora: consultora ?? "", periodo: formatMes(mes), notaFinal: "", feedback: "" });
    setDialogOpen(true);
  };

  const openEdit = (a: Avaliacao) => {
    setEditing(a.consultora);
    setForm({ consultora: a.consultora, periodo: a.periodo, notaFinal: String(a.notaFinal), feedback: a.feedback });
    setDialogOpen(true);
  };

  const save = () => {
    if (!form.consultora) { toast.error("Selecione a consultora."); return; }
    const nota = Number(form.notaFinal.replace(",", "."));
    if (isNaN(nota) || nota < 0 || nota > 10) { toast.error("Nota final deve estar entre 0 e 10."); return; }
    if (!form.periodo.trim()) { toast.error("Informe o período."); return; }
    const payload: Avaliacao = {
      consultora: form.consultora,
      periodo: form.periodo.trim(),
      notaFinal: nota,
      feedback: form.feedback.trim(),
    };
    setAvaliacoes((prev) => {
      const exists = prev.some((a) => a.consultora === payload.consultora);
      return exists
        ? prev.map((a) => (a.consultora === payload.consultora ? payload : a))
        : [...prev, payload];
    });
    toast.success(editing ? "Avaliação atualizada" : "Avaliação adicionada");
    setDialogOpen(false);
  };

  const remove = (consultora: string) => {
    setAvaliacoes((prev) => prev.filter((a) => a.consultora !== consultora));
    toast.success("Avaliação excluída");
  };

  // Consultoras com produção mas ainda sem avaliação (para o seletor do "Adicionar").
  const semAvaliacao = lista
    .map((p) => p.consultora)
    .filter((c) => !avaliacoes.some((a) => a.consultora === c));

  return (
    <div>
      <RhPageHeader
        title="Avaliações de Desempenho"
        description="Desempenho baseado na produção do consultor — com notas e feedbacks."
        actions={
          <div className="flex items-center gap-2">
            <Select value={mes} onValueChange={setMes}>
              <SelectTrigger className="w-36"><SelectValue /></SelectTrigger>
              <SelectContent>
                {(meses ?? [mes]).map((m) => (
                  <SelectItem key={m} value={m}>{formatMes(m)}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button size="sm" onClick={() => openNew()}><Plus className="mr-2 h-4 w-4" /> Nova Avaliação</Button>
          </div>
        }
      />

      <Card className="mb-6">
        <CardHeader className="pb-2"><CardTitle className="text-base">Notas de desempenho</CardTitle></CardHeader>
        <CardContent className="h-72">
          {grafico.length === 0 ? (
            <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
              Nenhuma avaliação registrada para {formatMes(mes)}.
            </div>
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={grafico}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-muted" vertical={false} />
                <XAxis dataKey="nome" tick={{ fontSize: 12 }} />
                <YAxis domain={[0, 10]} tick={{ fontSize: 12 }} />
                <Tooltip />
                <Bar dataKey="nota" name="Nota final" fill="#7c3aed" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </CardContent>
      </Card>

      <Card>
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Consultor</TableHead>
                <TableHead>Produção</TableHead>
                <TableHead className="w-48">Desempenho</TableHead>
                <TableHead>Período</TableHead>
                <TableHead>Nota final</TableHead>
                <TableHead className="hidden md:table-cell">Feedback</TableHead>
                <TableHead className="text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {linhas.length === 0 && (
                <TableRow>
                  <TableCell colSpan={7} className="py-10 text-center text-sm text-muted-foreground">
                    Nenhuma produção lançada para {formatMes(mes)}. Lance em Produção para avaliar.
                  </TableCell>
                </TableRow>
              )}
              {linhas.map((l) => (
                <TableRow key={l.id}>
                  <TableCell className="font-medium">{l.consultora}</TableCell>
                  <TableCell className="text-sm">
                    <div className="flex items-center gap-2">
                      <span className="font-medium tabular-nums">{brl(l.valor)}</span>
                      <Badge variant="secondary" className="border-0">{l.contratos} contr.</Badge>
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <Progress value={l.resultado} className="h-2" />
                      <span className="text-xs text-muted-foreground">{l.resultado}%</span>
                    </div>
                  </TableCell>
                  <TableCell className="text-sm">{l.avaliacao?.periodo ?? "—"}</TableCell>
                  <TableCell className="font-semibold">
                    {l.avaliacao ? l.avaliacao.notaFinal.toFixed(1) : "—"}
                  </TableCell>
                  <TableCell className="hidden md:table-cell text-sm text-muted-foreground">
                    {l.avaliacao?.feedback || "—"}
                  </TableCell>
                  <TableCell>
                    <div className="flex justify-end gap-1">
                      {l.avaliacao ? (
                        <>
                          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEdit(l.avaliacao!)}>
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <Button variant="ghost" size="icon" className="h-8 w-8 text-rose-600 hover:text-rose-700">
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                              <AlertDialogHeader>
                                <AlertDialogTitle>Excluir avaliação?</AlertDialogTitle>
                                <AlertDialogDescription>
                                  Esta ação removerá a avaliação de {l.consultora}. A produção lançada é mantida.
                                </AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel>Cancelar</AlertDialogCancel>
                                <AlertDialogAction onClick={() => remove(l.consultora)}>Excluir</AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                        </>
                      ) : (
                        <Button variant="outline" size="sm" onClick={() => openNew(l.consultora)}>
                          <Plus className="mr-1 h-3 w-3" /> Avaliar
                        </Button>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </Card>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editing ? "Editar avaliação" : "Nova avaliação"}</DialogTitle>
            <DialogDescription>Notas e feedback do consultor para o período.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>Consultor</Label>
              {editing ? (
                <Input value={form.consultora} disabled />
              ) : (
                <Select value={form.consultora} onValueChange={(v) => setForm({ ...form, consultora: v })}>
                  <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                  <SelectContent>
                    {semAvaliacao.length === 0 && (
                      <div className="px-2 py-1.5 text-sm text-muted-foreground">Todas as consultoras já avaliadas neste mês.</div>
                    )}
                    {semAvaliacao.map((c) => (
                      <SelectItem key={c} value={c}>{c}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="periodo">Período</Label>
                <Input id="periodo" value={form.periodo} onChange={(ev) => setForm({ ...form, periodo: ev.target.value })} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="nota">Nota final (0–10)</Label>
                <Input id="nota" inputMode="decimal" placeholder="0,0" value={form.notaFinal} onChange={(ev) => setForm({ ...form, notaFinal: ev.target.value })} />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="feedback">Feedback</Label>
              <Textarea id="feedback" rows={3} value={form.feedback} onChange={(ev) => setForm({ ...form, feedback: ev.target.value })} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancelar</Button>
            <Button onClick={save}>{editing ? "Salvar" : "Adicionar"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
