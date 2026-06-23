import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  Plus, User, Search, MoreHorizontal, Briefcase,
  Building2, Code2, HeartHandshake, Users, Loader2, Trophy, Pencil, Trash2, ArrowRight,
} from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel,
  DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { RhPageHeader } from "@/components/rh/RhLayout";
import {
  getRecrutamento, saveVaga, deleteVaga, saveCandidato, moveCandidato, deleteCandidato,
  ETAPAS, DEPARTAMENTOS, type Vaga, type Candidato,
} from "@/lib/rh/recrutamento.functions";

export const Route = createFileRoute("/_authenticated/rh/recrutamento")({
  component: Recrutamento,
});

const etapaColor: Record<string, string> = {
  Triagem: "bg-blue-500",
  Entrevista: "bg-emerald-500",
  Teste: "bg-amber-500",
  Proposta: "bg-violet-500",
  Contratado: "bg-emerald-500",
};

const areaStyle: Record<string, { icon: typeof Briefcase; cls: string }> = {
  Comercial: { icon: Building2, cls: "bg-blue-500/10 text-blue-600 dark:text-blue-400" },
  Tecnologia: { icon: Code2, cls: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400" },
  "Recursos Humanos": { icon: HeartHandshake, cls: "bg-violet-500/10 text-violet-600 dark:text-violet-400" },
};

function areaFor(dep: string) {
  return areaStyle[dep] ?? { icon: Briefcase, cls: "bg-primary/10 text-primary" };
}

function fitCls(fit: number) {
  if (fit >= 85) return "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400";
  if (fit >= 70) return "bg-amber-500/10 text-amber-600 dark:text-amber-400";
  return "bg-rose-500/10 text-rose-600 dark:text-rose-400";
}

function initials(name: string) {
  return name.split(" ").map((p) => p[0]).slice(0, 2).join("").toUpperCase();
}

const NENHUMA = "__none__";

type VagaForm = { titulo: string; departamento: string; status: string };
type CandForm = {
  nome: string; vaga_id: string; etapa: string; email: string; telefone: string; fit: number; notas: string;
};

const emptyVaga = (): VagaForm => ({ titulo: "", departamento: "Comercial", status: "Aberta" });
const emptyCand = (): CandForm => ({
  nome: "", vaga_id: NENHUMA, etapa: "Triagem", email: "", telefone: "", fit: 80, notas: "",
});

function KpiCard({
  label, value, icon: Icon, cls,
}: { label: string; value: string | number; icon: typeof Users; cls: string }) {
  return (
    <Card className="flex items-center gap-4 rounded-2xl border-border/60 p-4 shadow-sm">
      <span className={cn("flex h-11 w-11 shrink-0 items-center justify-center rounded-xl", cls)}>
        <Icon className="h-5 w-5" />
      </span>
      <div className="min-w-0">
        <p className="text-2xl font-bold tracking-tight">{value}</p>
        <p className="truncate text-xs text-muted-foreground">{label}</p>
      </div>
    </Card>
  );
}

function Recrutamento() {
  const qc = useQueryClient();
  const fetchData = useServerFn(getRecrutamento);
  const saveVagaFn = useServerFn(saveVaga);
  const delVagaFn = useServerFn(deleteVaga);
  const saveCandFn = useServerFn(saveCandidato);
  const moveCandFn = useServerFn(moveCandidato);
  const delCandFn = useServerFn(deleteCandidato);

  const { data } = useQuery({ queryKey: ["rh", "recrutamento"], queryFn: () => fetchData() });
  const isAdmin = data?.isAdmin ?? false;
  const vagas = data?.vagas ?? [];
  const candidatos = data?.candidatos ?? [];
  const invalidate = () => qc.invalidateQueries({ queryKey: ["rh", "recrutamento"] });

  const vagaById = useMemo(() => new Map(vagas.map((v) => [v.id, v])), [vagas]);

  const [busca, setBusca] = useState("");
  const [vagaFiltro, setVagaFiltro] = useState("all");
  const [statusFiltro, setStatusFiltro] = useState("all");

  const filtrados = useMemo(() => {
    return candidatos.filter((c) => {
      if (busca && !c.nome.toLowerCase().includes(busca.toLowerCase())) return false;
      if (vagaFiltro !== "all" && c.vaga_id !== vagaFiltro) return false;
      if (statusFiltro !== "all" && c.etapa !== statusFiltro) return false;
      return true;
    });
  }, [candidatos, busca, vagaFiltro, statusFiltro]);

  const totalCandidatos = candidatos.length;
  const emAndamento = candidatos.filter((c) => c.etapa !== "Contratado").length;
  const contratados = candidatos.filter((c) => c.etapa === "Contratado").length;
  const vagasAbertas = vagas.filter((v) => v.status === "Aberta").length;

  // ----- Vaga dialog -----
  const [vagaOpen, setVagaOpen] = useState(false);
  const [vagaEditId, setVagaEditId] = useState<string | null>(null);
  const [vagaForm, setVagaForm] = useState<VagaForm>(emptyVaga());
  const openNewVaga = () => { setVagaEditId(null); setVagaForm(emptyVaga()); setVagaOpen(true); };
  const openEditVaga = (v: Vaga) => {
    setVagaEditId(v.id);
    setVagaForm({ titulo: v.titulo, departamento: v.departamento, status: v.status });
    setVagaOpen(true);
  };

  const mSaveVaga = useMutation({
    mutationFn: (d: any) => saveVagaFn({ data: d }),
    onSuccess: () => { toast.success("Vaga salva."); invalidate(); setVagaOpen(false); },
    onError: (e: any) => toast.error(e?.message ?? "Erro ao salvar."),
  });
  const mDelVaga = useMutation({
    mutationFn: (id: string) => delVagaFn({ data: { id } }),
    onSuccess: () => { toast.success("Vaga removida."); invalidate(); },
    onError: (e: any) => toast.error(e?.message ?? "Erro ao excluir."),
  });

  const saveVagaForm = () => {
    if (!vagaForm.titulo.trim()) return toast.error("Informe o título da vaga.");
    mSaveVaga.mutate({ ...(vagaEditId ? { id: vagaEditId } : {}), ...vagaForm });
  };

  // ----- Candidato dialog -----
  const [candOpen, setCandOpen] = useState(false);
  const [candEditId, setCandEditId] = useState<string | null>(null);
  const [candForm, setCandForm] = useState<CandForm>(emptyCand());
  const openNewCand = () => { setCandEditId(null); setCandForm(emptyCand()); setCandOpen(true); };
  const openEditCand = (c: Candidato) => {
    setCandEditId(c.id);
    setCandForm({
      nome: c.nome, vaga_id: c.vaga_id ?? NENHUMA, etapa: c.etapa,
      email: c.email ?? "", telefone: c.telefone ?? "", fit: c.fit, notas: c.notas ?? "",
    });
    setCandOpen(true);
  };

  const mSaveCand = useMutation({
    mutationFn: (d: any) => saveCandFn({ data: d }),
    onSuccess: () => { toast.success("Candidato salvo."); invalidate(); setCandOpen(false); },
    onError: (e: any) => toast.error(e?.message ?? "Erro ao salvar."),
  });
  const mMoveCand = useMutation({
    mutationFn: (d: { id: string; etapa: string }) => moveCandFn({ data: d }),
    onSuccess: () => { invalidate(); },
    onError: (e: any) => toast.error(e?.message ?? "Erro ao mover."),
  });
  const mDelCand = useMutation({
    mutationFn: (id: string) => delCandFn({ data: { id } }),
    onSuccess: () => { toast.success("Candidato removido."); invalidate(); },
    onError: (e: any) => toast.error(e?.message ?? "Erro ao excluir."),
  });

  const saveCandForm = () => {
    if (!candForm.nome.trim()) return toast.error("Informe o nome do candidato.");
    mSaveCand.mutate({
      ...(candEditId ? { id: candEditId } : {}),
      nome: candForm.nome,
      vaga_id: candForm.vaga_id === NENHUMA ? null : candForm.vaga_id,
      etapa: candForm.etapa,
      email: candForm.email || null,
      telefone: candForm.telefone || null,
      fit: candForm.fit,
      notas: candForm.notas || null,
    });
  };

  return (
    <div className="animate-fade-in space-y-6">
      <RhPageHeader
        title="Recrutamento"
        description="Pipeline do processo seletivo."
        actions={isAdmin ? (
          <div className="flex gap-2">
            <Button size="sm" variant="outline" onClick={openNewVaga}><Briefcase className="mr-2 h-4 w-4" /> Nova Vaga</Button>
            <Button size="sm" onClick={openNewCand} className="bg-gradient-to-r from-primary to-blue-500 shadow-md shadow-primary/25 transition-all hover:shadow-lg active:scale-[0.98]">
              <Plus className="mr-2 h-4 w-4" /> Novo Candidato
            </Button>
          </div>
        ) : null}
      />

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <KpiCard label="Vagas abertas" value={vagasAbertas} icon={Briefcase} cls="bg-blue-500/10 text-blue-600 dark:text-blue-400" />
        <KpiCard label="Total de candidatos" value={totalCandidatos} icon={Users} cls="bg-violet-500/10 text-violet-600 dark:text-violet-400" />
        <KpiCard label="Em andamento" value={emAndamento} icon={Loader2} cls="bg-amber-500/10 text-amber-600 dark:text-amber-400" />
        <KpiCard label="Contratados" value={contratados} icon={Trophy} cls="bg-emerald-500/10 text-emerald-600 dark:text-emerald-400" />
      </div>

      {/* Cards de vagas */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {vagas.length === 0 && (
          <Card className="col-span-full p-6 text-sm text-muted-foreground">Nenhuma vaga cadastrada.</Card>
        )}
        {vagas.map((v) => {
          const { icon: Icon, cls } = areaFor(v.departamento);
          const total = candidatos.filter((c) => c.vaga_id === v.id).length;
          return (
            <Card key={v.id} className="group rounded-2xl border-border/60 p-5 shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-lg">
              <div className="flex items-start justify-between gap-3">
                <span className={cn("flex h-11 w-11 items-center justify-center rounded-xl", cls)}>
                  <Icon className="h-5 w-5" />
                </span>
                <div className="flex items-center gap-2">
                  <Badge variant={v.status === "Aberta" ? "secondary" : "outline"} className={v.status === "Aberta" ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400" : ""}>
                    {v.status}
                  </Badge>
                  {isAdmin && (
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-foreground">
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => openEditVaga(v)}><Pencil className="mr-2 h-4 w-4" /> Editar</DropdownMenuItem>
                        <DropdownMenuItem onClick={() => mSaveVaga.mutate({ id: v.id, titulo: v.titulo, departamento: v.departamento, status: v.status === "Aberta" ? "Encerrada" : "Aberta" })}>
                          {v.status === "Aberta" ? "Encerrar" : "Reabrir"}
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem className="text-destructive" onClick={() => mDelVaga.mutate(v.id)}><Trash2 className="mr-2 h-4 w-4" /> Excluir</DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  )}
                </div>
              </div>
              <p className="mt-4 font-semibold">{v.titulo}</p>
              <p className="text-xs text-muted-foreground">{v.departamento}</p>
              <div className="mt-3 flex items-baseline gap-1.5">
                <span className="text-2xl font-bold tracking-tight">{total}</span>
                <span className="text-xs text-muted-foreground">candidatos</span>
              </div>
            </Card>
          );
        })}
      </div>

      {/* Filtros */}
      <div className="flex flex-col gap-3 rounded-2xl border border-border/60 bg-card/60 p-3 shadow-sm backdrop-blur sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Buscar candidato..." className="pl-9" />
        </div>
        <Select value={vagaFiltro} onValueChange={setVagaFiltro}>
          <SelectTrigger className="sm:w-48"><SelectValue placeholder="Vaga" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas as vagas</SelectItem>
            {vagas.map((v) => <SelectItem key={v.id} value={v.id}>{v.titulo}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={statusFiltro} onValueChange={setStatusFiltro}>
          <SelectTrigger className="sm:w-40"><SelectValue placeholder="Etapa" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas as etapas</SelectItem>
            {ETAPAS.map((e) => <SelectItem key={e} value={e}>{e}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      {/* Pipeline Kanban */}
      <div className="-mx-1 overflow-x-auto pb-2">
        <div className="grid min-w-[60rem] grid-cols-5 gap-4 px-1">
          {ETAPAS.map((etapa) => {
            const items = filtrados.filter((c) => c.etapa === etapa);
            return (
              <div key={etapa} className="flex flex-col overflow-hidden rounded-2xl border border-border/60 bg-muted/40 shadow-sm">
                <div className={cn("h-1.5 w-full", etapaColor[etapa])} />
                <div className="flex items-center justify-between px-3 py-3">
                  <p className="text-sm font-semibold">{etapa}</p>
                  <Badge variant="secondary" className="rounded-full">{items.length}</Badge>
                </div>
                <div className="space-y-2.5 px-3 pb-3">
                  {items.map((c) => (
                    <Card key={c.id} className="rounded-xl border-border/60 p-3 shadow-sm transition-all hover:shadow-md">
                      <div className="flex items-center gap-2.5">
                        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-primary/15 to-blue-500/15 text-xs font-semibold text-primary">
                          {initials(c.nome)}
                        </span>
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-medium">{c.nome}</p>
                          <p className="truncate text-xs text-muted-foreground">{c.vaga_id ? vagaById.get(c.vaga_id)?.titulo ?? "Vaga removida" : "Sem vaga"}</p>
                        </div>
                        {isAdmin && (
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-foreground"><MoreHorizontal className="h-4 w-4" /></Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem onClick={() => openEditCand(c)}><Pencil className="mr-2 h-4 w-4" /> Editar</DropdownMenuItem>
                              <DropdownMenuSeparator />
                              <DropdownMenuLabel className="text-xs">Mover para</DropdownMenuLabel>
                              {ETAPAS.filter((e) => e !== c.etapa).map((e) => (
                                <DropdownMenuItem key={e} onClick={() => mMoveCand.mutate({ id: c.id, etapa: e })}>
                                  <ArrowRight className="mr-2 h-4 w-4" /> {e}
                                </DropdownMenuItem>
                              ))}
                              <DropdownMenuSeparator />
                              <AlertDialog>
                                <AlertDialogTrigger asChild>
                                  <DropdownMenuItem className="text-destructive" onSelect={(e) => e.preventDefault()}><Trash2 className="mr-2 h-4 w-4" /> Excluir</DropdownMenuItem>
                                </AlertDialogTrigger>
                                <AlertDialogContent>
                                  <AlertDialogHeader>
                                    <AlertDialogTitle>Excluir candidato?</AlertDialogTitle>
                                    <AlertDialogDescription>Esta ação não pode ser desfeita.</AlertDialogDescription>
                                  </AlertDialogHeader>
                                  <AlertDialogFooter>
                                    <AlertDialogCancel>Cancelar</AlertDialogCancel>
                                    <AlertDialogAction onClick={() => mDelCand.mutate(c.id)}>Excluir</AlertDialogAction>
                                  </AlertDialogFooter>
                                </AlertDialogContent>
                              </AlertDialog>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        )}
                      </div>
                      <div className="mt-2.5 flex flex-wrap gap-1.5">
                        <span className={cn("rounded-md px-1.5 py-0.5 text-[10px] font-medium", fitCls(c.fit))}>Fit {c.fit}%</span>
                        {c.email && <span className="rounded-md bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground">{c.email}</span>}
                      </div>
                    </Card>
                  ))}
                  {items.length === 0 && (
                    <div className="flex flex-col items-center gap-1 py-6 text-center">
                      <User className="h-5 w-5 text-muted-foreground/50" />
                      <p className="text-xs text-muted-foreground">Vazio</p>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Dialog Vaga */}
      <Dialog open={vagaOpen} onOpenChange={setVagaOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>{vagaEditId ? "Editar vaga" : "Nova vaga"}</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2"><Label>Título</Label><Input value={vagaForm.titulo} onChange={(e) => setVagaForm((f) => ({ ...f, titulo: e.target.value }))} /></div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Departamento</Label>
                <Select value={vagaForm.departamento} onValueChange={(v) => setVagaForm((f) => ({ ...f, departamento: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{DEPARTAMENTOS.map((d) => <SelectItem key={d} value={d}>{d}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Situação</Label>
                <Select value={vagaForm.status} onValueChange={(v) => setVagaForm((f) => ({ ...f, status: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent><SelectItem value="Aberta">Aberta</SelectItem><SelectItem value="Encerrada">Encerrada</SelectItem></SelectContent>
                </Select>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setVagaOpen(false)}>Cancelar</Button>
            <Button onClick={saveVagaForm} disabled={mSaveVaga.isPending}>Salvar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog Candidato */}
      <Dialog open={candOpen} onOpenChange={setCandOpen}>
        <DialogContent className="max-h-[85vh] overflow-y-auto">
          <DialogHeader><DialogTitle>{candEditId ? "Editar candidato" : "Novo candidato"}</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2"><Label>Nome</Label><Input value={candForm.nome} onChange={(e) => setCandForm((f) => ({ ...f, nome: e.target.value }))} /></div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Vaga</Label>
                <Select value={candForm.vaga_id} onValueChange={(v) => setCandForm((f) => ({ ...f, vaga_id: v }))}>
                  <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value={NENHUMA}>Sem vaga</SelectItem>
                    {vagas.map((v) => <SelectItem key={v.id} value={v.id}>{v.titulo}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Etapa</Label>
                <Select value={candForm.etapa} onValueChange={(v) => setCandForm((f) => ({ ...f, etapa: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{ETAPAS.map((e) => <SelectItem key={e} value={e}>{e}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2"><Label>E-mail</Label><Input type="email" value={candForm.email} onChange={(e) => setCandForm((f) => ({ ...f, email: e.target.value }))} /></div>
              <div className="space-y-2"><Label>Telefone</Label><Input value={candForm.telefone} onChange={(e) => setCandForm((f) => ({ ...f, telefone: e.target.value }))} /></div>
            </div>
            <div className="space-y-2">
              <Label>Fit (%) — {candForm.fit}</Label>
              <Input type="range" min={0} max={100} value={candForm.fit} onChange={(e) => setCandForm((f) => ({ ...f, fit: Number(e.target.value) }))} />
            </div>
            <div className="space-y-2"><Label>Observações</Label><Textarea value={candForm.notas} onChange={(e) => setCandForm((f) => ({ ...f, notas: e.target.value }))} /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCandOpen(false)}>Cancelar</Button>
            <Button onClick={saveCandForm} disabled={mSaveCand.isPending}>Salvar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
