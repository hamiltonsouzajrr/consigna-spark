import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Plus, Pencil, Trash2, Bell } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
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
import { RhPageHeader, StatusBadge } from "@/components/rh/RhLayout";
import { formatDate } from "@/lib/rh/mock";
import {
  getOcorrencias, saveOcorrencia, deleteOcorrencia,
  TIPOS_OCORRENCIA, type Ocorrencia,
} from "@/lib/rh/ocorrencias.functions";

export const Route = createFileRoute("/rh/ocorrencias")({
  component: Ocorrencias,
});

const NENHUMA = "__none__";

type FormState = {
  colaborador: string; para_user_id: string; tipo: string;
  data: string; descricao: string; popup: boolean;
};

const todayStr = () => new Date().toISOString().slice(0, 10);
const emptyForm = (): FormState => ({
  colaborador: "", para_user_id: NENHUMA, tipo: "Elogio",
  data: todayStr(), descricao: "", popup: true,
});

function Ocorrencias() {
  const qc = useQueryClient();
  const fetchOco = useServerFn(getOcorrencias);
  const saveFn = useServerFn(saveOcorrencia);
  const delFn = useServerFn(deleteOcorrencia);

  const { data } = useQuery({
    queryKey: ["rh", "ocorrencias"],
    queryFn: () => fetchOco(),
  });
  const isAdmin = data?.isAdmin ?? false;
  const items = data?.items ?? [];
  const consultoras = data?.consultoras ?? [];
  const invalidate = () => qc.invalidateQueries({ queryKey: ["rh", "ocorrencias"] });

  const [open, setOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<FormState>(emptyForm());

  const openNew = () => { setEditingId(null); setForm(emptyForm()); setOpen(true); };
  const openEdit = (o: Ocorrencia) => {
    setEditingId(o.id);
    setForm({
      colaborador: o.colaborador, para_user_id: o.para_user_id ?? NENHUMA, tipo: o.tipo,
      data: o.data, descricao: o.descricao, popup: o.popup,
    });
    setOpen(true);
  };

  const mSave = useMutation({
    mutationFn: (d: any) => saveFn({ data: d }),
    onSuccess: () => { toast.success("Ocorrência salva."); invalidate(); setOpen(false); },
    onError: (e: any) => toast.error(e?.message ?? "Erro ao salvar."),
  });
  const mDel = useMutation({
    mutationFn: (id: string) => delFn({ data: { id } }),
    onSuccess: () => { toast.success("Ocorrência removida."); invalidate(); },
    onError: (e: any) => toast.error(e?.message ?? "Erro ao excluir."),
  });

  const save = () => {
    if (!form.colaborador.trim()) return toast.error("Informe o colaborador.");
    if (!form.descricao.trim()) return toast.error("Escreva uma descrição.");
    if (form.tipo === "Elogio" && form.popup && form.para_user_id === NENHUMA)
      return toast.error("Selecione a consultora para o pop-up do elogio.");
    mSave.mutate({
      ...(editingId ? { id: editingId } : {}),
      colaborador: form.colaborador,
      para_user_id: form.para_user_id === NENHUMA ? null : form.para_user_id,
      tipo: form.tipo,
      data: form.data,
      descricao: form.descricao,
      popup: form.popup,
    });
  };

  if (!isAdmin && data) {
    return (
      <div>
        <RhPageHeader title="Ocorrências" description="Advertências, elogios e observações." />
        <Card className="p-6 text-sm text-muted-foreground">Acesso restrito ao RH e administradores.</Card>
      </div>
    );
  }

  return (
    <div>
      <RhPageHeader
        title="Ocorrências"
        description="Advertências, elogios e observações."
        actions={<Button size="sm" onClick={openNew}><Plus className="mr-2 h-4 w-4" /> Nova Ocorrência</Button>}
      />
      <Card>
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Colaborador</TableHead>
                <TableHead>Tipo</TableHead>
                <TableHead>Data</TableHead>
                <TableHead>Descrição</TableHead>
                <TableHead className="w-24 text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {items.length === 0 && (
                <TableRow><TableCell colSpan={5} className="text-sm text-muted-foreground">Nenhuma ocorrência cadastrada.</TableCell></TableRow>
              )}
              {items.map((o) => (
                <TableRow key={o.id}>
                  <TableCell className="font-medium">{o.colaborador}</TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1.5">
                      <StatusBadge status={o.tipo} />
                      {o.tipo === "Elogio" && o.popup && o.para_user_id && (
                        <Badge variant="outline" className="gap-1 text-xs"><Bell className="h-3 w-3" /> Pop-up</Badge>
                      )}
                    </div>
                  </TableCell>
                  <TableCell className="text-sm">{formatDate(o.data)}</TableCell>
                  <TableCell className="text-sm text-muted-foreground">{o.descricao}</TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-0.5">
                      <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEdit(o)}><Pencil className="h-3.5 w-3.5" /></Button>
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-8 w-8"><Trash2 className="h-3.5 w-3.5 text-destructive" /></Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>Excluir ocorrência?</AlertDialogTitle>
                            <AlertDialogDescription>Esta ação não pode ser desfeita.</AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Cancelar</AlertDialogCancel>
                            <AlertDialogAction onClick={() => mDel.mutate(o.id)}>Excluir</AlertDialogAction>
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

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[85vh] overflow-y-auto">
          <DialogHeader><DialogTitle>{editingId ? "Editar ocorrência" : "Nova ocorrência"}</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Colaborador</Label>
              <Input value={form.colaborador} onChange={(e) => setForm((f) => ({ ...f, colaborador: e.target.value }))} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Tipo</Label>
                <Select value={form.tipo} onValueChange={(v) => setForm((f) => ({ ...f, tipo: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{TIPOS_OCORRENCIA.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Data</Label>
                <Input type="date" value={form.data} onChange={(e) => setForm((f) => ({ ...f, data: e.target.value }))} />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Descrição</Label>
              <Textarea value={form.descricao} onChange={(e) => setForm((f) => ({ ...f, descricao: e.target.value }))} />
            </div>

            {form.tipo === "Elogio" && (
              <div className="rounded-lg border p-3 space-y-3">
                <div className="space-y-2">
                  <Label>Consultora destinatária</Label>
                  <Select value={form.para_user_id} onValueChange={(v) => setForm((f) => ({ ...f, para_user_id: v }))}>
                    <SelectTrigger><SelectValue placeholder="Selecione a consultora" /></SelectTrigger>
                    <SelectContent className="max-h-72">
                      <SelectItem value={NENHUMA}>Nenhuma</SelectItem>
                      {consultoras.map((c) => <SelectItem key={c.user_id} value={c.user_id}>{c.nome}</SelectItem>)}
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-muted-foreground">O elogio aparecerá em pop-up apenas para a consultora selecionada.</p>
                </div>
                <div className="flex items-center justify-between">
                  <Label className="text-sm">Exibir como pop-up para a consultora</Label>
                  <Switch checked={form.popup} onCheckedChange={(v) => setForm((f) => ({ ...f, popup: v }))} />
                </div>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
            <Button onClick={save} disabled={mSave.isPending}>Salvar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
