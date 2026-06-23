import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { Plus, Goal, Pencil, Trash2, X } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { toast } from "sonner";
import { RhPageHeader } from "@/components/rh/RhLayout";
import { okrs as seedOkrs, type OKR } from "@/lib/rh/extra";

export const Route = createFileRoute("/_authenticated/rh/okrs")({
  component: Okrs,
});

const NIVEIS: OKR["nivel"][] = ["Empresa", "Departamento", "Colaborador"];

type KR = { titulo: string; progresso: number };
type FormState = { nivel: OKR["nivel"]; objetivo: string; dono: string; krs: KR[] };

const emptyForm: FormState = { nivel: "Empresa", objetivo: "", dono: "", krs: [{ titulo: "", progresso: 0 }] };

const avgProgress = (krs: KR[]) =>
  krs.length ? Math.round(krs.reduce((a, k) => a + (k.progresso || 0), 0) / krs.length) : 0;

function Okrs() {
  const [items, setItems] = useState<OKR[]>(seedOkrs);
  const [open, setOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<FormState>(emptyForm);

  const openNew = () => { setEditingId(null); setForm(emptyForm); setOpen(true); };
  const openEdit = (o: OKR) => {
    setEditingId(o.id);
    setForm({ nivel: o.nivel, objetivo: o.objetivo, dono: o.dono, krs: o.krs.map((k) => ({ ...k })) });
    setOpen(true);
  };

  const setKr = (i: number, patch: Partial<KR>) =>
    setForm((f) => ({ ...f, krs: f.krs.map((k, idx) => (idx === i ? { ...k, ...patch } : k)) }));
  const addKr = () => setForm((f) => ({ ...f, krs: [...f.krs, { titulo: "", progresso: 0 }] }));
  const removeKr = (i: number) => setForm((f) => ({ ...f, krs: f.krs.filter((_, idx) => idx !== i) }));

  const save = () => {
    if (!form.objetivo.trim()) return toast.error("Informe o objetivo.");
    if (!form.dono.trim()) return toast.error("Informe o responsável.");
    const krs = form.krs.filter((k) => k.titulo.trim());
    if (krs.length === 0) return toast.error("Adicione ao menos um Key Result.");
    const progresso = avgProgress(krs);

    if (editingId) {
      setItems((prev) => prev.map((o) =>
        o.id === editingId ? { ...o, nivel: form.nivel, objetivo: form.objetivo, dono: form.dono, krs, progresso } : o
      ));
      toast.success("OKR atualizado.");
    } else {
      setItems((prev) => [
        { id: `ok-${Date.now()}`, nivel: form.nivel, objetivo: form.objetivo, dono: form.dono, krs, progresso },
        ...prev,
      ]);
      toast.success("OKR criado.");
    }
    setOpen(false);
  };

  const remove = (id: string) => {
    setItems((prev) => prev.filter((o) => o.id !== id));
    toast.success("OKR removido.");
  };

  return (
    <div>
      <RhPageHeader
        title="OKRs"
        description="Objetivos e Key Results por empresa, departamento e colaborador."
        actions={<Button size="sm" onClick={openNew}><Plus className="mr-2 h-4 w-4" /> Novo OKR</Button>}
      />
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {items.map((o) => (
          <Card key={o.id}>
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between gap-2">
                <Badge variant="outline">{o.nivel}</Badge>
                <div className="flex items-center gap-1">
                  <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openEdit(o)}>
                    <Pencil className="h-3.5 w-3.5" />
                  </Button>
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button variant="ghost" size="icon" className="h-7 w-7"><Trash2 className="h-3.5 w-3.5 text-destructive" /></Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Excluir OKR?</AlertDialogTitle>
                        <AlertDialogDescription>"{o.objetivo}" será removido.</AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Cancelar</AlertDialogCancel>
                        <AlertDialogAction onClick={() => remove(o.id)}>Excluir</AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                  <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10 text-primary">
                    <Goal className="h-4 w-4" />
                  </span>
                </div>
              </div>
              <CardTitle className="text-base">{o.objetivo}</CardTitle>
              <p className="text-xs text-muted-foreground">Responsável: {o.dono}</p>
            </CardHeader>
            <CardContent>
              <div className="mb-4 flex items-center gap-3">
                <Progress value={o.progresso} className="h-2" />
                <span className="text-xs font-medium text-muted-foreground">{o.progresso}%</span>
              </div>
              <div className="space-y-3">
                {o.krs.map((kr, i) => (
                  <div key={i}>
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">{kr.titulo}</span>
                      <span className="text-xs font-medium">{kr.progresso}%</span>
                    </div>
                    <Progress value={kr.progresso} className="mt-1 h-1.5" />
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[85vh] overflow-y-auto">
          <DialogHeader><DialogTitle>{editingId ? "Editar OKR" : "Novo OKR"}</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Nível</Label>
              <Select value={form.nivel} onValueChange={(v) => setForm((f) => ({ ...f, nivel: v as OKR["nivel"] }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {NIVEIS.map((n) => <SelectItem key={n} value={n}>{n}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Objetivo</Label>
              <Input value={form.objetivo} onChange={(e) => setForm((f) => ({ ...f, objetivo: e.target.value }))} />
            </div>
            <div className="space-y-2">
              <Label>Responsável</Label>
              <Input value={form.dono} onChange={(e) => setForm((f) => ({ ...f, dono: e.target.value }))} />
            </div>
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label>Key Results</Label>
                <Button type="button" size="sm" variant="ghost" onClick={addKr}><Plus className="mr-1 h-4 w-4" /> Adicionar KR</Button>
              </div>
              {form.krs.map((kr, i) => (
                <div key={i} className="flex items-center gap-2">
                  <Input
                    className="flex-1"
                    placeholder="Título do KR"
                    value={kr.titulo}
                    onChange={(e) => setKr(i, { titulo: e.target.value })}
                  />
                  <Input
                    type="number"
                    min={0}
                    max={100}
                    className="w-20"
                    value={kr.progresso}
                    onChange={(e) => setKr(i, { progresso: Math.max(0, Math.min(100, Number(e.target.value))) })}
                  />
                  <Button type="button" variant="ghost" size="icon" className="h-9 w-9 shrink-0" onClick={() => removeKr(i)} disabled={form.krs.length === 1}>
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              ))}
              <p className="text-xs text-muted-foreground">Progresso do objetivo = média dos KRs.</p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
            <Button onClick={save}>Salvar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
