import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid, Cell } from "recharts";
import { Plus, Pencil, Trash2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { RhPageHeader } from "@/components/rh/RhLayout";
import { turnoverPred, turnoverNivel } from "@/lib/rh/extra";

export const Route = createFileRoute("/rh/turnover")({
  component: Turnover,
});

const TAG_OPTIONS = ["Treinamento", "Consultor"] as const;
type Tag = (typeof TAG_OPTIONS)[number];

type Pred = {
  id: string;
  colaborador: string;
  departamento: string;
  score: number;
  probabilidade: number;
  tag: Tag;
};

type FormState = Omit<Pred, "id">;

const cor = (s: number) => (s <= 30 ? "#16a34a" : s <= 70 ? "#d97706" : "#dc2626");
const badge = (s: number) => {
  const n = turnoverNivel(s);
  const cls = s <= 30 ? "bg-emerald-100 text-emerald-700" : s <= 70 ? "bg-amber-100 text-amber-700" : "bg-rose-100 text-rose-700";
  return <Badge className={`border-0 ${cls}`}>{n} risco</Badge>;
};
const tagBadge = (t: Tag) => {
  const cls = t === "Treinamento" ? "bg-sky-100 text-sky-700" : "bg-violet-100 text-violet-700";
  return <Badge className={`border-0 ${cls}`}>{t}</Badge>;
};

const EMPTY: FormState = {
  colaborador: "",
  departamento: "",
  score: 50,
  probabilidade: 50,
  tag: "Consultor",
};

function Turnover() {
  const [items, setItems] = useState<Pred[]>(() =>
    turnoverPred.map((d, i) => ({
      id: `t-${i}`,
      colaborador: d.colaborador,
      departamento: d.departamento,
      score: d.score,
      probabilidade: d.probabilidade,
      tag: i % 2 === 0 ? "Consultor" : "Treinamento",
    })),
  );
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<FormState>(EMPTY);

  const data = [...items].sort((a, b) => b.score - a.score);

  const openNew = () => {
    setEditingId(null);
    setForm(EMPTY);
    setDialogOpen(true);
  };
  const openEdit = (p: Pred) => {
    setEditingId(p.id);
    setForm({ colaborador: p.colaborador, departamento: p.departamento, score: p.score, probabilidade: p.probabilidade, tag: p.tag });
    setDialogOpen(true);
  };

  const save = () => {
    if (!form.colaborador.trim()) {
      toast.error("Informe o colaborador.");
      return;
    }
    const clamp = (n: number) => Math.max(0, Math.min(100, Math.round(n)));
    const payload = { ...form, score: clamp(form.score), probabilidade: clamp(form.probabilidade) };
    if (editingId) {
      setItems((prev) => prev.map((p) => (p.id === editingId ? { ...p, ...payload } : p)));
      toast.success("Registro atualizado.");
    } else {
      setItems((prev) => [...prev, { id: `t-${Date.now()}`, ...payload }]);
      toast.success("Registro adicionado.");
    }
    setDialogOpen(false);
  };

  const remove = (id: string, nome: string) => {
    setItems((prev) => prev.filter((p) => p.id !== id));
    toast.success(`"${nome}" removido.`);
  };

  return (
    <div>
      <RhPageHeader
        title="Predição de Turnover"
        description="Score de risco de saída por colaborador (IA — demonstração)."
        actions={<Button size="sm" onClick={openNew}><Plus className="mr-2 h-4 w-4" /> Adicionar</Button>}
      />
      <Card className="mb-6">
        <CardHeader className="pb-2"><CardTitle className="text-base">Score de risco</CardTitle></CardHeader>
        <CardContent className="h-80">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data} layout="vertical" margin={{ left: 20 }}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-muted" horizontal={false} />
              <XAxis type="number" domain={[0, 100]} tick={{ fontSize: 12 }} />
              <YAxis type="category" dataKey="colaborador" width={120} tick={{ fontSize: 11 }} />
              <Tooltip />
              <Bar dataKey="score" radius={[0, 6, 6, 0]}>
                {data.map((d, i) => <Cell key={i} fill={cor(d.score)} />)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      <Card>
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Colaborador</TableHead>
                <TableHead>Departamento</TableHead>
                <TableHead>Tag</TableHead>
                <TableHead className="w-48">Score</TableHead>
                <TableHead>Probabilidade</TableHead>
                <TableHead>Nível</TableHead>
                <TableHead className="text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.map((d) => (
                <TableRow key={d.id}>
                  <TableCell className="font-medium">{d.colaborador}</TableCell>
                  <TableCell className="text-sm">{d.departamento}</TableCell>
                  <TableCell>{tagBadge(d.tag)}</TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <Progress value={d.score} className="h-2" />
                      <span className="text-xs">{d.score}</span>
                    </div>
                  </TableCell>
                  <TableCell className="text-sm">{d.probabilidade}%</TableCell>
                  <TableCell>{badge(d.score)}</TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-1">
                      <Button variant="ghost" size="icon" onClick={() => openEdit(d)}>
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button variant="ghost" size="icon">
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>Excluir registro?</AlertDialogTitle>
                            <AlertDialogDescription>
                              Esta ação removerá "{d.colaborador}" da lista de predição.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Cancelar</AlertDialogCancel>
                            <AlertDialogAction onClick={() => remove(d.id, d.colaborador)}>
                              Excluir
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
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
            <DialogTitle>{editingId ? "Editar registro" : "Adicionar registro"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Colaborador</Label>
              <Input value={form.colaborador} onChange={(e) => setForm((f) => ({ ...f, colaborador: e.target.value }))} />
            </div>
            <div className="space-y-2">
              <Label>Departamento</Label>
              <Input value={form.departamento} onChange={(e) => setForm((f) => ({ ...f, departamento: e.target.value }))} />
            </div>
            <div className="space-y-2">
              <Label>Tag</Label>
              <Select value={form.tag} onValueChange={(v) => setForm((f) => ({ ...f, tag: v as Tag }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {TAG_OPTIONS.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Score (0-100)</Label>
                <Input type="number" min={0} max={100} value={form.score} onChange={(e) => setForm((f) => ({ ...f, score: Number(e.target.value) }))} />
              </div>
              <div className="space-y-2">
                <Label>Probabilidade (%)</Label>
                <Input type="number" min={0} max={100} value={form.probabilidade} onChange={(e) => setForm((f) => ({ ...f, probabilidade: Number(e.target.value) }))} />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancelar</Button>
            <Button onClick={save}>{editingId ? "Salvar" : "Adicionar"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
