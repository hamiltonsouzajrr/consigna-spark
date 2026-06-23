import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { Plus, Pencil, Trash2 } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
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
import { equipamentos as equipamentosData, formatDate, type Equipamento } from "@/lib/rh/mock";

export const Route = createFileRoute("/_authenticated/rh/equipamentos")({
  component: Equipamentos,
});

type EquipStatus = Equipamento["status"];
const STATUS_OPTIONS: EquipStatus[] = ["Em uso", "Devolvido", "Manutenção"];

type FormState = {
  tipo: string;
  colaborador: string;
  patrimonio: string;
  serie: string;
  entrega: string;
  devolucao: string;
  status: EquipStatus;
};

const emptyForm: FormState = {
  tipo: "",
  colaborador: "",
  patrimonio: "",
  serie: "",
  entrega: "",
  devolucao: "",
  status: "Em uso",
};

function Equipamentos() {
  const [items, setItems] = useState<Equipamento[]>(equipamentosData);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<FormState>(emptyForm);

  const openNew = () => {
    setEditingId(null);
    setForm(emptyForm);
    setDialogOpen(true);
  };

  const openEdit = (e: Equipamento) => {
    setEditingId(e.id);
    setForm({
      tipo: e.tipo,
      colaborador: e.colaborador,
      patrimonio: e.patrimonio,
      serie: e.serie,
      entrega: e.entrega,
      devolucao: e.devolucao ?? "",
      status: e.status,
    });
    setDialogOpen(true);
  };

  const save = () => {
    if (!form.tipo.trim() || !form.colaborador.trim()) {
      toast.error("Informe o tipo e o colaborador.");
      return;
    }
    const payload: Omit<Equipamento, "id"> = {
      tipo: form.tipo.trim(),
      colaborador: form.colaborador.trim(),
      patrimonio: form.patrimonio.trim(),
      serie: form.serie.trim() || "-",
      entrega: form.entrega,
      devolucao: form.devolucao || null,
      status: form.status,
    };
    if (editingId) {
      setItems((prev) => prev.map((e) => (e.id === editingId ? { ...e, ...payload } : e)));
      toast.success("Equipamento atualizado");
    } else {
      setItems((prev) => [{ id: `e-${Date.now()}`, ...payload }, ...prev]);
      toast.success("Equipamento adicionado");
    }
    setDialogOpen(false);
  };

  const remove = (id: string, tipo: string) => {
    setItems((prev) => prev.filter((e) => e.id !== id));
    toast.success(`${tipo} excluído`);
  };

  return (
    <div>
      <RhPageHeader
        title="Equipamentos"
        description="Controle de ativos entregues aos colaboradores."
        actions={<Button size="sm" onClick={openNew}><Plus className="mr-2 h-4 w-4" /> Novo Equipamento</Button>}
      />
      <Card>
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Tipo</TableHead>
                <TableHead>Colaborador</TableHead>
                <TableHead>Patrimônio</TableHead>
                <TableHead>Nº de série</TableHead>
                <TableHead>Entrega</TableHead>
                <TableHead>Devolução</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {items.length === 0 && (
                <TableRow>
                  <TableCell colSpan={8} className="py-10 text-center text-sm text-muted-foreground">
                    Nenhum equipamento cadastrado.
                  </TableCell>
                </TableRow>
              )}
              {items.map((e) => (
                <TableRow key={e.id}>
                  <TableCell><Badge variant="outline">{e.tipo}</Badge></TableCell>
                  <TableCell className="font-medium">{e.colaborador}</TableCell>
                  <TableCell className="text-sm">{e.patrimonio}</TableCell>
                  <TableCell className="text-sm">{e.serie}</TableCell>
                  <TableCell className="text-sm">{formatDate(e.entrega)}</TableCell>
                  <TableCell className="text-sm">{formatDate(e.devolucao)}</TableCell>
                  <TableCell><StatusBadge status={e.status} /></TableCell>
                  <TableCell>
                    <div className="flex justify-end gap-1">
                      <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEdit(e)}>
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
                            <AlertDialogTitle>Excluir equipamento?</AlertDialogTitle>
                            <AlertDialogDescription>
                              Esta ação removerá {e.tipo} de {e.colaborador}. Não é possível desfazer.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Cancelar</AlertDialogCancel>
                            <AlertDialogAction onClick={() => remove(e.id, e.tipo)}>Excluir</AlertDialogAction>
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
            <DialogTitle>{editingId ? "Editar equipamento" : "Novo equipamento"}</DialogTitle>
            <DialogDescription>Preencha os dados do ativo.</DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-2 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="tipo">Tipo</Label>
              <Input id="tipo" value={form.tipo} onChange={(ev) => setForm({ ...form, tipo: ev.target.value })} placeholder="Notebook, Celular..." />
            </div>
            <div className="space-y-2">
              <Label htmlFor="colaborador">Colaborador</Label>
              <Input id="colaborador" value={form.colaborador} onChange={(ev) => setForm({ ...form, colaborador: ev.target.value })} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="patrimonio">Patrimônio</Label>
              <Input id="patrimonio" value={form.patrimonio} onChange={(ev) => setForm({ ...form, patrimonio: ev.target.value })} placeholder="PAT-000" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="serie">Nº de série</Label>
              <Input id="serie" value={form.serie} onChange={(ev) => setForm({ ...form, serie: ev.target.value })} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="entrega">Entrega</Label>
              <Input id="entrega" type="date" value={form.entrega} onChange={(ev) => setForm({ ...form, entrega: ev.target.value })} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="devolucao">Devolução</Label>
              <Input id="devolucao" type="date" value={form.devolucao} onChange={(ev) => setForm({ ...form, devolucao: ev.target.value })} />
            </div>
            <div className="space-y-2 sm:col-span-2">
              <Label>Status</Label>
              <Select value={form.status} onValueChange={(v) => setForm({ ...form, status: v as EquipStatus })}>
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
