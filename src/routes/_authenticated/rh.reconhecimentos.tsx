import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Plus, Award, Pencil, Trash2, CalendarClock } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectGroup, SelectItem, SelectLabel, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { toast } from "sonner";
import { RhPageHeader } from "@/components/rh/RhLayout";
import { ReconhecimentosPopup } from "@/components/rh/ReconhecimentosPopup";
import { formatDate } from "@/lib/rh/mock";
import {
  getReconhecimentos, saveReconhecimento, deleteReconhecimento,
  TIPOS, CATEGORIAS_RECONHECIMENTO, PERIODICIDADES, type Reconhecimento,
} from "@/lib/rh/reconhecimentos.functions";

export const Route = createFileRoute("/_authenticated/rh/reconhecimentos")({
  component: Reconhecimentos,
});

const tipoCor: Record<string, string> = {
  "Trabalho em equipe": "bg-sky-100 text-sky-700 dark:bg-sky-500/15 dark:text-sky-400",
  Liderança: "bg-violet-100 text-violet-700 dark:bg-violet-500/15 dark:text-violet-400",
  Inovação: "bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-400",
  "Destaque do mês": "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-400",
};

const periodicidadeLabel: Record<string, string> = {
  pontual: "Pontual", diario: "Diário", semanal: "Semanal", mensal: "Mensal",
};

type FormState = {
  de: string; para: string; tipo: string; periodicidade: string; mensagem: string;
  data: string; periodo_inicio: string; periodo_fim: string; popup: boolean;
};

const todayStr = () => new Date().toISOString().slice(0, 10);
const emptyForm = (): FormState => ({
  de: "", para: "", tipo: TIPOS[0], periodicidade: "pontual", mensagem: "",
  data: todayStr(), periodo_inicio: "", periodo_fim: "", popup: true,
});

function Reconhecimentos() {
  const qc = useQueryClient();
  const fetchRecs = useServerFn(getReconhecimentos);
  const saveFn = useServerFn(saveReconhecimento);
  const delFn = useServerFn(deleteReconhecimento);

  const { data } = useQuery({
    queryKey: ["rh", "reconhecimentos"],
    queryFn: () => fetchRecs(),
  });
  const isAdmin = data?.isAdmin ?? false;
  const items = data?.items ?? [];
  const invalidate = () => qc.invalidateQueries({ queryKey: ["rh", "reconhecimentos"] });

  const [open, setOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<FormState>(emptyForm());

  const openNew = () => { setEditingId(null); setForm(emptyForm()); setOpen(true); };
  const openEdit = (r: Reconhecimento) => {
    setEditingId(r.id);
    setForm({
      de: r.de, para: r.para, tipo: r.tipo, periodicidade: r.periodicidade ?? "pontual", mensagem: r.mensagem,
      data: r.data, periodo_inicio: r.periodo_inicio ?? "", periodo_fim: r.periodo_fim ?? "", popup: r.popup,
    });
    setOpen(true);
  };

  const mSave = useMutation({
    mutationFn: (d: any) => saveFn({ data: d }),
    onSuccess: () => { toast.success("Reconhecimento salvo."); invalidate(); setOpen(false); },
    onError: (e: any) => toast.error(e?.message ?? "Erro ao salvar."),
  });
  const mDel = useMutation({
    mutationFn: (id: string) => delFn({ data: { id } }),
    onSuccess: () => { toast.success("Reconhecimento removido."); invalidate(); },
    onError: (e: any) => toast.error(e?.message ?? "Erro ao excluir."),
  });

  const save = () => {
    if (!form.de.trim() || !form.para.trim()) return toast.error("Informe quem reconhece e quem é reconhecido.");
    if (!form.mensagem.trim()) return toast.error("Escreva uma mensagem.");
    if (form.periodo_inicio && form.periodo_fim && form.periodo_fim < form.periodo_inicio)
      return toast.error("O fim do período deve ser após o início.");
    mSave.mutate({
      ...(editingId ? { id: editingId } : {}),
      de: form.de, para: form.para, tipo: form.tipo, periodicidade: form.periodicidade, mensagem: form.mensagem,
      data: form.data,
      periodo_inicio: form.periodo_inicio || null,
      periodo_fim: form.periodo_fim || null,
      popup: form.popup,
    });
  };

  return (
    <div>
      <ReconhecimentosPopup />
      <RhPageHeader
        title="Reconhecimentos"
        description="Elogios e reconhecimentos entre colaboradores."
        actions={isAdmin ? <Button size="sm" onClick={openNew}><Plus className="mr-2 h-4 w-4" /> Novo reconhecimento</Button> : null}
      />
      <div className="grid gap-4 md:grid-cols-2">
        {items.length === 0 && <p className="text-sm text-muted-foreground">Nenhum reconhecimento cadastrado.</p>}
        {items.map((r) => (
          <Card key={r.id}>
            <CardContent className="p-5">
              <div className="flex items-start gap-3">
                <Avatar className="h-10 w-10">
                  <AvatarFallback>{r.de.slice(0, 2)}</AvatarFallback>
                </Avatar>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="text-sm font-semibold">{r.de}</p>
                    <span className="text-xs text-muted-foreground">→</span>
                    <p className="text-sm font-semibold">{r.para}</p>
                    <span className="flex h-7 w-7 items-center justify-center rounded-full bg-amber-500/15 text-amber-500">
                      <Award className="h-4 w-4" />
                    </span>
                    {isAdmin && (
                      <div className="ml-auto flex gap-0.5">
                        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openEdit(r)}><Pencil className="h-3.5 w-3.5" /></Button>
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-7 w-7"><Trash2 className="h-3.5 w-3.5 text-destructive" /></Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>Excluir reconhecimento?</AlertDialogTitle>
                              <AlertDialogDescription>Esta ação não pode ser desfeita.</AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>Cancelar</AlertDialogCancel>
                              <AlertDialogAction onClick={() => mDel.mutate(r.id)}>Excluir</AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      </div>
                    )}
                  </div>
                  <div className="mt-2 flex flex-wrap items-center gap-1.5">
                    <Badge variant="secondary" className={`border-0 ${tipoCor[r.tipo] ?? "bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-400"}`}>
                      {r.tipo}
                    </Badge>
                    {r.periodicidade && r.periodicidade !== "pontual" && (
                      <Badge variant="outline" className="text-xs">{periodicidadeLabel[r.periodicidade]}</Badge>
                    )}
                  </div>
                  <p className="mt-2 text-sm text-muted-foreground">{r.mensagem}</p>
                  <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                    <span>{formatDate(r.data)}</span>
                    {r.popup && (r.periodo_inicio || r.periodo_fim) && (
                      <Badge variant="outline" className="gap-1 text-xs">
                        <CalendarClock className="h-3 w-3" />
                        Pop-up {r.periodo_inicio ? formatDate(r.periodo_inicio) : "…"} – {r.periodo_fim ? formatDate(r.periodo_fim) : "…"}
                      </Badge>
                    )}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[85vh] overflow-y-auto">
          <DialogHeader><DialogTitle>{editingId ? "Editar reconhecimento" : "Novo reconhecimento"}</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2"><Label>De</Label><Input value={form.de} onChange={(e) => setForm((f) => ({ ...f, de: e.target.value }))} /></div>
              <div className="space-y-2"><Label>Para</Label><Input value={form.para} onChange={(e) => setForm((f) => ({ ...f, para: e.target.value }))} /></div>
            </div>
            <div className="space-y-2">
              <Label>Tipo</Label>
              <Select value={form.tipo} onValueChange={(v) => setForm((f) => ({ ...f, tipo: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent className="max-h-72">
                  {CATEGORIAS_RECONHECIMENTO.map((cat) => (
                    <SelectGroup key={cat.categoria}>
                      <SelectLabel>{cat.categoria}</SelectLabel>
                      {cat.titulos.map((t) => <SelectItem key={`${cat.categoria}-${t}`} value={t}>{t}</SelectItem>)}
                    </SelectGroup>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Periodicidade</Label>
              <Select value={form.periodicidade} onValueChange={(v) => setForm((f) => ({ ...f, periodicidade: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{PERIODICIDADES.map((p) => <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-2"><Label>Mensagem</Label><Textarea value={form.mensagem} onChange={(e) => setForm((f) => ({ ...f, mensagem: e.target.value }))} /></div>
            <div className="space-y-2"><Label>Data</Label><Input type="date" value={form.data} onChange={(e) => setForm((f) => ({ ...f, data: e.target.value }))} /></div>

            <div className="rounded-lg border p-3 space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <Label className="text-sm">Exibir como pop-up para todos</Label>
                  <p className="text-xs text-muted-foreground">Aparece automaticamente durante o período definido.</p>
                </div>
                <Switch checked={form.popup} onCheckedChange={(v) => setForm((f) => ({ ...f, popup: v }))} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2"><Label>Início do período</Label><Input type="date" value={form.periodo_inicio} onChange={(e) => setForm((f) => ({ ...f, periodo_inicio: e.target.value }))} /></div>
                <div className="space-y-2"><Label>Fim do período</Label><Input type="date" value={form.periodo_fim} onChange={(e) => setForm((f) => ({ ...f, periodo_fim: e.target.value }))} /></div>
              </div>
            </div>
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
