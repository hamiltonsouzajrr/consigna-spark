// Admin-only "Gravações Jurídicas": list legal approval recordings with playback,
// full metadata, AI transcription/summary, filters, search, pagination and downloads.
import { createFileRoute, Navigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { useRhAccess } from "@/hooks/use-rh-access";
import { aiTranscribeApproval } from "@/lib/legal/legal.functions";
import { AppShell } from "@/components/AppShell";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { ShieldCheck, Loader2, Sparkles, Play, FileText, CheckCircle2, XCircle, Lock, Search, X, Download, Video, AudioLines, ChevronLeft, ChevronRight } from "lucide-react";

export const Route = createFileRoute("/gravacoes-juridicas")({
  head: () => ({ meta: [{ title: "Gravações Jurídicas" }, { name: "robots", content: "noindex,nofollow" }] }),
  component: Page,
});

type Rec = {
  id: string; lead_id: string | null; nome_completo: string; cpf: string | null; banco: string | null;
  tipo_operacao: string | null; valor_solicitado: number | null; valor_parcela: number | null;
  consultant_email: string | null; cliente_aceite: boolean | null; aceite_registrado_at: string | null;
  video_path: string | null; audio_path: string | null; transcricao: string | null; resumo: string | null;
  duracao_segundos: number | null; file_hash: string | null; gravado_em: string | null; status: string; created_at: string;
};

const brl = (n: number | null) => (n == null ? "—" : new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(n));
const dur = (s: number | null) => (s == null ? "—" : `${Math.floor(s / 60)}m ${s % 60}s`);

const PAGE_SIZE = 10;

function Page() {
  const { user, loading } = useAuth();
  const { isAdmin, isLoading } = useRhAccess();
  const runAi = useServerFn(aiTranscribeApproval);
  const [items, setItems] = useState<Rec[]>([]);
  const [urls, setUrls] = useState<Record<string, string>>({});
  const [aiBusy, setAiBusy] = useState<string | null>(null);

  // Filters
  const [q, setQ] = useState("");
  const [leadId, setLeadId] = useState("");
  const [consultora, setConsultora] = useState("");
  const [aceite, setAceite] = useState<"all" | "yes" | "no" | "none">("all");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [page, setPage] = useState(1);

  const load = useCallback(async () => {
    const { data } = await supabase.from("legal_approvals").select("*").eq("status", "concluido").order("gravado_em", { ascending: false });
    setItems((data ?? []) as any);
  }, []);
  useEffect(() => { if (user) load(); }, [user, load]);

  const consultoras = useMemo(
    () => Array.from(new Set(items.map((i) => i.consultant_email).filter(Boolean))) as string[],
    [items],
  );

  const filtered = useMemo(() => {
    const term = q.trim().toLowerCase();
    const lead = leadId.trim().toLowerCase();
    const fromTs = from ? new Date(from + "T00:00:00").getTime() : null;
    const toTs = to ? new Date(to + "T23:59:59").getTime() : null;
    return items.filter((r) => {
      if (term && !`${r.nome_completo} ${r.cpf ?? ""} ${r.banco ?? ""} ${r.tipo_operacao ?? ""}`.toLowerCase().includes(term)) return false;
      if (lead && !(r.lead_id ?? "").toLowerCase().includes(lead)) return false;
      if (consultora && r.consultant_email !== consultora) return false;
      if (aceite === "yes" && r.cliente_aceite !== true) return false;
      if (aceite === "no" && r.cliente_aceite !== false) return false;
      if (aceite === "none" && r.cliente_aceite != null) return false;
      const ts = r.gravado_em ? new Date(r.gravado_em).getTime() : null;
      if (fromTs != null && (ts == null || ts < fromTs)) return false;
      if (toTs != null && (ts == null || ts > toTs)) return false;
      return true;
    });
  }, [items, q, leadId, consultora, aceite, from, to]);

  useEffect(() => { setPage(1); }, [q, leadId, consultora, aceite, from, to]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const pageItems = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const hasFilters = q || leadId || consultora || aceite !== "all" || from || to;
  const clearFilters = () => { setQ(""); setLeadId(""); setConsultora(""); setAceite("all"); setFrom(""); setTo(""); };

  const playUrl = async (rec: Rec) => {
    if (!rec.video_path) return;
    const { data } = await supabase.storage.from("legal-recordings").createSignedUrl(rec.video_path, 3600);
    if (data?.signedUrl) setUrls((u) => ({ ...u, [rec.id]: data.signedUrl }));
  };

  const downloadFile = async (path: string | null, suggestedName: string) => {
    if (!path) { toast.error("Arquivo indisponível."); return; }
    const { data, error } = await supabase.storage.from("legal-recordings").createSignedUrl(path, 3600, { download: suggestedName });
    if (error || !data?.signedUrl) { toast.error("Falha ao gerar link de download."); return; }
    const a = document.createElement("a");
    a.href = data.signedUrl;
    a.download = suggestedName;
    document.body.appendChild(a);
    a.click();
    a.remove();
  };

  const downloadText = (r: Rec) => {
    const parts = [
      `Gravação Jurídica — ${r.nome_completo}`,
      `ID do lead: ${r.lead_id ?? "—"}`,
      `Consultora: ${r.consultant_email ?? "—"}`,
      `Data: ${r.gravado_em ? new Date(r.gravado_em).toLocaleString("pt-BR") : "—"}`,
      `Duração: ${dur(r.duracao_segundos)}`,
      `Aceite do cliente: ${r.cliente_aceite === true ? "Autorizado" : r.cliente_aceite === false ? "Não autorizado" : "Sem aceite"}`,
      `Hash do arquivo: ${r.file_hash ?? "—"}`,
      "",
      "=== RESUMO ===",
      r.resumo ?? "—",
      "",
      "=== TRANSCRIÇÃO ===",
      r.transcricao ?? "—",
    ];
    const blob = new Blob([parts.join("\n")], { type: "text/plain;charset=utf-8" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `gravacao_${(r.nome_completo || "lead").replace(/\s+/g, "_")}.txt`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(a.href);
  };

  const generate = async (id: string) => {
    setAiBusy(id);
    try {
      await runAi({ data: { approvalId: id } });
      toast.success("Transcrição e resumo gerados.");
      await load();
    } catch (e: any) {
      toast.error(e?.message ?? "Falha ao gerar transcrição.");
    } finally { setAiBusy(null); }
  };

  if (loading || isLoading) return null;
  if (!user) return <Navigate to="/login" />;
  if (!isAdmin)
    return (
      <AppShell>
        <Card className="mx-auto max-w-md p-8 text-center">
          <Lock className="mx-auto mb-3 h-8 w-8 text-muted-foreground" />
          <p className="font-medium">Área restrita a administradores.</p>
        </Card>
      </AppShell>
    );

  return (
    <AppShell>
      <div className="mb-6 flex items-center gap-2">
        <ShieldCheck className="h-6 w-6 text-primary" />
        <h1 className="text-2xl font-bold">Gravações Jurídicas</h1>
        <Badge variant="secondary">Admin</Badge>
      </div>

      <Card className="mb-4 p-4">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <div className="sm:col-span-2 lg:col-span-1">
            <Label className="mb-1 block text-xs">Busca</Label>
            <div className="relative">
              <Search className="absolute left-2 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Nome, CPF, banco…" className="pl-8" />
            </div>
          </div>
          <div>
            <Label className="mb-1 block text-xs">ID do lead</Label>
            <Input value={leadId} onChange={(e) => setLeadId(e.target.value)} placeholder="ID do lead" />
          </div>
          <div>
            <Label className="mb-1 block text-xs">Consultora</Label>
            <Select value={consultora || "all"} onValueChange={(v) => setConsultora(v === "all" ? "" : v)}>
              <SelectTrigger><SelectValue placeholder="Todas" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas</SelectItem>
                {consultoras.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="mb-1 block text-xs">Aceite do cliente</Label>
            <Select value={aceite} onValueChange={(v) => setAceite(v as any)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos</SelectItem>
                <SelectItem value="yes">Autorizado</SelectItem>
                <SelectItem value="no">Não autorizado</SelectItem>
                <SelectItem value="none">Sem aceite</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="mb-1 block text-xs">Data de</Label>
            <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
          </div>
          <div>
            <Label className="mb-1 block text-xs">Data até</Label>
            <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} />
          </div>
        </div>
        <div className="mt-3 flex items-center justify-between">
          <p className="text-xs text-muted-foreground">{filtered.length} resultado(s)</p>
          {hasFilters && (
            <Button size="sm" variant="ghost" onClick={clearFilters}><X className="mr-1 h-4 w-4" /> Limpar filtros</Button>
          )}
        </div>
      </Card>

      <div className="space-y-4">
        {filtered.length === 0 && <p className="text-sm text-muted-foreground">Nenhuma gravação encontrada.</p>}
        {pageItems.map((r) => (
          <Card key={r.id} className="p-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="font-semibold">{r.nome_completo}</p>
                <p className="text-xs text-muted-foreground">
                  {r.gravado_em ? new Date(r.gravado_em).toLocaleString("pt-BR") : "—"} · {dur(r.duracao_segundos)} · {r.consultant_email ?? "—"}
                </p>
              </div>
              {r.cliente_aceite === true ? (
                <Badge className="bg-emerald-600 text-white gap-1"><CheckCircle2 className="h-3 w-3" /> Autorizado</Badge>
              ) : r.cliente_aceite === false ? (
                <Badge variant="destructive" className="gap-1"><XCircle className="h-3 w-3" /> Não autorizado</Badge>
              ) : (
                <Badge variant="secondary">Sem aceite</Badge>
              )}
            </div>

            <div className="mt-3 grid gap-x-6 gap-y-1 text-sm sm:grid-cols-2">
              <Meta k="CPF" v={r.cpf} />
              <Meta k="Banco" v={r.banco} />
              <Meta k="Tipo da operação" v={r.tipo_operacao} />
              <Meta k="Valor solicitado" v={brl(r.valor_solicitado)} />
              <Meta k="Valor da parcela" v={brl(r.valor_parcela)} />
              <Meta k="ID do lead" v={r.lead_id} />
              <Meta k="Hash do arquivo" v={r.file_hash} />
              <Meta k="Aceite em" v={r.aceite_registrado_at ? new Date(r.aceite_registrado_at).toLocaleString("pt-BR") : "—"} />
            </div>

            <div className="mt-3 flex flex-wrap gap-2">
              {r.video_path && !urls[r.id] && (
                <Button size="sm" variant="outline" onClick={() => playUrl(r)}><Play className="mr-2 h-4 w-4" /> Ver gravação</Button>
              )}
              {r.video_path && (
                <Button size="sm" variant="outline" onClick={() => downloadFile(r.video_path, `gravacao_${r.id}.webm`)}><Video className="mr-2 h-4 w-4" /> Baixar vídeo</Button>
              )}
              {r.audio_path && (
                <Button size="sm" variant="outline" onClick={() => downloadFile(r.audio_path, `audio_${r.id}.webm`)}><AudioLines className="mr-2 h-4 w-4" /> Baixar áudio</Button>
              )}
              {(r.transcricao || r.resumo) && (
                <Button size="sm" variant="outline" onClick={() => downloadText(r)}><Download className="mr-2 h-4 w-4" /> Baixar texto</Button>
              )}
              <Button size="sm" onClick={() => generate(r.id)} disabled={aiBusy === r.id}>
                {aiBusy === r.id ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Sparkles className="mr-2 h-4 w-4" />}
                {r.transcricao ? "Regerar transcrição/resumo" : "Gerar transcrição/resumo (IA)"}
              </Button>
            </div>

            {urls[r.id] && <video src={urls[r.id]} controls className="mt-3 w-full max-w-2xl rounded-md bg-black" />}

            {r.resumo && (
              <div className="mt-3 rounded-md border bg-muted/30 p-3 text-sm">
                <p className="mb-1 flex items-center gap-1 font-medium"><FileText className="h-4 w-4" /> Resumo</p>
                <p className="whitespace-pre-wrap">{r.resumo}</p>
              </div>
            )}
            {r.transcricao && (
              <details className="mt-2 text-sm">
                <summary className="cursor-pointer font-medium">Transcrição completa</summary>
                <p className="mt-2 whitespace-pre-wrap text-muted-foreground">{r.transcricao}</p>
              </details>
            )}
          </Card>
        ))}
      </div>

      {totalPages > 1 && (
        <div className="mt-6 flex items-center justify-center gap-3">
          <Button size="sm" variant="outline" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
            <ChevronLeft className="h-4 w-4" /> Anterior
          </Button>
          <span className="text-sm text-muted-foreground">Página {page} de {totalPages}</span>
          <Button size="sm" variant="outline" disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)}>
            Próxima <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      )}
    </AppShell>
  );
}

function Meta({ k, v }: { k: string; v: string | null }) {
  return (
    <div className="flex justify-between gap-3 border-b border-dashed py-1">
      <span className="text-muted-foreground">{k}</span>
      <span className="break-all text-right font-medium">{v || "—"}</span>
    </div>
  );
}
