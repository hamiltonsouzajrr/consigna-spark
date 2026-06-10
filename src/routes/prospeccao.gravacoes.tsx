import { createFileRoute, Navigate, Link } from "@tanstack/react-router";
import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/lib/auth";
import { useRhAccess } from "@/hooks/use-rh-access";
import { AppShell } from "@/components/AppShell";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { RhStatCard } from "@/components/rh/RhStatCard";
import { toast } from "sonner";
import {
  ArrowLeft, Video, Download, Copy, Trash2, RefreshCw, FileAudio, FileText,
  CheckCircle2, XCircle, ShieldCheck, Sparkles, Loader2, KeyRound, Clock,
} from "lucide-react";
import {
  adminListApprovals, adminApprovalMediaUrl, adminDeleteApproval, aiTranscribeApproval,
  adminRegenerateToken, getApprovalByToken,
  type AdminApproval,
} from "@/lib/legal/legal.functions";

export const Route = createFileRoute("/prospeccao/gravacoes")({
  head: () => ({ meta: [{ title: "Gravações de videochamada — Admin" }, { name: "robots", content: "noindex,nofollow" }] }),
  component: Page,
});

const brl = (n: number | null) =>
  n == null ? "—" : new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(n);

function fmtDur(s: number | null) {
  if (!s) return "—";
  const m = Math.floor(s / 60), sec = s % 60;
  return `${m}:${String(sec).padStart(2, "0")}`;
}

function Page() {
  const { user, loading } = useAuth();
  const { isAdmin, isLoading: accessLoading } = useRhAccess();

  const listFn = useServerFn(adminListApprovals);
  const mediaFn = useServerFn(adminApprovalMediaUrl);
  const deleteFn = useServerFn(adminDeleteApproval);
  const transcribeFn = useServerFn(aiTranscribeApproval);
  const regenFn = useServerFn(adminRegenerateToken);
  const validateFn = useServerFn(getApprovalByToken);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [openTranscript, setOpenTranscript] = useState<string | null>(null);
  // Detailed per-item status while regenerating the short link.
  type RegenPhase = "pendente" | "processando" | "validando" | "ok" | "erro";
  const [regenState, setRegenState] = useState<Record<string, { phase: RegenPhase; message: string }>>({});

  const q = useQuery({
    queryKey: ["legal", "approvals"],
    queryFn: () => listFn(),
    enabled: !!user && isAdmin,
  });
  const items = q.data ?? [];

  if (loading || accessLoading) return null;
  if (!user) return <Navigate to="/login" />;
  if (!isAdmin) return <Navigate to="/prospeccao" />;

  const stats = {
    total: items.length,
    concluidas: items.filter((i) => i.status === "concluido").length,
    autorizadas: items.filter((i) => i.cliente_aceite === true).length,
    comFalha: items.filter((i) => i.status === "concluido" && (i.video_path ? !i.video_ok : false)).length,
  };

  const openMedia = async (id: string, kind: "video" | "audio") => {
    setBusyId(id);
    try {
      const { url } = await mediaFn({ data: { approvalId: id, kind } });
      window.open(url, "_blank", "noopener");
    } catch (e: any) { toast.error(e?.message ?? "Falha ao abrir o arquivo."); }
    setBusyId(null);
  };

  const download = async (id: string, kind: "video" | "audio") => {
    setBusyId(id);
    try {
      const { url } = await mediaFn({ data: { approvalId: id, kind } });
      const a = document.createElement("a");
      a.href = url; a.download = `${kind}-${id}.webm`;
      document.body.appendChild(a); a.click(); a.remove();
    } catch (e: any) { toast.error(e?.message ?? "Falha ao baixar o arquivo."); }
    setBusyId(null);
  };

  const copyLink = async (token: string) => {
    await navigator.clipboard.writeText(`${window.location.origin}/aprovacao/${token}`);
    toast.success("Link do cliente copiado.");
  };

  const setRegen = (id: string, phase: RegenPhase, message: string) =>
    setRegenState((prev) => ({ ...prev, [id]: { phase, message } }));

  const regenerate = async (it: AdminApproval) => {
    if (!confirm(`Gerar um novo link para "${it.nome_completo}"? O link anterior deixará de funcionar.`)) return;
    setBusyId(it.id);
    setRegen(it.id, "pendente", "Aguardando para iniciar…");
    try {
      setRegen(it.id, "processando", "Gerando novo token seguro…");
      const { token } = await regenFn({ data: { approvalId: it.id } });

      setRegen(it.id, "validando", "Validando o novo link…");
      const check = await validateFn({ data: { token } });
      if (!check.ok) throw new Error("O novo link foi gerado, mas não pôde ser validado. Tente novamente.");

      await navigator.clipboard.writeText(`${window.location.origin}/aprovacao/${token}`);
      setRegen(it.id, "ok", "Novo link gerado, validado e copiado para a área de transferência.");
      toast.success("Novo link gerado, validado e copiado.");
      q.refetch();
    } catch (e: any) {
      const msg = e?.message ?? "Falha ao regenerar o link.";
      setRegen(it.id, "erro", msg);
      toast.error(msg);
    }
    setBusyId(null);
  };


  const remove = async (it: AdminApproval) => {
    if (!confirm(`Excluir a gravação de "${it.nome_completo}"? Os arquivos serão apagados. Esta ação não pode ser desfeita.`)) return;
    setBusyId(it.id);
    try {
      await deleteFn({ data: { approvalId: it.id } });
      toast.success("Gravação excluída.");
      q.refetch();
    } catch (e: any) { toast.error(e?.message ?? "Falha ao excluir."); }
    setBusyId(null);
  };

  const transcribe = async (id: string) => {
    setBusyId(id);
    try {
      await transcribeFn({ data: { approvalId: id } });
      toast.success("Transcrição gerada por IA.");
      q.refetch();
      setOpenTranscript(id);
    } catch (e: any) { toast.error(e?.message ?? "Falha ao transcrever."); }
    setBusyId(null);
  };

  return (
    <AppShell>
      <Button asChild variant="ghost" size="sm" className="mb-4"><Link to="/prospeccao"><ArrowLeft className="mr-2 h-4 w-4" /> Voltar à fila</Link></Button>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold"><ShieldCheck className="h-6 w-6 text-primary" /> Gravações de videochamada</h1>
          <p className="text-sm text-muted-foreground">Gerencie as videochamadas de aprovação, verifique a gravação e o armazenamento.</p>
        </div>
        <Button variant="outline" onClick={() => q.refetch()} disabled={q.isFetching}>
          <RefreshCw className={`mr-2 h-4 w-4 ${q.isFetching ? "animate-spin" : ""}`} /> Atualizar
        </Button>
      </div>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <RhStatCard label="Total de sessões" value={stats.total} icon={Video} tone="sky" />
        <RhStatCard label="Concluídas" value={stats.concluidas} icon={CheckCircle2} tone="emerald" />
        <RhStatCard label="Autorizadas" value={stats.autorizadas} icon={ShieldCheck} tone="violet" />
        <RhStatCard label="Falhas de arquivo" value={stats.comFalha} icon={XCircle} tone="rose" />
      </div>

      <div className="mt-6 space-y-3">
        {q.isLoading && <p className="text-sm text-muted-foreground">Carregando gravações…</p>}
        {!q.isLoading && items.length === 0 && <p className="text-sm text-muted-foreground">Nenhuma videochamada registrada ainda.</p>}

        {items.map((it) => (
          <Card key={it.id} className="p-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="flex items-center gap-2 font-semibold">
                  {it.nome_completo}
                  {it.status === "concluido"
                    ? <Badge className="bg-emerald-600 text-white">Concluída</Badge>
                    : <Badge variant="secondary">Pendente</Badge>}
                  {it.cliente_aceite === true && <Badge className="bg-emerald-600/15 text-emerald-700">Autorizado</Badge>}
                  {it.cliente_aceite === false && <Badge variant="destructive">Não autorizado</Badge>}
                </p>
                <p className="mt-1 text-xs text-muted-foreground">
                  {new Date(it.created_at).toLocaleString("pt-BR")} · {it.consultant_email ?? "—"}
                  {it.banco && <> · {it.banco}</>} · {brl(it.valor_solicitado)} · {fmtDur(it.duracao_segundos)}
                </p>
                <div className="mt-2 flex flex-wrap items-center gap-2 text-xs">
                  <span className={`flex items-center gap-1 ${it.video_ok ? "text-emerald-600" : "text-muted-foreground"}`}>
                    {it.video_ok ? <CheckCircle2 className="h-3.5 w-3.5" /> : <XCircle className="h-3.5 w-3.5" />} Vídeo
                  </span>
                  <span className={`flex items-center gap-1 ${it.audio_ok ? "text-emerald-600" : "text-muted-foreground"}`}>
                    {it.audio_ok ? <CheckCircle2 className="h-3.5 w-3.5" /> : <XCircle className="h-3.5 w-3.5" />} Áudio
                  </span>
                  {it.file_hash && <span className="text-muted-foreground">· hash {it.file_hash.slice(0, 10)}…</span>}
                </div>
              </div>

              <div className="flex flex-wrap justify-end gap-2">
                <Button size="sm" variant="outline" onClick={() => copyLink(it.token)}><Copy className="mr-1.5 h-4 w-4" /> Link</Button>
                <Button size="sm" variant="outline" disabled={busyId === it.id} onClick={() => regenerate(it)}>
                  {busyId === it.id ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : <KeyRound className="mr-1.5 h-4 w-4" />} Novo link
                </Button>
                <Button size="sm" variant="outline" disabled={!it.video_ok || busyId === it.id} onClick={() => openMedia(it.id, "video")}>
                  {busyId === it.id ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : <Video className="mr-1.5 h-4 w-4" />} Assistir
                </Button>
                <Button size="sm" variant="outline" disabled={!it.video_ok || busyId === it.id} onClick={() => download(it.id, "video")}>
                  <Download className="mr-1.5 h-4 w-4" /> Vídeo
                </Button>
                <Button size="sm" variant="outline" disabled={!it.audio_ok || busyId === it.id} onClick={() => download(it.id, "audio")}>
                  <FileAudio className="mr-1.5 h-4 w-4" /> Áudio
                </Button>
                <Button size="sm" variant="outline" disabled={!it.audio_ok || busyId === it.id} onClick={() => transcribe(it.id)}>
                  <Sparkles className="mr-1.5 h-4 w-4" /> Transcrever
                </Button>
                <Button size="sm" variant="ghost" className="text-destructive" disabled={busyId === it.id} onClick={() => remove(it)}>
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </div>

            {regenState[it.id] && (
              <RegenStatus phase={regenState[it.id].phase} message={regenState[it.id].message} />
            )}



            {(it.transcricao || it.resumo) && (
              <div className="mt-3 border-t pt-3">
                <Button size="sm" variant="ghost" className="mb-1 h-7 px-2 text-xs" onClick={() => setOpenTranscript((p) => (p === it.id ? null : it.id))}>
                  <FileText className="mr-1.5 h-3.5 w-3.5" /> {openTranscript === it.id ? "Ocultar" : "Ver"} transcrição
                </Button>
                {openTranscript === it.id && (
                  <div className="space-y-2 text-sm">
                    {it.resumo && <p className="rounded-md bg-muted/40 p-3"><strong>Resumo:</strong> {it.resumo}</p>}
                    {it.transcricao && <p className="whitespace-pre-wrap rounded-md bg-muted/40 p-3 text-muted-foreground">{it.transcricao}</p>}
                  </div>
                )}
              </div>
            )}
          </Card>
        ))}
      </div>
    </AppShell>
  );
}

function RegenStatus({ phase, message }: { phase: "pendente" | "processando" | "validando" | "ok" | "erro"; message: string }) {
  const cfg = {
    pendente: { label: "Pendente", cls: "border-muted-foreground/30 bg-muted/40 text-muted-foreground", icon: <Clock className="h-4 w-4" /> },
    processando: { label: "Processando", cls: "border-sky-500/30 bg-sky-500/10 text-sky-700", icon: <Loader2 className="h-4 w-4 animate-spin" /> },
    validando: { label: "Validando", cls: "border-amber-500/30 bg-amber-500/10 text-amber-700", icon: <Loader2 className="h-4 w-4 animate-spin" /> },
    ok: { label: "Concluído", cls: "border-emerald-500/30 bg-emerald-500/10 text-emerald-700", icon: <CheckCircle2 className="h-4 w-4" /> },
    erro: { label: "Erro", cls: "border-destructive/30 bg-destructive/10 text-destructive", icon: <XCircle className="h-4 w-4" /> },
  }[phase];
  return (
    <div className={`mt-3 flex items-center gap-2 rounded-md border px-3 py-2 text-sm ${cfg.cls}`}>
      {cfg.icon}
      <span className="font-medium">{cfg.label}:</span>
      <span>{message}</span>
    </div>
  );
}

