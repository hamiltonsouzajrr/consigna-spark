import { createFileRoute, Link } from "@tanstack/react-router";
import { useState, useRef } from "react";
import { useSuspenseQuery, useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { producaoConsultoraQueryOptions, formatMes } from "@/lib/rh/producao";
import {
  Plane, FileText, ReceiptText, GraduationCap, HeartHandshake, Clock,
  CalendarDays, Bell, CheckCircle2, TrendingUp, ChevronRight,
  Plus, Pencil, Trash2, Settings2, Camera, Loader2, Wallet, RefreshCw,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
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
import { cn } from "@/lib/utils";
import { RhPageHeader } from "@/components/rh/RhLayout";
import { formatDate, brl } from "@/lib/rh/mock";
import { ReconhecimentosPopup } from "@/components/rh/ReconhecimentosPopup";
import { ElogiosPopup } from "@/components/rh/ElogiosPopup";
import { portalQueryOptions, type KpiKey } from "@/lib/rh/portal";
import {
  getPortalContent, saveAviso, deleteAviso, saveAtalho, deleteAtalho, saveKpis,
  saveProfilePhoto, deleteProfilePhoto,
  type Aviso, type Atalho, type PortalKpis,
} from "@/lib/rh/portal-admin.functions";
import { supabase } from "@/integrations/supabase/client";
import {
  PORTAL_ICON_NAMES, PORTAL_TONES, portalIcon, toneClass,
} from "@/lib/rh/portal-icons";
import { getResumoTomadoresAl } from "@/lib/prospeccao/tomadores-al.functions";

export const Route = createFileRoute("/_authenticated/rh/portal/")({
  component: PortalIndex,
});

const tones: Record<string, string> = {
  sky: "bg-sky-500/15 text-sky-600 dark:text-sky-400",
  emerald: "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400",
  violet: "bg-violet-500/15 text-violet-600 dark:text-violet-400",
  amber: "bg-amber-500/15 text-amber-600 dark:text-amber-400",
};

function KpiLink({ kpi, label, value, hint, icon: Icon, tone }: {
  kpi: KpiKey; label: string; value: string | number; hint: string; icon: LucideIcon; tone: keyof typeof tones;
}) {
  return (
    <Link to="/rh/portal/$kpi" params={{ kpi }} search={{ periodo: "6m" }} className="group">
      <Card className="h-full p-5 transition-colors hover:border-primary/50 hover:bg-accent/40">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="truncate text-sm text-muted-foreground">{label}</p>
            <p className="mt-2 text-3xl font-bold tracking-tight">{value}</p>
            <p className="mt-1 flex items-center gap-1 text-xs text-muted-foreground">
              {hint}
              <ChevronRight className="h-3 w-3 opacity-0 transition-opacity group-hover:opacity-100" />
            </p>
          </div>
          <span className={cn("flex h-11 w-11 shrink-0 items-center justify-center rounded-xl", tones[tone])}>
            <Icon className="h-5 w-5" />
          </span>
        </div>
      </Card>
    </Link>
  );
}

const emptyAviso = { titulo: "", quando: "", tone: "sky", icon: "Megaphone", sort: 0 };
const emptyAtalho = { label: "", icon: "FileText", sort: 0 };

function PortalIndex() {
  const qc = useQueryClient();
  const { data } = useSuspenseQuery(portalQueryOptions());
  const me = data.colaborador;

  const fetchContent = useServerFn(getPortalContent);
  const { data: content } = useQuery({
    queryKey: ["rh", "portal-content"],
    queryFn: () => fetchContent(),
  });
  const isAdmin = content?.isAdmin ?? false;
  const invalidate = () => qc.invalidateQueries({ queryKey: ["rh", "portal-content"] });

  const fetchResumoTomadores = useServerFn(getResumoTomadoresAl);
  const { data: resumoTomadores, isLoading: resumoTomadoresLoading, refetch: refetchResumoTomadores } = useQuery({
    queryKey: ["tomadores-al", "resumo-portal"],
    queryFn: () => fetchResumoTomadores(),
  });

  // --- Profile photo (self-service for the consultant)
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [photoBusy, setPhotoBusy] = useState(false);
  const savePhotoFn = useServerFn(saveProfilePhoto);
  const delPhotoFn = useServerFn(deleteProfilePhoto);

  const uploadPhoto = async (file: File) => {
    if (file.size > 5 * 1024 * 1024) return toast.error("A imagem deve ter no máximo 5MB.");
    setPhotoBusy(true);
    try {
      const { data: auth } = await supabase.auth.getUser();
      const uid = auth.user?.id;
      if (!uid) throw new Error("Sessão expirada. Entre novamente.");
      const ext = file.name.split(".").pop()?.toLowerCase() || "jpg";
      const path = `${uid}/avatar-${Date.now()}.${ext}`;
      const { error: upErr } = await supabase.storage
        .from("portal-avatars")
        .upload(path, file, { upsert: true, contentType: file.type });
      if (upErr) throw upErr;
      await savePhotoFn({ data: { foto_path: path } });
      toast.success("Foto atualizada.");
      invalidate();
    } catch (e: any) {
      toast.error(e?.message ?? "Não foi possível enviar a foto.");
    } finally {
      setPhotoBusy(false);
    }
  };

  const removePhoto = async () => {
    setPhotoBusy(true);
    try {
      await delPhotoFn();
      toast.success("Foto removida.");
      invalidate();
    } catch (e: any) {
      toast.error(e?.message ?? "Não foi possível remover a foto.");
    } finally {
      setPhotoBusy(false);
    }
  };

  // KPI values: usa config do banco se existir, senão o mock.
  const k = content?.kpis;
  const saldoFerias = k ? k.saldo_ferias : data.saldoFerias;
  const bancoHoras = k ? k.banco_horas : data.bancoHoras;
  const salario = k ? Number(k.salario) : data.salario;
  const beneficios = k ? k.beneficios : data.beneficiosAtivos;
  const treinTotal = k && k.trein_total > 0 ? k.trein_total : data.treinamentos.total;
  const treinConcl = k && k.trein_total > 0 ? k.trein_concluidos : data.treinamentos.concluidos;
  const treinProg = treinTotal > 0 ? Math.round((treinConcl / treinTotal) * 100) : 0;

  // --- Mutations
  const saveAvisoFn = useServerFn(saveAviso);
  const delAvisoFn = useServerFn(deleteAviso);
  const saveAtalhoFn = useServerFn(saveAtalho);
  const delAtalhoFn = useServerFn(deleteAtalho);
  const saveKpisFn = useServerFn(saveKpis);

  const mSaveAviso = useMutation({ mutationFn: (d: any) => saveAvisoFn({ data: d }), onSuccess: () => { toast.success("Aviso salvo."); invalidate(); }, onError: (e: any) => toast.error(e?.message) });
  const mDelAviso = useMutation({ mutationFn: (id: string) => delAvisoFn({ data: { id } }), onSuccess: () => { toast.success("Aviso removido."); invalidate(); }, onError: (e: any) => toast.error(e?.message) });
  const mSaveAtalho = useMutation({ mutationFn: (d: any) => saveAtalhoFn({ data: d }), onSuccess: () => { toast.success("Atalho salvo."); invalidate(); }, onError: (e: any) => toast.error(e?.message) });
  const mDelAtalho = useMutation({ mutationFn: (id: string) => delAtalhoFn({ data: { id } }), onSuccess: () => { toast.success("Atalho removido."); invalidate(); }, onError: (e: any) => toast.error(e?.message) });
  const mSaveKpis = useMutation({ mutationFn: (d: any) => saveKpisFn({ data: d }), onSuccess: () => { toast.success("KPIs atualizados."); invalidate(); }, onError: (e: any) => toast.error(e?.message) });

  // --- Dialog states
  const [avisoOpen, setAvisoOpen] = useState(false);
  const [avisoForm, setAvisoForm] = useState<any>(emptyAviso);
  const [atalhoOpen, setAtalhoOpen] = useState(false);
  const [atalhoForm, setAtalhoForm] = useState<any>(emptyAtalho);
  const [kpisOpen, setKpisOpen] = useState(false);
  const [kpisForm, setKpisForm] = useState<any>(null);

  const openAviso = (a?: Aviso) => { setAvisoForm(a ? { ...a, quando: a.quando ?? "" } : emptyAviso); setAvisoOpen(true); };
  const openAtalho = (a?: Atalho) => { setAtalhoForm(a ?? emptyAtalho); setAtalhoOpen(true); };
  const openKpis = () => {
    setKpisForm({
      saldo_ferias: saldoFerias, banco_horas: bancoHoras, salario,
      beneficios, trein_total: treinTotal, trein_concluidos: treinConcl,
    });
    setKpisOpen(true);
  };

  const atalhos = content?.atalhos ?? [];
  const avisos = content?.avisos ?? [];

  return (
    <div>
      <ReconhecimentosPopup />
      <ElogiosPopup />
      <RhPageHeader
        title="Portal do Colaborador"
        description="Autoatendimento e informações pessoais."
        actions={isAdmin ? <Button size="sm" variant="outline" onClick={openKpis}><Settings2 className="mr-2 h-4 w-4" /> Editar KPIs</Button> : null}
      />

      <Card className="mb-6">
        <CardContent className="flex flex-col items-center gap-4 p-6 sm:flex-row sm:items-center">
          <div className="group relative">
            <Avatar className="h-16 w-16">
              <AvatarImage src={content?.foto ?? me.foto} alt={me.nome} />
              <AvatarFallback>{me.nome.slice(0, 2)}</AvatarFallback>
            </Avatar>
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={photoBusy}
              className="absolute inset-0 flex items-center justify-center rounded-full bg-black/50 text-white opacity-0 transition-opacity group-hover:opacity-100 disabled:opacity-100"
              aria-label="Alterar foto"
            >
              {photoBusy ? <Loader2 className="h-5 w-5 animate-spin" /> : <Camera className="h-5 w-5" />}
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) uploadPhoto(f);
                e.target.value = "";
              }}
            />
          </div>
          <div className="text-center sm:text-left">
            <h2 className="text-lg font-bold">{me.nome}</h2>
            <p className="text-sm text-muted-foreground">{me.cargo} · {me.departamento}</p>
            <div className="mt-2 flex flex-wrap justify-center gap-2 sm:justify-start">
              <Badge variant="secondary" className="border-0 bg-emerald-100 text-emerald-700">{me.status}</Badge>
            </div>
            <div className="mt-3 flex flex-wrap justify-center gap-2 sm:justify-start">
              <Button size="sm" variant="outline" disabled={photoBusy} onClick={() => fileInputRef.current?.click()}>
                <Camera className="mr-2 h-4 w-4" /> {content?.foto ? "Trocar foto" : "Adicionar foto"}
              </Button>
              {content?.foto && (
                <Button size="sm" variant="ghost" disabled={photoBusy} onClick={removePhoto}>
                  <Trash2 className="mr-2 h-4 w-4 text-destructive" /> Remover
                </Button>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="mb-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
        <KpiLink kpi="ferias" label="Saldo de férias" value={`${saldoFerias} dias`} icon={Plane} tone="sky" hint="Ver detalhes" />
        <KpiLink kpi="banco-horas" label="Banco de horas" value={`${bancoHoras >= 0 ? "+" : ""}${bancoHoras}h`} icon={Clock} tone="emerald" hint="Ver detalhes" />
        <KpiLink kpi="salario" label="Premiação de campanha" value={brl(salario)} icon={ReceiptText} tone="violet" hint="Ver detalhes" />
        <KpiLink kpi="beneficios" label="Benefícios" value={beneficios} icon={HeartHandshake} tone="amber" hint="Ver detalhes" />
      </div>

      <div className="mb-6 grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader className="pb-3 flex flex-row items-center justify-between">
            <CardTitle className="text-base">Atalhos</CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            {atalhos.length === 0 && <p className="col-span-full text-sm text-muted-foreground">Nenhum atalho configurado.</p>}
            {atalhos.map((a) => {
              const Icon = portalIcon(a.icon);
              return (
                <div key={a.id} className="relative">
                  <Button variant="outline" className="h-auto w-full flex-col gap-2 py-4" onClick={() => toast.info(`${a.label} (demonstração)`)}>
                    <Icon className="h-5 w-5" />
                    <span className="text-xs">{a.label}</span>
                  </Button>
                  {isAdmin && (
                    <div className="absolute right-1 top-1 flex gap-0.5">
                      <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => openAtalho(a)}><Pencil className="h-3 w-3" /></Button>
                      <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => mDelAtalho.mutate(a.id)}><Trash2 className="h-3 w-3 text-destructive" /></Button>
                    </div>
                  )}
                </div>
              );
            })}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3 flex flex-row items-center justify-between">
            <div className="flex items-center gap-2">
              <Bell className="h-4 w-4 text-muted-foreground" />
              <CardTitle className="text-base">Avisos</CardTitle>
            </div>
            {isAdmin && <Button size="sm" variant="ghost" onClick={() => openAviso()}><Plus className="mr-1 h-4 w-4" /> Adicionar</Button>}
          </CardHeader>
          <CardContent className="space-y-3">
            {avisos.length === 0 && <p className="text-sm text-muted-foreground">Nenhum aviso publicado.</p>}
            {avisos.map((a) => {
              const Icon = portalIcon(a.icon);
              return (
                <div key={a.id} className="flex items-start gap-3 border-b pb-3 last:border-0 last:pb-0">
                  <Icon className={`mt-0.5 h-4 w-4 shrink-0 ${toneClass(a.tone)}`} />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium leading-tight">{a.titulo}</p>
                    {a.quando && <p className="text-xs text-muted-foreground">{a.quando}</p>}
                  </div>
                  {isAdmin && (
                    <div className="flex gap-0.5">
                      <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => openAviso(a)}><Pencil className="h-3 w-3" /></Button>
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-6 w-6"><Trash2 className="h-3 w-3 text-destructive" /></Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>Excluir aviso?</AlertDialogTitle>
                            <AlertDialogDescription>"{a.titulo}" será removido do portal.</AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Cancelar</AlertDialogCancel>
                            <AlertDialogAction onClick={() => mDelAviso.mutate(a.id)}>Excluir</AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    </div>
                  )}
                </div>
              );
            })}
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card>
          <CardHeader className="pb-3 flex flex-row items-center gap-2">
            <CalendarDays className="h-4 w-4 text-muted-foreground" />
            <CardTitle className="text-base">Próximas férias</CardTitle>
          </CardHeader>
          <CardContent>
            {data.proximasFerias ? (
              <div className="space-y-2">
                <p className="text-2xl font-bold">{data.proximasFerias.dias} dias</p>
                <p className="text-sm text-muted-foreground">
                  {formatDate(data.proximasFerias.inicio)} → {formatDate(data.proximasFerias.fim)}
                </p>
                <Badge variant="secondary" className="border-0 bg-emerald-100 text-emerald-700">
                  <CheckCircle2 className="mr-1 h-3 w-3" /> Aprovado
                </Badge>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">Nenhuma férias agendada.</p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3 flex flex-row items-center gap-2">
            <GraduationCap className="h-4 w-4 text-muted-foreground" />
            <CardTitle className="text-base">Meus treinamentos</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Progresso</span>
              <span className="font-semibold">{treinProg}%</span>
            </div>
            <Progress value={treinProg} />
            <p className="text-xs text-muted-foreground">{treinConcl} de {treinTotal} concluídos</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3 flex flex-row items-center gap-2">
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
            <CardTitle className="text-base">Minhas solicitações</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {data.solicitacoes.length ? (
              data.solicitacoes.map((s) => (
                <div key={s.id} className="flex items-center justify-between border-b pb-2 text-sm last:border-0 last:pb-0">
                  <span>{s.tipo}</span>
                  <Badge variant="secondary" className={
                    s.status === "Aprovado" ? "border-0 bg-emerald-100 text-emerald-700"
                      : s.status === "Pendente" ? "border-0 bg-amber-100 text-amber-700"
                      : "border-0 bg-rose-100 text-rose-700"}>
                    {s.status}
                  </Badge>
                </div>
              ))
            ) : (
              <p className="text-sm text-muted-foreground">Sem solicitações no momento.</p>
            )}
            <p className="pt-1 text-xs text-muted-foreground">{data.documentos} documento(s) no seu perfil</p>
          </CardContent>
        </Card>
      </div>

      <MinhaProducao consultora={me.nome} />

      {/* ---- Dialog Aviso ---- */}
      <Dialog open={avisoOpen} onOpenChange={setAvisoOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>{avisoForm.id ? "Editar aviso" : "Novo aviso"}</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2"><Label>Título</Label><Input value={avisoForm.titulo} onChange={(e) => setAvisoForm((f: any) => ({ ...f, titulo: e.target.value }))} /></div>
            <div className="space-y-2"><Label>Quando</Label><Input value={avisoForm.quando} onChange={(e) => setAvisoForm((f: any) => ({ ...f, quando: e.target.value }))} placeholder="Ex.: Hoje, 16h" /></div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Cor</Label>
                <Select value={avisoForm.tone} onValueChange={(v) => setAvisoForm((f: any) => ({ ...f, tone: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{PORTAL_TONES.map((t) => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Ícone</Label>
                <Select value={avisoForm.icon} onValueChange={(v) => setAvisoForm((f: any) => ({ ...f, icon: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{PORTAL_ICON_NAMES.map((n) => <SelectItem key={n} value={n}>{n}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAvisoOpen(false)}>Cancelar</Button>
            <Button onClick={() => { if (!avisoForm.titulo.trim()) return toast.error("Informe o título."); mSaveAviso.mutate({ ...avisoForm, quando: avisoForm.quando || null }); setAvisoOpen(false); }}>Salvar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ---- Dialog Atalho ---- */}
      <Dialog open={atalhoOpen} onOpenChange={setAtalhoOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>{atalhoForm.id ? "Editar atalho" : "Novo atalho"}</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2"><Label>Rótulo</Label><Input value={atalhoForm.label} onChange={(e) => setAtalhoForm((f: any) => ({ ...f, label: e.target.value }))} /></div>
            <div className="space-y-2">
              <Label>Ícone</Label>
              <Select value={atalhoForm.icon} onValueChange={(v) => setAtalhoForm((f: any) => ({ ...f, icon: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{PORTAL_ICON_NAMES.map((n) => <SelectItem key={n} value={n}>{n}</SelectItem>)}</SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAtalhoOpen(false)}>Cancelar</Button>
            <Button onClick={() => { if (!atalhoForm.label.trim()) return toast.error("Informe o rótulo."); mSaveAtalho.mutate(atalhoForm); setAtalhoOpen(false); }}>Salvar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ---- Dialog KPIs ---- */}
      <Dialog open={kpisOpen} onOpenChange={setKpisOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Editar KPIs do portal</DialogTitle></DialogHeader>
          {kpisForm && (
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2"><Label>Saldo de férias (dias)</Label><Input type="number" value={kpisForm.saldo_ferias} onChange={(e) => setKpisForm((f: any) => ({ ...f, saldo_ferias: Number(e.target.value) }))} /></div>
              <div className="space-y-2"><Label>Banco de horas (h)</Label><Input type="number" value={kpisForm.banco_horas} onChange={(e) => setKpisForm((f: any) => ({ ...f, banco_horas: Number(e.target.value) }))} /></div>
              <div className="space-y-2"><Label>Premiação de campanha (R$)</Label><Input type="number" value={kpisForm.salario} onChange={(e) => setKpisForm((f: any) => ({ ...f, salario: Number(e.target.value) }))} /></div>
              <div className="space-y-2"><Label>Benefícios ativos</Label><Input type="number" value={kpisForm.beneficios} onChange={(e) => setKpisForm((f: any) => ({ ...f, beneficios: Number(e.target.value) }))} /></div>
              <div className="space-y-2"><Label>Treinamentos (total)</Label><Input type="number" value={kpisForm.trein_total} onChange={(e) => setKpisForm((f: any) => ({ ...f, trein_total: Number(e.target.value) }))} /></div>
              <div className="space-y-2"><Label>Treinamentos concluídos</Label><Input type="number" value={kpisForm.trein_concluidos} onChange={(e) => setKpisForm((f: any) => ({ ...f, trein_concluidos: Number(e.target.value) }))} /></div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setKpisOpen(false)}>Cancelar</Button>
            <Button onClick={() => { mSaveKpis.mutate(kpisForm); setKpisOpen(false); }}>Salvar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function MinhaProducao({ consultora }: { consultora: string }) {
  const { data } = useQuery(producaoConsultoraQueryOptions(consultora));
  const linhas = data ?? [];
  const totalValor = linhas.reduce((a, r) => a + Number(r.valor), 0);
  const totalContratos = linhas.reduce((a, r) => a + Number(r.contratos), 0);

  return (
    <Card className="mt-6">
      <CardHeader className="pb-3 flex flex-row items-center gap-2">
        <TrendingUp className="h-4 w-4 text-muted-foreground" />
        <CardTitle className="text-base">Minha produção</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="grid grid-cols-2 gap-3">
          <div className="rounded-lg border p-3">
            <p className="text-xs text-muted-foreground">Valor total produzido</p>
            <p className="text-xl font-bold">{brl(totalValor)}</p>
          </div>
          <div className="rounded-lg border p-3">
            <p className="text-xs text-muted-foreground">Contratos</p>
            <p className="text-xl font-bold">{totalContratos}</p>
          </div>
        </div>
        {linhas.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nenhuma produção registrada ainda.</p>
        ) : (
          linhas.map((r) => (
            <div key={r.id} className="flex items-center justify-between border-b pb-2 text-sm last:border-0 last:pb-0">
              <span>{formatMes(r.mes)}</span>
              <span className="flex items-center gap-3">
                <Badge variant="secondary" className="border-0">{r.contratos} contratos</Badge>
                <span className="font-semibold tabular-nums">{brl(Number(r.valor))}</span>
              </span>
            </div>
          ))
        )}
      </CardContent>
    </Card>
  );
}
