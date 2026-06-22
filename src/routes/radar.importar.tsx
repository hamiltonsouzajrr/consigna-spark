import { createFileRoute } from "@tanstack/react-router";
import { useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Upload, Loader2, Trash2, Save, FileText } from "lucide-react";
import { extractFile } from "@/lib/radar/extract";
import {
  analisarDiarioAI,
  criarArquivo,
  salvarRegistros,
  SECOES_RADAR,
  type RegistroAI,
} from "@/lib/radar/radar.functions";

export const Route = createFileRoute("/radar/importar")({
  component: ImportarPage,
});

type Batch = {
  arquivoId: string;
  nome: string;
  orgao: string;
  data_publicacao: string;
  edicao: string;
  registros: RegistroAI[];
};

function ImportarPage() {
  const { user } = useAuth();
  const aiFn = useServerFn(analisarDiarioAI);
  const criarFn = useServerFn(criarArquivo);
  const salvarFn = useServerFn(salvarRegistros);

  const [busy, setBusy] = useState(false);
  const [batches, setBatches] = useState<Batch[]>([]);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [secoes, setSecoes] = useState<Set<string>>(new Set(SECOES_RADAR));
  const fileRef = useRef<HTMLInputElement>(null);

  const onPick = async (files: FileList | null) => {
    if (!files || files.length === 0 || !user) return;
    setBusy(true);
    const toastId = toast.loading("Processando arquivos…");
    try {
      for (const file of Array.from(files)) {
        toast.loading(`Lendo ${file.name}…`, { id: toastId });
        const res = await extractFile(file, (m) => toast.loading(m, { id: toastId }));
        if (!res.text) {
          toast.warning(`Nenhum texto reconhecido em ${file.name}.`, { id: toastId });
          continue;
        }

        // Upload original to storage (best-effort).
        let caminho = "";
        try {
          const path = `${user.id}/${Date.now()}-${file.name.replace(/[^\w.\-]+/g, "_")}`;
          const { error: upErr } = await supabase.storage
            .from("diario-oficial")
            .upload(path, file, { upsert: false });
          if (!upErr) caminho = path;
        } catch (e) {
          console.warn("[radar] upload falhou", e);
        }

        const { id: arquivoId } = await criarFn({
          data: {
            nome_arquivo: file.name,
            tipo_arquivo: res.tipo,
            data_publicacao: res.data_publicacao || undefined,
            numero_edicao: res.numero_edicao || undefined,
            orgao_detectado: res.orgao || undefined,
            caminho_arquivo: caminho || undefined,
            texto_extraido: res.text.slice(0, 1_900_000),
          },
        });

        toast.loading(`Analisando ${file.name} com IA…`, { id: toastId });
        const { registros } = await aiFn({
          data: { text: res.text, data_publicacao: res.data_publicacao, orgao: res.orgao },
        });

        setBatches((b) => [
          ...b,
          {
            arquivoId,
            nome: file.name,
            orgao: res.orgao,
            data_publicacao: res.data_publicacao,
            edicao: res.numero_edicao,
            registros,
          },
        ]);
      }
      toast.success("Arquivos processados. Revise os registros antes de salvar.", { id: toastId });
    } catch (e: any) {
      toast.error(e?.message ?? "Erro ao processar.", { id: toastId });
    } finally {
      setBusy(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  const updateReg = (bi: number, ri: number, field: keyof RegistroAI, value: string) => {
    setBatches((b) =>
      b.map((batch, i) =>
        i === bi
          ? { ...batch, registros: batch.registros.map((r, j) => (j === ri ? { ...r, [field]: value } : r)) }
          : batch,
      ),
    );
  };
  const removeReg = (bi: number, ri: number) => {
    setBatches((b) =>
      b.map((batch, i) =>
        i === bi ? { ...batch, registros: batch.registros.filter((_, j) => j !== ri) } : batch,
      ),
    );
  };

  const saveBatch = async (bi: number) => {
    const batch = batches[bi];
    if (!batch || batch.registros.length === 0) {
      toast.warning("Nenhum registro para salvar.");
      return;
    }
    setSavingId(batch.arquivoId);
    try {
      const { inserted, duplicados } = await salvarFn({
        data: { arquivo_id: batch.arquivoId, registros: batch.registros },
      });
      toast.success(
        `${inserted} registro(s) salvo(s).${duplicados > 0 ? ` ${duplicados} possível(is) duplicado(s) marcado(s).` : ""}`,
      );
      setBatches((b) => b.filter((_, i) => i !== bi));
    } catch (e: any) {
      toast.error(e?.message ?? "Erro ao salvar.");
    } finally {
      setSavingId(null);
    }
  };

  return (
    <div className="space-y-5">
      <Card className="p-5">
        <h2 className="mb-1 text-lg font-semibold">Importar Diário Oficial</h2>
        <p className="mb-4 text-sm text-muted-foreground">
          Envie um ou mais arquivos (PDF, TXT, HTML ou DOCX). O sistema extrai o texto e usa IA para
          identificar servidores promovidos. PDFs escaneados usam OCR e podem demorar.
        </p>
        <input
          ref={fileRef}
          type="file"
          accept=".pdf,.txt,.html,.htm,.docx"
          multiple
          className="hidden"
          onChange={(e) => onPick(e.target.files)}
        />
        <Button onClick={() => fileRef.current?.click()} disabled={busy}>
          {busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Upload className="mr-2 h-4 w-4" />}
          {busy ? "Processando…" : "Selecionar arquivos"}
        </Button>
      </Card>

      {batches.map((batch, bi) => (
        <Card key={batch.arquivoId} className="p-5">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <FileText className="h-4 w-4 text-primary" />
              <span className="font-medium">{batch.nome}</span>
              <Badge variant="secondary">{batch.registros.length} registro(s)</Badge>
              {batch.orgao && <Badge variant="outline">{batch.orgao}</Badge>}
              {batch.data_publicacao && <Badge variant="outline">{batch.data_publicacao}</Badge>}
            </div>
            <Button size="sm" onClick={() => saveBatch(bi)} disabled={savingId === batch.arquivoId}>
              {savingId === batch.arquivoId ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Save className="mr-2 h-4 w-4" />
              )}
              Salvar revisão
            </Button>
          </div>

          {batch.registros.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nenhuma movimentação identificada neste arquivo.</p>
          ) : (
            <div className="space-y-3">
              {batch.registros.map((r, ri) => (
                <div key={ri} className="rounded-lg border p-3">
                  <div className="grid gap-2 md:grid-cols-2 lg:grid-cols-3">
                    <Field label="Nome" value={r.nome_servidor} onChange={(v) => updateReg(bi, ri, "nome_servidor", v)} />
                    <Field label="Matrícula" value={r.matricula} onChange={(v) => updateReg(bi, ri, "matricula", v)} />
                    <Field label="Cargo" value={r.cargo} onChange={(v) => updateReg(bi, ri, "cargo", v)} />
                    <Field label="Órgão" value={r.orgao} onChange={(v) => updateReg(bi, ri, "orgao", v)} />
                    <Field label="Tipo" value={r.tipo_movimentacao} onChange={(v) => updateReg(bi, ri, "tipo_movimentacao", v)} />
                    <Field label="Categoria" value={r.categoria} onChange={(v) => updateReg(bi, ri, "categoria", v)} />
                  </div>
                  <div className="mt-2 flex items-center justify-between gap-3">
                    <p className="line-clamp-2 flex-1 text-xs italic text-muted-foreground">
                      {r.trecho_original || "Sem trecho original."}
                    </p>
                    <div className="flex items-center gap-2">
                      <Badge variant="outline" className="text-[10px] uppercase">
                        Confiança: {r.confianca_ia || "—"}
                      </Badge>
                      <Button size="icon" variant="ghost" onClick={() => removeReg(bi, ri)}>
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>
      ))}
    </div>
  );
}

function Field({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <label className="block">
      <span className="mb-1 block text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
        {label}
      </span>
      <Input value={value} onChange={(e) => onChange(e.target.value)} className="h-9" />
    </label>
  );
}
