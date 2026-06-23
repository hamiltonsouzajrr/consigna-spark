import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Plus, Pencil, Trash2, X } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { toast } from "sonner";
import { RhPageHeader } from "@/components/rh/RhLayout";
import {
  getOnboarding, saveOnboarding, deleteOnboarding,
  type Onboarding, type Tarefa,
} from "@/lib/rh/onboarding.functions";

export const Route = createFileRoute("/rh/onboarding")({
  component: OnboardingPage,
});

const TAREFAS_PADRAO: Tarefa[] = [
  { label: "Contrato assinado", done: false },
  { label: "Documentação enviada", done: false },
  { label: "Equipamentos entregues", done: false },
  { label: "E-mail corporativo criado", done: false },
  { label: "Treinamentos iniciais concluídos", done: false },
];

type FormState = { colaborador: string; tarefas: Tarefa[] };
const emptyForm = (): FormState => ({ colaborador: "", tarefas: TAREFAS_PADRAO.map((t) => ({ ...t })) });

function OnboardingPage() {
  const qc = useQueryClient();
  const fetchOnb = useServerFn(getOnboarding);
  const saveFn = useServerFn(saveOnboarding);
  const delFn = useServerFn(deleteOnboarding);

  const { data } = useQuery({ queryKey: ["rh", "onboarding"], queryFn: () => fetchOnb() });
  const isAdmin = data?.isAdmin ?? false;
  const items = data?.items ?? [];
  const invalidate = () => qc.invalidateQueries({ queryKey: ["rh", "onboarding"] });

  const [open, setOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<FormState>(emptyForm());

  const openNew = () => { setEditingId(null); setForm(emptyForm()); setOpen(true); };
  const openEdit = (o: Onboarding) => {
    setEditingId(o.id);
    setForm({ colaborador: o.colaborador, tarefas: o.tarefas.map((t) => ({ ...t })) });
    setOpen(true);
  };

  const mSave = useMutation({
    mutationFn: (d: any) => saveFn({ data: d }),
    onSuccess: () => { invalidate(); },
    onError: (e: any) => toast.error(e?.message ?? "Erro ao salvar."),
  });
  const mDel = useMutation({
    mutationFn: (id: string) => delFn({ data: { id } }),
    onSuccess: () => { toast.success("Onboarding removido."); invalidate(); },
    onError: (e: any) => toast.error(e?.message ?? "Erro ao excluir."),
  });

  const saveForm = () => {
    if (!form.colaborador.trim()) return toast.error("Informe o colaborador.");
    const tarefas = form.tarefas.filter((t) => t.label.trim());
    if (tarefas.length === 0) return toast.error("Adicione ao menos uma tarefa.");
    mSave.mutate(
      { ...(editingId ? { id: editingId } : {}), colaborador: form.colaborador, tarefas },
      { onSuccess: () => { toast.success("Onboarding salvo."); setOpen(false); } },
    );
  };

  // Alterna uma tarefa diretamente no card (atualização rápida).
  const toggleTarefa = (o: Onboarding, idx: number) => {
    if (!isAdmin) return;
    const tarefas = o.tarefas.map((t, i) => (i === idx ? { ...t, done: !t.done } : t));
    mSave.mutate({ id: o.id, colaborador: o.colaborador, tarefas });
  };

  const setTarefaLabel = (idx: number, label: string) =>
    setForm((f) => ({ ...f, tarefas: f.tarefas.map((t, i) => (i === idx ? { ...t, label } : t)) }));
  const setTarefaDone = (idx: number, done: boolean) =>
    setForm((f) => ({ ...f, tarefas: f.tarefas.map((t, i) => (i === idx ? { ...t, done } : t)) }));
  const addTarefa = () => setForm((f) => ({ ...f, tarefas: [...f.tarefas, { label: "", done: false }] }));
  const removeTarefa = (idx: number) =>
    setForm((f) => ({ ...f, tarefas: f.tarefas.filter((_, i) => i !== idx) }));

  return (
    <div>
      <RhPageHeader
        title="Onboarding"
        description="Checklist de integração de novos colaboradores."
        actions={isAdmin ? <Button size="sm" onClick={openNew}><Plus className="mr-2 h-4 w-4" /> Novo onboarding</Button> : null}
      />
      <div className="grid gap-4 md:grid-cols-2">
        {items.length === 0 && <p className="text-sm text-muted-foreground">Nenhum onboarding cadastrado.</p>}
        {items.map((o) => {
          const total = o.tarefas.length || 1;
          const done = o.tarefas.filter((t) => t.done).length;
          const pct = Math.round((done / total) * 100);
          return (
            <Card key={o.id}>
              <CardHeader className="pb-2">
                <CardTitle className="flex items-center justify-between text-base">
                  <span>{o.colaborador}</span>
                  <span className="flex items-center gap-2">
                    <span className="text-sm font-normal text-muted-foreground">{pct}% concluído</span>
                    {isAdmin && (
                      <>
                        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openEdit(o)}><Pencil className="h-3.5 w-3.5" /></Button>
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-7 w-7"><Trash2 className="h-3.5 w-3.5 text-destructive" /></Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>Excluir onboarding?</AlertDialogTitle>
                              <AlertDialogDescription>Esta ação não pode ser desfeita.</AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>Cancelar</AlertDialogCancel>
                              <AlertDialogAction onClick={() => mDel.mutate(o.id)}>Excluir</AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      </>
                    )}
                  </span>
                </CardTitle>
                <Progress value={pct} className="h-2" />
              </CardHeader>
              <CardContent className="space-y-3">
                {o.tarefas.map((t, i) => (
                  <label key={i} className={`flex items-center gap-3 text-sm ${isAdmin ? "cursor-pointer" : ""}`}>
                    <Checkbox checked={t.done} disabled={!isAdmin} onCheckedChange={() => toggleTarefa(o, i)} />
                    <span className={t.done ? "text-muted-foreground line-through" : ""}>{t.label}</span>
                  </label>
                ))}
              </CardContent>
            </Card>
          );
        })}
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[85vh] overflow-y-auto">
          <DialogHeader><DialogTitle>{editingId ? "Editar onboarding" : "Novo onboarding"}</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Colaborador</Label>
              <Input value={form.colaborador} onChange={(e) => setForm((f) => ({ ...f, colaborador: e.target.value }))} />
            </div>
            <div className="space-y-2">
              <Label>Tarefas</Label>
              <div className="space-y-2">
                {form.tarefas.map((t, i) => (
                  <div key={i} className="flex items-center gap-2">
                    <Checkbox checked={t.done} onCheckedChange={(v) => setTarefaDone(i, !!v)} />
                    <Input value={t.label} placeholder="Descrição da tarefa" onChange={(e) => setTarefaLabel(i, e.target.value)} />
                    <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0" onClick={() => removeTarefa(i)}><X className="h-4 w-4" /></Button>
                  </div>
                ))}
              </div>
              <Button variant="outline" size="sm" onClick={addTarefa}><Plus className="mr-2 h-4 w-4" /> Adicionar tarefa</Button>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
            <Button onClick={saveForm} disabled={mSave.isPending}>Salvar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
