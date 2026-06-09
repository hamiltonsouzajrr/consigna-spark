// Admin-only "Gravações Jurídicas": list legal approval recordings with playback,
// full metadata, and AI transcription/summary generation.
import { createFileRoute, Navigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { useRhAccess } from "@/hooks/use-rh-access";
import { aiTranscribeApproval } from "@/lib/legal/legal.functions";
import { AppShell } from "@/components/AppShell";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { ShieldCheck, Loader2, Sparkles, Play, FileText, CheckCircle2, XCircle, Lock } from "lucide-react";

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

function Page() {
  const { user, loading } = useAuth();
  const { isAdmin, isLoading } = useRhAccess();
  const runAi = useServerFn(aiTranscribeApproval);
  const [items, setItems] = useState<Rec[]>([]);
  const [urls, setUrls] = useState<Record<string, string>>({});
  const [aiBusy, setAiBusy] = useState<string | null>(null);

  const load = useCallback(async () => {
    const { data } = await supabase.from("legal_approvals").select("*").eq("status", "concluido").order("gravado_em", { ascending: false });
    setItems((data ?? []) as any);
  }, []);
  useEffect(() => { if (user) load(); }, [user, load]);

  const playUrl = async (rec: Rec) => {
    if (!rec.video_path) return;
    const { data } = await supabase.storage.from("legal-recordings").createSignedUrl(rec.video_path, 3600);
    if (data?.signedUrl) setUrls((u) => ({ ...u, [rec.id]: data.signedUrl }));
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

      <div className="space-y-4">
        {items.length === 0 && <p className="text-sm text-muted-foreground">Nenhuma gravação concluída ainda.</p>}
        {items.map((r) => (
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
