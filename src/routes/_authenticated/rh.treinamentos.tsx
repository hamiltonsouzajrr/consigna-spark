import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { Plus, Pencil, Trash2, GraduationCap, CheckCircle2, Clock, XCircle } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { RhPageHeader, StatusBadge } from "@/components/rh/RhLayout";
import { RhStatCard } from "@/components/rh/RhStatCard";
import { treinamentos as treinamentosData, formatDate, type Treinamento } from "@/lib/rh/mock";

export const Route = createFileRoute("/_authenticated/rh/treinamentos")({
  component: Treinamentos,
});

type TreinoStatus = Treinamento["status"];
const STATUS_OPTIONS: TreinoStatus[] = ["Concluído", "Pendente", "Vencido"];

type FormState = {
  colaborador: string;
  curso: string;
  validade: string;
  status: TreinoStatus;
};

const emptyForm: FormState = {
  colaborador: "",
  curso: "",
  validade: "",
  status: "Pendente",
};

function Treinamentos() {
  const [items, setItems] = useState<Treinamento[]>(treinamentosData);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<FormState>(emptyForm);

  const concluidos = items.filter((t) => t.status === "Concluído").length;
  const pendentes = items.filter((t) => t.status === "Pendente").length;
  const vencidos = items.filter((t) => t.status === "Vencido").length;

  const openNew = () => {
    setEditingId(null);
    setForm(emptyForm);
    setDialogOpen(true);
  };

  const openEdit = (t: Treinamento) => {
    setEditingId(t.id);
    setForm({
      colaborador: t.colaborador,
      curso: t.curso,
      validade: t.validade ?? "",
      status: t.status,
    });
    setDialogOpen(true);
  };

  const save = () => {
    if (!form.colaborador.trim() || !form.curso.trim()) {
      toast.error("Informe o colaborador e o curso.");
      return;
    }
    const payload: Omit<Treinamento, "id"> = {
      colaborador: form.colaborador.trim(),
      curso: form.curso.trim(),
      validade: form.validade || null,
      status: form.status,
    };
    if (editingId) {
      setItems((prev) => prev.map((t) => (t.id === editingId ? { ...t, ...payload } : t)));
      toast.success("Treinamento atualizado");
    } else {
      setItems((prev) => [{ id: `t-${Date.now()}`, ...payload }, ...prev]);
      toast.success("Treinamento adicionado");
    }
    setDialogOpen(false);
  };

  const remove = (id: string, curso: string) => {
    setItems((prev) => prev.filter((t) => t.id !== id));
    toast.success(`${curso} excluído`);
  };

  return (
    <div>
      <RhPageHeader
        title="Treinamentos"
        description="Cursos, certificados e validades."
        actions={<Button size="sm" onClick={openNew}><Plus className="mr-2 h-4 w-4" /> Novo Treinamento</Button>}
      />

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <RhStatCard label="Total" value={items.length} icon={GraduationCap} />
        <RhStatCard label="Concluídos" value={concluidos} icon={CheckCircle2} tone="emerald" />
        <RhStatCard label="Pendentes" value={pendentes} icon={Clock} tone="amber" />
        <RhStatCard label="Vencidos" value={vencidos} icon={XCircle} tone="rose" />
      </div>

      <Card className="mt-6">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Colaborador</TableHead>
                <TableHead>Curso</TableHead>
                <TableHead>Validade</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {items.length === 0 && (
                <TableRow>
                  <TableCell colSpan={5} className="py-10 text-center text-sm text-muted-foreground">
                    Nenhum treinamento cadastrado.
                  </TableCell>
                </TableRow>
              )}
              {items.map((t) => (
                <TableRow key={t.id}>
                  <TableCell className="font-medium">{t.colaborador}</TableCell>
                  <TableCell className="text-sm">{t.curso}</TableCell>
                  <TableCell className="text-sm">{formatDate(t.validade)}</TableCell>
                  <TableCell><StatusBadge status={t.status} /></TableCell>
                  <TableCell>
                    <div className="flex justify-end gap-1">
                      <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEdit(t)}>
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
                            <AlertDialogTitle>Excluir treinamento?</AlertDialogTitle>
                            <AlertDialogDescription>
                              Esta ação removerá {t.curso} de {t.colaborador}. Não é possível desfazer.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Cancelar</AlertDialogCancel>
                            <AlertDialogAction onClick={() => remove(t.id, t.curso)}>Excluir</AlertDialogAction>
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
            <DialogTitle>{editingId ? "Editar treinamento" : "Novo treinamento"}</DialogTitle>
            <DialogDescription>Preencha os dados do curso.</DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-2 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="colaborador">Colaborador</Label>
              <Input id="colaborador" value={form.colaborador} onChange={(ev) => setForm({ ...form, colaborador: ev.target.value })} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="curso">Curso</Label>
              <Input id="curso" value={form.curso} onChange={(ev) => setForm({ ...form, curso: ev.target.value })} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="validade">Validade</Label>
              <Input id="validade" type="date" value={form.validade} onChange={(ev) => setForm({ ...form, validade: ev.target.value })} />
            </div>
            <div className="space-y-2">
              <Label>Status</Label>
              <Select value={form.status} onValueChange={(v) => setForm({ ...form, status: v as TreinoStatus })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {STATUS_OPTIONS.map((s) => (
                    <SelectItem key={s} value={s}>{s}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
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
