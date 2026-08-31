import { useMemo, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import Papa from "papaparse";
import * as XLSX from "xlsx";
import { UploadCloud, MessageCircle, AlertTriangle, Loader2 } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ConfirmDialog } from "./ConfirmDialog";
import { adminCreateLeads, adminDistributeLeads } from "@/lib/prospeccao/prospeccao.functions";
import { buildParsed, detectPhoneColumn, previewSplit } from "@/lib/prospeccao/admin-import";

type Consultant = { id: string; email: string };

export function ImportTab({ consultants, selectedConsultants }: { consultants: Consultant[]; selectedConsultants: Set<string> }) {
  const qc = useQueryClient();
  const createLeads = useServerFn(adminCreateLeads);
  const distributeLeads = useServerFn(adminDistributeLeads);

  const [rawRecords, setRawRecords] = useState<Record<string, unknown>[]>([]);
  const [headers, setHeaders] = useState<string[]>([]);
  const [phoneCol, setPhoneCol] = useState("__auto__");
  const [fileName, setFileName] = useState("");
  const [uploadConsultant, setUploadConsultant] = useState("none");
  const [dedup, setDedup] = useState(true);
  const [updateExisting, setUpdateExisting] = useState(true);
  const [importDist, setImportDist] = useState("manual");
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);
  const [busy, setBusy] = useState(false);
  const [showRejected, setShowRejected] = useState(false);

  const { leads: parsed, meta, rejected } = useMemo(() => buildParsed(rawRecords, phoneCol), [rawRecords, phoneCol]);
  const split = previewSplit(parsed.length, selectedConsultants.size);

  const parseFile = async (file: File) => {
    setFileName(file.name);
    const apply = (records: Record<string, unknown>[]) => {
      const hdrs = records.length ? Object.keys(records[0]) : [];
      setHeaders(hdrs);
      setPhoneCol(detectPhoneColumn(hdrs) ?? "__auto__");
      setRawRecords(records);
      const { leads } = buildParsed(records, detectPhoneColumn(hdrs) ?? "__auto__");
      if (!leads.length) toast.error("Nenhuma linha com coluna NOME encontrada.");
      else toast.success(`${leads.length} lead(s) prontos para importar.`);
    };
    const ext = file.name.split(".").pop()?.toLowerCase();
    if (ext === "csv") Papa.parse<Record<string, unknown>>(file, { header: true, skipEmptyLines: true, complete: (res) => apply(res.data) });
    else if (ext === "xlsx" || ext === "xls") {
      const wb = XLSX.read(await file.arrayBuffer());
      apply(XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { defval: "" }));
    } else toast.error("Use CSV ou XLSX.");
  };

  const invalidateAll = () => {
    qc.invalidateQueries({ queryKey: ["prospect"] });
  };

  const confirmImport = async () => {
    if (!parsed.length || busy) return;
    const auto = importDist !== "manual";
    const cid = auto ? null : uploadConsultant === "none" ? null : uploadConsultant;
    if (auto && selectedConsultants.size === 0) {
      toast.error("Selecione ao menos uma consultora na aba Distribuição.");
      return;
    }
    setBusy(true);
    const chunkSize = 2000;
    const total = parsed.length;
    setProgress({ done: 0, total });
    let inserted = 0, skipped = 0, updated = 0;
    const batch = fileName ? `${fileName} · ${new Date().toLocaleString("pt-BR")}` : null;
    try {
      for (let i = 0; i < total; i += chunkSize) {
        const slice = parsed.slice(i, i + chunkSize);
        const r = await createLeads({ data: { leads: slice.map((p) => ({ ...p, consultant_id: cid })), dedup, update: updateExisting, batch } });
        inserted += r.inserted; skipped += r.skipped ?? 0; updated += r.updated ?? 0;
        setProgress({ done: Math.min(i + chunkSize, total), total });
      }
      let distMsg = "";
      if (auto && inserted > 0) {
        const d = await distributeLeads({ data: { consultantIds: [...selectedConsultants], mode: importDist as never } });
        distMsg = ` · ${d.assigned} distribuído(s) entre ${Object.keys(d.perConsultant).length} consultora(s)`;
      }
      toast.success(`Importação realizada com sucesso! ${inserted} novo(s)${updated ? ` · ${updated} atualizado(s)` : ""}${skipped ? ` · ${skipped} ignorado(s)` : ""}${distMsg}.`);
      setRawRecords([]); setHeaders([]); setPhoneCol("__auto__"); setFileName("");
      invalidateAll();
    } catch (e) {
      toast.error(e instanceof Error ? `Erro ao importar planilha: ${e.message}` : "Erro ao importar planilha de leads. Tente novamente.");
    } finally {
      setProgress(null);
      setBusy(false);
    }
  };

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <Card className="p-5">
        <p className="mb-3 text-sm font-semibold">Importar planilha</p>
        <label className="flex cursor-pointer flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed p-6 text-center hover:bg-accent/50">
          <UploadCloud className="h-8 w-8 text-muted-foreground" />
          <span className="text-sm">Selecionar CSV/XLSX (colunas: Nome, Telefone, Cidade, Origem, Orçamento, Urgência)</span>
          <Input type="file" accept=".csv,.xlsx,.xls" className="hidden" onChange={(e) => e.target.files?.[0] && parseFile(e.target.files[0])} />
          {fileName && <span className="text-xs text-primary">{fileName}</span>}
        </label>

        {parsed.length > 0 && (
          <div className="mt-3 space-y-3">
            <div>
              <Label className="text-xs">Distribuição</Label>
              <Select value={importDist} onValueChange={setImportDist}>
                <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="manual">Manual (um responsável)</SelectItem>
                  <SelectItem value="round_robin">Automática — round-robin</SelectItem>
                  <SelectItem value="score">Automática — por score</SelectItem>
                  <SelectItem value="city">Automática — por cidade</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="rounded-md border border-emerald-500/30 bg-emerald-500/5 p-3 space-y-2">
              <Label className="flex items-center gap-1.5 text-xs font-medium">
                <MessageCircle className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" />
                Coluna de origem do WhatsApp
              </Label>
              <Select value={phoneCol} onValueChange={setPhoneCol}>
                <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="__auto__">Automático (CEL/TELEFONE/WhatsApp)</SelectItem>
                  {headers.map((h) => <SelectItem key={h} value={h}>{h}</SelectItem>)}
                </SelectContent>
              </Select>
              <div className="flex flex-wrap gap-2 text-xs">
                <span className="rounded-full border border-emerald-500/40 bg-emerald-500/15 px-2 py-0.5 text-emerald-700 dark:text-emerald-300">{meta.comWhats} com WhatsApp válido</span>
                {meta.invalidos > 0 && <span className="rounded-full border border-amber-500/40 bg-amber-500/15 px-2 py-0.5 text-amber-700 dark:text-amber-300">{meta.invalidos} inválido(s)</span>}
                {meta.semTelefone > 0 && <span className="rounded-full border border-border bg-muted px-2 py-0.5 text-muted-foreground">{meta.semTelefone} sem telefone</span>}
                {meta.duplicados > 0 && <span className="rounded-full border border-border bg-muted px-2 py-0.5 text-muted-foreground">{meta.duplicados} duplicado(s) na planilha</span>}
              </div>
              {meta.comWhats === 0 && meta.total > 0 && (
                <p className="text-xs text-amber-600 dark:text-amber-400">Nenhum número válido detectado nesta coluna — selecione a coluna correta acima.</p>
              )}
            </div>

            {importDist === "manual" ? (
              <div>
                <Label className="text-xs">Atribuir a</Label>
                <Select value={uploadConsultant} onValueChange={setUploadConsultant}>
                  <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Não atribuir agora</SelectItem>
                    {consultants.map((c) => <SelectItem key={c.id} value={c.id}>{c.email}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            ) : (
              <p className="rounded-md bg-muted/60 px-3 py-2 text-xs text-muted-foreground">
                Prévia: <strong>{parsed.length}</strong> lead(s) → <strong>{selectedConsultants.size}</strong> consultora(s) ·
                ~<strong>{split.each}</strong> cada{split.rest ? ` (+1 para ${split.rest})` : ""}. Cada lead vai para apenas uma pessoa.
              </p>
            )}

            <div className="flex items-center gap-2">
              <input id="dedup" type="checkbox" checked={dedup} onChange={(e) => setDedup(e.target.checked)} className="h-4 w-4 accent-primary" disabled={busy} />
              <Label htmlFor="dedup" className="cursor-pointer text-xs">Ignorar duplicados já existentes na base (CPF/telefone)</Label>
            </div>
            <div className="flex items-center gap-2">
              <input id="updateExisting" type="checkbox" checked={updateExisting} onChange={(e) => setUpdateExisting(e.target.checked)} className="h-4 w-4 accent-primary" disabled={busy} />
              <Label htmlFor="updateExisting" className="cursor-pointer text-xs">Atualizar leads existentes (preenche campos vazios)</Label>
            </div>

            {progress && (
              <div className="space-y-1">
                <Progress value={Math.round((progress.done / progress.total) * 100)} />
                <p className="text-xs text-muted-foreground">Importando {progress.done} de {progress.total}…</p>
              </div>
            )}

            <ConfirmDialog
              title={`Importar ${parsed.length} lead(s)?`}
              description={
                <>
                  {meta.comWhats} com WhatsApp válido, {meta.invalidos} inválido(s), {meta.semTelefone} sem telefone.
                  {importDist === "manual"
                    ? uploadConsultant === "none" ? " Os leads ficarão sem responsável." : " Todos irão para a consultora selecionada."
                    : ` Serão divididos entre ${selectedConsultants.size} consultora(s), ~${split.each} cada.`}
                </>
              }
              confirmLabel={busy ? "Importando leads..." : "Importar planilha de leads"}
              onConfirm={confirmImport}
            >
              <Button className="w-full font-medium" disabled={busy}>
                {busy ? (
                  <span className="flex items-center gap-2">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Importando leads...
                  </span>
                ) : (
                  "Importar planilha de leads"
                )}
              </Button>
            </ConfirmDialog>
          </div>
        )}
      </Card>

      <Card className="p-5">
        <div className="mb-3 flex items-center justify-between">
          <p className="flex items-center gap-2 text-sm font-semibold"><AlertTriangle className="h-4 w-4 text-amber-500" /> Linhas com alerta ({rejected.length})</p>
          {rejected.length > 0 && (
            <Button variant="ghost" size="sm" onClick={() => setShowRejected((v) => !v)}>{showRejected ? "Ocultar" : "Ver detalhes"}</Button>
          )}
        </div>
        {rejected.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nenhum problema detectado na planilha carregada.</p>
        ) : !showRejected ? (
          <p className="text-sm text-muted-foreground">{rejected.length} linha(s) com nome vazio, telefone inválido ou duplicidade. Duplicados são descartados; os demais são importados como estão.</p>
        ) : (
          <div className="max-h-[420px] overflow-auto">
            <Table>
              <TableHeader><TableRow><TableHead>Linha</TableHead><TableHead>Nome</TableHead><TableHead>Telefone</TableHead><TableHead>Motivo</TableHead></TableRow></TableHeader>
              <TableBody>
                {rejected.slice(0, 200).map((r, i) => (
                  <TableRow key={`${r.line}-${i}`}>
                    <TableCell className="text-xs text-muted-foreground">{r.line}</TableCell>
                    <TableCell className="max-w-[180px] truncate">{r.nome || "—"}</TableCell>
                    <TableCell className="font-mono text-xs">{r.telefone || "—"}</TableCell>
                    <TableCell className="text-xs text-amber-600 dark:text-amber-400">{r.reason}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            {rejected.length > 200 && <p className="p-2 text-xs text-muted-foreground">Mostrando as 200 primeiras de {rejected.length}.</p>}
          </div>
        )}
      </Card>
    </div>
  );
}
