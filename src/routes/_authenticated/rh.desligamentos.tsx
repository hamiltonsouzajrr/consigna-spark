import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  Plus, Pencil, Trash2, Sparkles, ShieldAlert, History, TrendingDown, Users, Clock, Building2,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogDescription,
} from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { toast } from "sonner";
import { RhPageHeader } from "@/components/rh/RhLayout";
import {
  getDesligamentos, saveDesligamento, deleteDesligamento, aiAprendizados,
  TIPOS_DESLIGAMENTO, type Desligamento,
} from "@/lib/rh/desligamentos.functions";

export const Route = createFileRoute("/_authenticated/_authenticated/rh/desligamentos")({
  component: DesligamentosPage,
});

type FormState = {
  colaborador: string; cargo: string; setor: string;
  data_admissao: string; data_desligamento: string; responsavel: string;
  tipo: (typeof TIPOS_DESLIGAMENTO)[number];
  motivo: string; motivo_detalhado: string; sinais_contratacao: string; alertas_futuros: string;
};

const emptyForm = (): FormState => ({
  colaborador: "", cargo: "", setor: "",
  data_admissao: "", data_desligamento: new Date().toISOString().slice(0, 10), responsavel: "",
  tipo: "Outros", motivo: "", motivo_detalhado: "", sinais_contratacao: "", alertas_futuros: "",
});

function tempoEmpresa(adm: string | null, des: string): string {
  if (!adm) return "—";
  const dias = Math.round((new Date(des).getTime() - new Date(adm).getTime()) / 86400000);
  if (dias < 0) return "—";
  const meses = Math.round((dias / 30) * 10) / 10;
  if (meses >= 12) return `${Math.round((meses / 12) * 10) / 10} ano(s)`;
  return `${meses} mês(es)`;
}

const fmtDate = (d: string | null) => (d ? new Date(d).toLocaleDateString("pt-BR") : "—");

function DesligamentosPage() {
  const qc = useQueryClient();
  const fetchFn = useServerFn(getDesligamentos);
  const saveFn = useServerFn(saveDesligamento);
  const delFn = useServerFn(deleteDesligamento);
  const aiFn = useServerFn(aiAprendizados);

  const { data, isLoading } = useQuery({ queryKey: ["rh", "desligamentos"], queryFn: () => fetchFn() });
  const isAdmin = data?.isAdmin ?? false;
  const items = data?.items ?? [];
  const invalidate = () => qc.invalidateQueries({ queryKey: ["rh", "desligamentos"] });

  const [open, setOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<FormState>(emptyForm());
  const [histOf, setHistOf] = useState<Desligamento | null>(null);
  const [relatorio, setRelatorio] = useState<string>("");

  const saveMut = useMutation({
    mutationFn: (payload: any) => saveFn({ data: payload }),
    onSuccess: () => { toast.success("Desligamento salvo."); setOpen(false); invalidate(); },
    onError: (e: any) => toast.error(e.message ?? "Erro ao salvar."),
  });
  const delMut = useMutation({
    mutationFn: (id: string) => delFn({ data: { id } }),
    onSuccess: () => { toast.success("Desligamento excluído."); invalidate(); },
    onError: (e: any) => toast.error(e.message ?? "Erro ao excluir."),
  });
  const aiMut = useMutation({
    mutationFn: () => aiFn(),
    onSuccess: (r) => setRelatorio(r.relatorio),
    onError: (e: any) => toast.error(e.message ?? "Erro na IA."),
  });

  const openNew = () => { setEditingId(null); setForm(emptyForm()); setOpen(true); };
  const openEdit = (d: Desligamento) => {
    setEditingId(d.id);
    setForm({
      colaborador: d.colaborador, cargo: d.cargo ?? "", setor: d.setor ?? "",
      data_admissao: d.data_admissao ?? "", data_desligamento: d.data_desligamento, responsavel: d.responsavel ?? "",
      tipo: (d.tipo as FormState["tipo"]) ?? "Outros",
      motivo: d.motivo ?? "", motivo_detalhado: d.motivo_detalhado,
      sinais_contratacao: d.sinais_contratacao, alertas_futuros: d.alertas_futuros ?? "",
    });
    setOpen(true);
  };

  const submit = () => {
    if (!form.colaborador.trim()) return toast.error("Informe o nome do colaborador.");
    if (!form.motivo_detalhado.trim()) return toast.error("O motivo detalhado é obrigatório.");
    if (!form.sinais_contratacao.trim()) return toast.error("Os sinais identificados na contratação são obrigatórios.");
    saveMut.mutate({ ...(editingId ? { id: editingId } : {}), ...form });
  };

  // Dashboard metrics
  const stats = useMemo(() => {
    const now = new Date();
    const mes = items.filter((d) => {
      const dt = new Date(d.data_desligamento);
      return dt.getMonth() === now.getMonth() && dt.getFullYear() === now.getFullYear();
    }).length;
    const ano = items.filter((d) => new Date(d.data_desligamento).getFullYear() === now.getFullYear()).length;

    const motivos: Record<string, number> = {};
    items.forEach((d) => { const k = d.motivo?.trim() || d.tipo; motivos[k] = (motivos[k] ?? 0) + 1; });
    const ranking = Object.entries(motivos).sort((a, b) => b[1] - a[1]);
    const motivoTop = ranking[0]?.[0] ?? "—";

    const tempos = items
      .filter((d) => d.data_admissao)
      .map((d) => (new Date(d.data_desligamento).getTime() - new Date(d.data_admissao!).getTime()) / 86400000);
    const tempoMedioMeses = tempos.length
      ? Math.round((tempos.reduce((a, b) => a + b, 0) / tempos.length / 30) * 10) / 10
      : 0;

    const setores: Record<string, number> = {};
    items.forEach((d) => { const k = d.setor?.trim() || "Não informado"; setores[k] = (setores[k] ?? 0) + 1; });
    const setoresRank = Object.entries(setores).sort((a, b) => b[1] - a[1]);

    return { mes, ano, motivoTop, tempoMedioMeses, ranking, setoresRank };
  }, [items]);

  if (!isLoading && !isAdmin) {
    return (
      <div>
        <RhPageHeader title="Desligamentos" description="Acesso restrito." />
        <Card>
          <CardContent className="flex flex-col items-center gap-3 py-12 text-center text-muted-foreground">
            <ShieldAlert className="h-10 w-10" />
            <p>Esta área é exclusiva para RH, Gerência e Administradores.</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const kpis = [
    { label: "Desligamentos no mês", value: stats.mes, icon: TrendingDown },
    { label: "Desligamentos no ano", value: stats.ano, icon: Users },
    { label: "Tempo médio de permanência", value: `${stats.tempoMedioMeses} mês(es)`, icon: Clock },
    { label: "Motivo mais frequente", value: stats.motivoTop, icon: Building2 },
  ];

  return (
    <div className="space-y-6">
      <RhPageHeader
        title="Desligamentos"
        description="Base de inteligência para futuras contratações."
        actions={
          isAdmin ? (
            <Button size="sm" onClick={openNew}><Plus className="mr-2 h-4 w-4" /> Novo Desligamento</Button>
          ) : undefined
        }
      />

      {/* Dashboard */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {kpis.map((k) => (
          <Card key={k.label}>
            <CardContent className="flex items-center gap-3 py-4">
              <div className="rounded-lg bg-muted p-2"><k.icon className="h-5 w-5 text-muted-foreground" /></div>
              <div className="min-w-0">
                <p className="text-xs text-muted-foreground">{k.label}</p>
                <p className="truncate text-lg font-semibold">{k.value}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader><CardTitle className="text-base">Ranking de motivos</CardTitle></CardHeader>
          <CardContent className="space-y-2">
            {stats.ranking.length === 0 && <p className="text-sm text-muted-foreground">Sem dados.</p>}
            {stats.ranking.slice(0, 6).map(([m, n]) => (
              <div key={m} className="flex items-center justify-between text-sm">
                <span className="truncate">{m}</span>
                <Badge variant="secondary">{n}</Badge>
              </div>
            ))}
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle className="text-base">Setores com maior rotatividade</CardTitle></CardHeader>
          <CardContent className="space-y-2">
            {stats.setoresRank.length === 0 && <p className="text-sm text-muted-foreground">Sem dados.</p>}
            {stats.setoresRank.slice(0, 6).map(([s, n]) => (
              <div key={s} className="flex items-center justify-between text-sm">
                <span className="truncate">{s}</span>
                <Badge variant="secondary">{n}</Badge>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>

      {/* IA — Aprendizados de Contratação */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between gap-2">
          <CardTitle className="flex items-center gap-2 text-base">
            <Sparkles className="h-4 w-4 text-primary" /> Aprendizados de Contratação (IA)
          </CardTitle>
          <Button size="sm" variant="outline" onClick={() => aiMut.mutate()} disabled={aiMut.isPending}>
            {aiMut.isPending ? "Analisando..." : "Gerar análise"}
          </Button>
        </CardHeader>
        <CardContent>
          {relatorio ? (
            <div className="whitespace-pre-wrap text-sm leading-relaxed">{relatorio}</div>
          ) : (
            <p className="text-sm text-muted-foreground">
              A IA analisa todos os desligamentos e gera insights para reduzir erros de contratação e turnover.
            </p>
          )}
        </CardContent>
      </Card>

      {/* Histórico / tabela */}
      <Card>
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Colaborador</TableHead>
                <TableHead>Cargo / Setor</TableHead>
                <TableHead>Tempo</TableHead>
                <TableHead>Tipo</TableHead>
                <TableHead>Motivo</TableHead>
                <TableHead>Data</TableHead>
                <TableHead className="text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {items.length === 0 && (
                <TableRow><TableCell colSpan={7} className="py-8 text-center text-muted-foreground">Nenhum desligamento registrado.</TableCell></TableRow>
              )}
              {items.map((d) => (
                <TableRow key={d.id}>
                  <TableCell className="font-medium">{d.colaborador}</TableCell>
                  <TableCell className="text-sm">{d.cargo ?? "—"}<br /><span className="text-muted-foreground">{d.setor ?? ""}</span></TableCell>
                  <TableCell className="text-sm">{tempoEmpresa(d.data_admissao, d.data_desligamento)}</TableCell>
                  <TableCell><Badge variant="outline">{d.tipo}</Badge></TableCell>
                  <TableCell className="max-w-[180px] truncate text-sm" title={d.motivo_detalhado}>{d.motivo ?? "—"}</TableCell>
                  <TableCell className="text-sm">{fmtDate(d.data_desligamento)}</TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-1">
                      <Button size="icon" variant="ghost" onClick={() => setHistOf(d)} title="Histórico"><History className="h-4 w-4" /></Button>
                      <Button size="icon" variant="ghost" onClick={() => openEdit(d)} title="Editar"><Pencil className="h-4 w-4" /></Button>
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button size="icon" variant="ghost" title="Excluir"><Trash2 className="h-4 w-4 text-destructive" /></Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>Excluir desligamento?</AlertDialogTitle>
                            <AlertDialogDescription>Esta ação não pode ser desfeita.</AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Cancelar</AlertDialogCancel>
                            <AlertDialogAction onClick={() => delMut.mutate(d.id)}>Excluir</AlertDialogAction>
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

      {/* Form Dialog */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>{editingId ? "Editar Desligamento" : "Novo Desligamento"}</DialogTitle>
            <DialogDescription>Registre os dados para alimentar a base de inteligência do RH.</DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-2 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label>Nome do colaborador *</Label>
              <Input value={form.colaborador} onChange={(e) => setForm({ ...form, colaborador: e.target.value })} />
            </div>
            <div className="space-y-1.5">
              <Label>Cargo</Label>
              <Input value={form.cargo} onChange={(e) => setForm({ ...form, cargo: e.target.value })} />
            </div>
            <div className="space-y-1.5">
              <Label>Setor</Label>
              <Input value={form.setor} onChange={(e) => setForm({ ...form, setor: e.target.value })} />
            </div>
            <div className="space-y-1.5">
              <Label>Responsável pelo desligamento</Label>
              <Input value={form.responsavel} onChange={(e) => setForm({ ...form, responsavel: e.target.value })} />
            </div>
            <div className="space-y-1.5">
              <Label>Data de admissão</Label>
              <Input type="date" value={form.data_admissao} onChange={(e) => setForm({ ...form, data_admissao: e.target.value })} />
            </div>
            <div className="space-y-1.5">
              <Label>Data de desligamento *</Label>
              <Input type="date" value={form.data_desligamento} onChange={(e) => setForm({ ...form, data_desligamento: e.target.value })} />
            </div>
            <div className="space-y-1.5">
              <Label>Tipo de desligamento</Label>
              <Select value={form.tipo} onValueChange={(v) => setForm({ ...form, tipo: v as FormState["tipo"] })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {TIPOS_DESLIGAMENTO.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Motivo (resumo)</Label>
              <Input value={form.motivo} onChange={(e) => setForm({ ...form, motivo: e.target.value })} placeholder="Ex.: Baixa produtividade" />
            </div>
            <div className="space-y-1.5 sm:col-span-2">
              <Label>Motivo detalhado do desligamento *</Label>
              <Textarea rows={3} value={form.motivo_detalhado} onChange={(e) => setForm({ ...form, motivo_detalhado: e.target.value })} placeholder="Descreva os fatos completos." />
            </div>
            <div className="space-y-1.5 sm:col-span-2">
              <Label>Quais sinais já existiam durante a contratação ou experiência? *</Label>
              <Textarea rows={3} value={form.sinais_contratacao} onChange={(e) => setForm({ ...form, sinais_contratacao: e.target.value })} placeholder="Ex.: Mudava frequentemente de emprego; dificuldade em receber feedback." />
            </div>
            <div className="space-y-1.5 sm:col-span-2">
              <Label>Comportamentos que devem gerar atenção em futuras contratações</Label>
              <Textarea rows={3} value={form.alertas_futuros} onChange={(e) => setForm({ ...form, alertas_futuros: e.target.value })} placeholder="Ex.: Histórico de muitas trocas de emprego; resistência a metas." />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
            <Button onClick={submit} disabled={saveMut.isPending}>{saveMut.isPending ? "Salvando..." : "Salvar"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Histórico Dialog */}
      <Dialog open={!!histOf} onOpenChange={(o) => !o && setHistOf(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Histórico de alterações</DialogTitle>
            <DialogDescription>{histOf?.colaborador}</DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            {(histOf?.historico ?? []).length === 0 && <p className="text-sm text-muted-foreground">Sem registros.</p>}
            {(histOf?.historico ?? []).map((h, i) => (
              <div key={i} className="flex items-center justify-between rounded-md border p-2 text-sm">
                <span>{h.acao}</span>
                <span className="text-muted-foreground">{new Date(h.em).toLocaleString("pt-BR")}</span>
              </div>
            ))}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
