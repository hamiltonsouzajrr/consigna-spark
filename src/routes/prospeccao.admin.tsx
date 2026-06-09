import { createFileRoute, Navigate, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/lib/auth";
import { useRhAccess } from "@/hooks/use-rh-access";
import { supabase } from "@/integrations/supabase/client";
import { AppShell } from "@/components/AppShell";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { RhStatCard } from "@/components/rh/RhStatCard";
import { toast } from "sonner";
import Papa from "papaparse";
import * as XLSX from "xlsx";
import { ArrowLeft, UploadCloud, Trophy, AlertTriangle, Ghost, UserPlus, Shuffle, RefreshCw, MessageCircle, Trash2, FileSpreadsheet, ShieldCheck, ShieldOff, UserX } from "lucide-react";
import {
  getProspectConsultants, adminCreateLeads, adminAssignLeads, getAdminStats,
  adminDistributeLeads, adminRecycleLeads, adminListImportBatches, adminDeleteImportBatch,
  adminListSystemUsers, adminSetUserRole, adminDeleteSystemUser,
} from "@/lib/prospeccao/prospeccao.functions";
import { STATUS_LABEL, STATUS_TONE, normalizeWhatsappNumber, type LeadStatus } from "@/lib/prospeccao/constants";

export const Route = createFileRoute("/prospeccao/admin")({
  head: () => ({ meta: [{ title: "Painel admin — Prospecção" }, { name: "robots", content: "noindex,nofollow" }] }),
  component: Page,
});

type LeadRow = { id: string; nome: string; cidade: string | null; origem: string | null; status: LeadStatus; score: number; consultant_id: string | null; created_at: string };
type ParsedLead = { nome: string; telefone?: string; cpf?: string; cidade?: string; origem?: string; orcamento?: number; urgencia?: "alta" | "media" | "baixa" };
type ImportMeta = { total: number; comWhats: number; invalidos: number; semTelefone: number; phoneCol: string | null };

const PHONE_ALIASES = ["telefone", "celular", "whatsapp", "cel1", "cel2", "cel", "fone", "contato", "numero", "número"];

// Auto-detect the column that holds a phone/WhatsApp number from the spreadsheet headers.
function detectPhoneColumn(headers: string[]): string | null {
  const lower = headers.map((h) => ({ raw: h, low: h.toLowerCase().trim() }));
  for (const a of PHONE_ALIASES) {
    const hit = lower.find((h) => h.low === a);
    if (hit) return hit.raw;
  }
  const fuzzy = lower.find((h) => h.low.includes("cel") || h.low.includes("tel") || h.low.includes("whats") || h.low.includes("fone"));
  return fuzzy?.raw ?? null;
}

// Build the parsed lead list + WhatsApp validation summary from raw rows.
function buildParsed(records: Record<string, unknown>[], phoneCol: string): { leads: ParsedLead[]; meta: ImportMeta } {
  const out: ParsedLead[] = [];
  let comWhats = 0, invalidos = 0, semTelefone = 0;
  for (const r of records) {
    const keys = Object.keys(r).reduce<Record<string, string>>((a, k) => { a[k.toLowerCase().trim()] = k; return a; }, {});
    const get = (n: string) => (keys[n] ? String(r[keys[n]] ?? "").trim() : "");
    const nome = get("nome");
    if (!nome) continue;
    const orc = get("orcamento") || get("orçamento") || get("margem") || get("renda");
    const urg = (get("urgencia") || get("urgência")).toLowerCase();

    let telRaw = "";
    if (phoneCol && phoneCol !== "__auto__") {
      telRaw = r[phoneCol] != null ? String(r[phoneCol]).trim() : "";
    } else {
      telRaw = get("telefone") || get("celular") || get("whatsapp") || get("cel1") || get("cel2") || get("cel") || get("fone") || get("contato") || get("numero") || get("número");
    }
    if (!telRaw) semTelefone++;
    else if (normalizeWhatsappNumber(telRaw)) comWhats++;
    else invalidos++;

    out.push({
      nome,
      telefone: telRaw || undefined,
      cpf: get("cpf") || undefined,
      cidade: get("cidade") || undefined,
      origem: get("origem") || "planilha",
      orcamento: orc ? Number(orc.replace(/[^\d.,-]/g, "").replace(/\./g, "").replace(",", ".")) || undefined : undefined,
      urgencia: urg === "alta" || urg === "media" || urg === "média" || urg === "baixa" ? (urg === "média" ? "media" : (urg as any)) : undefined,
    });
  }
  return { leads: out, meta: { total: out.length, comWhats, invalidos, semTelefone, phoneCol: phoneCol === "__auto__" ? null : phoneCol } };
}


function Page() {
  const { user, loading } = useAuth();
  const { isAdmin, isLoading: accessLoading } = useRhAccess();

  const fetchConsultants = useServerFn(getProspectConsultants);
  const createLeads = useServerFn(adminCreateLeads);
  const assignLeads = useServerFn(adminAssignLeads);
  const distributeLeads = useServerFn(adminDistributeLeads);
  const recycleLeads = useServerFn(adminRecycleLeads);
  const fetchStats = useServerFn(getAdminStats);
  const listBatches = useServerFn(adminListImportBatches);
  const deleteBatch = useServerFn(adminDeleteImportBatch);

  const [leads, setLeads] = useState<LeadRow[]>([]);
  const [rawRecords, setRawRecords] = useState<Record<string, unknown>[]>([]);
  const [headers, setHeaders] = useState<string[]>([]);
  const [phoneCol, setPhoneCol] = useState<string>("__auto__");
  const [fileName, setFileName] = useState("");
  const [uploadConsultant, setUploadConsultant] = useState<string>("none");
  const [dedup, setDedup] = useState(true);
  const [updateExisting, setUpdateExisting] = useState(true);
  const [importDist, setImportDist] = useState<string>("manual");
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);
  const [busy, setBusy] = useState(false);

  // distribution / recycle
  const [selectedConsultants, setSelectedConsultants] = useState<Set<string>>(new Set());
  const [distMode, setDistMode] = useState<"round_robin" | "score" | "city">("round_robin");
  const [recycleMode, setRecycleMode] = useState<"round_robin" | "score">("score");
  const [idleDays, setIdleDays] = useState(3);

  // manual lead
  const [m, setM] = useState({ nome: "", telefone: "", cidade: "", origem: "indicacao", orcamento: "", urgencia: "alta", consultant_id: "none" });

  const consultantsQ = useQuery({ queryKey: ["prospect", "consultants"], queryFn: () => fetchConsultants(), enabled: !!user && isAdmin });
  const statsQ = useQuery({ queryKey: ["prospect", "admin-stats"], queryFn: () => fetchStats(), enabled: !!user && isAdmin });
  const batchesQ = useQuery({ queryKey: ["prospect", "import-batches"], queryFn: () => listBatches(), enabled: !!user && isAdmin });
  const consultants = consultantsQ.data ?? [];
  const emailById = useMemo(() => new Map(consultants.map((c) => [c.id, c.email])), [consultants]);

  const { leads: parsed, meta: importMeta } = useMemo(() => buildParsed(rawRecords, phoneCol), [rawRecords, phoneCol]);

  // Default: all consultants selected for distribution/recycle once loaded.
  useEffect(() => {
    if (consultants.length && selectedConsultants.size === 0) {
      setSelectedConsultants(new Set(consultants.map((c) => c.id)));
    }
  }, [consultants]);
  const toggleConsultant = (id: string) =>
    setSelectedConsultants((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });

  const loadLeads = async () => {
    const { data } = await supabase.from("prospect_leads").select("id,nome,cidade,origem,status,score,consultant_id,created_at").order("created_at", { ascending: false }).limit(1000);
    setLeads((data ?? []) as any);
  };
  useEffect(() => { if (user && isAdmin) loadLeads(); }, [user, isAdmin]);

  if (loading || accessLoading) return null;
  if (!user) return <Navigate to="/login" />;
  if (!isAdmin) return <Navigate to="/prospeccao" />;

  const parseFile = async (file: File) => {
    setFileName(file.name);
    const apply = (records: Record<string, unknown>[]) => {
      const hdrs = records.length ? Object.keys(records[0]) : [];
      setHeaders(hdrs);
      setPhoneCol(detectPhoneColumn(hdrs) ?? "__auto__");
      setRawRecords(records);
      const named = records.filter((r) => {
        const k = Object.keys(r).find((x) => x.toLowerCase().trim() === "nome");
        return k && String(r[k] ?? "").trim();
      });
      if (!named.length) toast.error("Nenhuma linha com coluna NOME encontrada.");
      else toast.success(`${named.length} lead(s) prontos para importar.`);
    };
    const ext = file.name.split(".").pop()?.toLowerCase();
    if (ext === "csv") Papa.parse<Record<string, unknown>>(file, { header: true, skipEmptyLines: true, complete: (res) => apply(res.data) });
    else if (ext === "xlsx" || ext === "xls") { const wb = XLSX.read(await file.arrayBuffer()); apply(XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { defval: "" })); }
    else toast.error("Use CSV ou XLSX.");
  };


  const confirmImport = async () => {
    if (!parsed.length) return;
    const auto = importDist !== "manual";
    // When auto-distributing, import unassigned and balance afterwards.
    const cid = auto ? null : (uploadConsultant === "none" ? null : uploadConsultant);
    if (auto && selectedConsultants.size === 0) { toast.error("Selecione ao menos uma consultora para distribuição."); return; }
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
        const d = await distributeLeads({ data: { consultantIds: [...selectedConsultants], mode: importDist as any } });
        distMsg = ` · ${d.assigned} distribuído(s) entre ${Object.keys(d.perConsultant).length} consultora(s)`;
      }
      toast.success(`${inserted} novo(s)${updated ? ` · ${updated} atualizado(s)` : ""}${skipped ? ` · ${skipped} ignorado(s)` : ""}${distMsg}.`);
      setRawRecords([]); setHeaders([]); setPhoneCol("__auto__"); setFileName("");
      await loadLeads(); statsQ.refetch(); batchesQ.refetch();
    } catch (e: any) { toast.error(e?.message ?? "Falha ao importar."); }
    setProgress(null);
    setBusy(false);
  };

  const runDistribute = async () => {
    if (selectedConsultants.size === 0) { toast.error("Selecione ao menos uma consultora."); return; }
    setBusy(true);
    try {
      const d = await distributeLeads({ data: { consultantIds: [...selectedConsultants], mode: distMode } });
      if (d.assigned === 0) toast.info("Nenhum lead não atribuído para distribuir.");
      else toast.success(`${d.assigned} lead(s) distribuído(s) entre ${Object.keys(d.perConsultant).length} consultora(s).`);
      await loadLeads(); statsQ.refetch();
    } catch (e: any) { toast.error(e?.message ?? "Falha ao distribuir."); }
    setBusy(false);
  };

  const runRecycle = async () => {
    if (selectedConsultants.size === 0) { toast.error("Selecione ao menos uma consultora."); return; }
    setBusy(true);
    try {
      const d = await recycleLeads({ data: { consultantIds: [...selectedConsultants], idleDays, mode: recycleMode } });
      if (d.recycled === 0) toast.info(`Nenhum lead parado há ${idleDays}+ dia(s) para reciclar.`);
      else toast.success(`${d.recycled} lead(s) reciclado(s) para ${Object.keys(d.perConsultant).length} consultora(s).`);
      await loadLeads(); statsQ.refetch();
    } catch (e: any) { toast.error(e?.message ?? "Falha ao reciclar."); }
    setBusy(false);
  };

  const createManual = async () => {
    if (!m.nome.trim()) { toast.error("Informe o nome."); return; }
    setBusy(true);
    try {
      await createLeads({ data: { leads: [{
        nome: m.nome.trim(), telefone: m.telefone || null, cidade: m.cidade || null,
        origem: m.origem, orcamento: m.orcamento ? Number(m.orcamento) : null,
        urgencia: m.urgencia as any, consultant_id: m.consultant_id === "none" ? null : m.consultant_id,
      }] } });
      toast.success("Lead criado.");
      setM({ nome: "", telefone: "", cidade: "", origem: "indicacao", orcamento: "", urgencia: "alta", consultant_id: "none" });
      await loadLeads(); statsQ.refetch();
    } catch (e: any) { toast.error(e?.message ?? "Falha ao criar lead."); }
    setBusy(false);
  };

  const reassign = async (leadId: string, consultantId: string) => {
    try {
      await assignLeads({ data: { leadIds: [leadId], consultantId: consultantId === "none" ? null : consultantId } });
      await loadLeads(); statsQ.refetch();
      toast.success("Lead atribuído.");
    } catch (e: any) { toast.error(e?.message ?? "Falha ao atribuir."); }
  };

  const removeBatch = async (batch: string | null, label: string, total: number) => {
    if (!confirm(`Excluir a importação "${label}" e seus ${total} lead(s)? Esta ação não pode ser desfeita.`)) return;
    setBusy(true);
    try {
      const r = await deleteBatch({ data: { batch } });
      toast.success(`${r.deleted} lead(s) excluído(s).`);
      await loadLeads(); statsQ.refetch(); batchesQ.refetch();
    } catch (e: any) { toast.error(e?.message ?? "Falha ao excluir importação."); }
    setBusy(false);
  };

  const stats = statsQ.data;

  return (
    <AppShell>
      <Button asChild variant="ghost" size="sm" className="mb-4"><Link to="/prospeccao"><ArrowLeft className="mr-2 h-4 w-4" /> Voltar à fila</Link></Button>
      <h1 className="mb-1 text-2xl font-bold">Painel admin — Prospecção</h1>
      <p className="mb-6 text-sm text-muted-foreground">Importe planilhas, distribua leads e acompanhe os gargalos.</p>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <RhStatCard label="Total de leads" value={stats?.totalLeads ?? "—"} icon={Trophy} tone="sky" />
        <RhStatCard label="Sem tratativa" value={stats?.semTratativa ?? "—"} icon={AlertTriangle} tone="amber" />
        <RhStatCard label="Esquecidos (3+ dias)" value={stats?.esquecidos ?? "—"} icon={Ghost} tone="rose" />
        <RhStatCard label="Consultoras ativas" value={stats?.ranking.filter((r) => r.consultantId).length ?? "—"} icon={UserPlus} tone="violet" />
      </div>

      <Card className="mt-6 p-5">
        <div className="mb-3 flex items-center justify-between">
          <p className="flex items-center gap-2 text-sm font-semibold"><FileSpreadsheet className="h-4 w-4 text-primary" /> Planilhas importadas</p>
          <Button variant="ghost" size="sm" onClick={() => batchesQ.refetch()} disabled={batchesQ.isFetching}>
            <RefreshCw className={`mr-2 h-4 w-4 ${batchesQ.isFetching ? "animate-spin" : ""}`} /> Atualizar
          </Button>
        </div>
        {batchesQ.isLoading ? (
          <p className="text-sm text-muted-foreground">Carregando importações…</p>
        ) : (batchesQ.data?.length ?? 0) === 0 ? (
          <p className="text-sm text-muted-foreground">Nenhuma importação registrada.</p>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Importação</TableHead>
                  <TableHead className="text-right">Leads</TableHead>
                  <TableHead className="text-right">Atribuídos</TableHead>
                  <TableHead className="text-right">Trabalhados</TableHead>
                  <TableHead>Data</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {batchesQ.data!.map((b) => (
                  <TableRow key={b.batch ?? "__none__"}>
                    <TableCell className="max-w-[280px] truncate font-medium">{b.label}</TableCell>
                    <TableCell className="text-right">{b.total}</TableCell>
                    <TableCell className="text-right">{b.assigned}</TableCell>
                    <TableCell className="text-right">{b.worked}</TableCell>
                    <TableCell className="text-xs text-muted-foreground">{new Date(b.last_at).toLocaleDateString("pt-BR")}</TableCell>
                    <TableCell className="text-right">
                      <Button variant="ghost" size="sm" className="text-destructive hover:text-destructive" disabled={busy} onClick={() => removeBatch(b.batch, b.label, b.total)}>
                        <Trash2 className="mr-1 h-4 w-4" /> Excluir
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </Card>



      <div className="mt-6 grid gap-4 lg:grid-cols-2">
        {/* Upload */}
        <Card className="p-5">
          <p className="mb-3 text-sm font-semibold">Importar planilha</p>
          <label className="flex cursor-pointer flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed p-6 text-center hover:bg-accent/50">
            <UploadCloud className="h-8 w-8 text-muted-foreground" />
            <span className="text-sm">Selecionar CSV/XLSX (colunas: Nome, Telefone, Cidade, Origem, Orçamento, Urgência)</span>
            <Input type="file" accept=".csv,.xlsx,.xls" className="hidden" onChange={(e) => e.target.files?.[0] && parseFile(e.target.files[0])} />
            {fileName && <span className="text-xs text-primary">{fileName}</span>}
          </label>
          {parsed.length > 0 && (
            <div className="mt-3 space-y-2">
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

              {/* WhatsApp source column + validation */}
              <div className="rounded-md border border-emerald-500/30 bg-emerald-500/5 p-3 space-y-2">
                <Label className="text-xs flex items-center gap-1.5 font-medium">
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
                  <span className="rounded-full border border-emerald-500/40 bg-emerald-500/15 px-2 py-0.5 text-emerald-700 dark:text-emerald-300">
                    {importMeta.comWhats} com WhatsApp válido
                  </span>
                  {importMeta.invalidos > 0 && (
                    <span className="rounded-full border border-amber-500/40 bg-amber-500/15 px-2 py-0.5 text-amber-700 dark:text-amber-300">
                      {importMeta.invalidos} número(s) inválido(s)
                    </span>
                  )}
                  {importMeta.semTelefone > 0 && (
                    <span className="rounded-full border border-border bg-muted px-2 py-0.5 text-muted-foreground">
                      {importMeta.semTelefone} sem telefone
                    </span>
                  )}
                </div>
                {importMeta.comWhats === 0 && importMeta.total > 0 && (
                  <p className="text-xs text-amber-600 dark:text-amber-400">
                    Nenhum número válido detectado nesta coluna — selecione a coluna correta acima.
                  </p>
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
                  Será dividido entre as <strong>{selectedConsultants.size}</strong> consultora(s) marcadas no card "Distribuir &amp; reciclar". Cada lead vai para apenas uma pessoa.
                </p>
              )}
              <div className="flex items-center gap-2">
                <input id="dedup" type="checkbox" checked={dedup} onChange={(e) => setDedup(e.target.checked)} className="h-4 w-4 accent-primary" />
                <Label htmlFor="dedup" className="text-xs cursor-pointer">Ignorar duplicados (por CPF/telefone)</Label>
              </div>
              <div className="flex items-center gap-2">
                <input id="updateExisting" type="checkbox" checked={updateExisting} onChange={(e) => setUpdateExisting(e.target.checked)} className="h-4 w-4 accent-primary" />
                <Label htmlFor="updateExisting" className="text-xs cursor-pointer">Atualizar leads existentes (preenche telefone/cidade/orçamento vazios)</Label>
              </div>
              {progress && (
                <div className="space-y-1">
                  <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
                    <div className="h-full bg-primary transition-all" style={{ width: `${Math.round((progress.done / progress.total) * 100)}%` }} />
                  </div>
                  <p className="text-xs text-muted-foreground">Importando {progress.done} de {progress.total}…</p>
                </div>
              )}
              <Button className="w-full" disabled={busy} onClick={confirmImport}>
                {busy ? "Importando…" : `Importar ${parsed.length} lead(s)`}
              </Button>
            </div>
          )}
        </Card>


        {/* Manual */}
        <Card className="p-5">
          <p className="mb-3 text-sm font-semibold">Novo lead (manual)</p>
          <div className="grid grid-cols-2 gap-2">
            <Input placeholder="Nome" value={m.nome} onChange={(e) => setM({ ...m, nome: e.target.value })} className="col-span-2" />
            <Input placeholder="Telefone" value={m.telefone} onChange={(e) => setM({ ...m, telefone: e.target.value })} />
            <Input placeholder="Cidade" value={m.cidade} onChange={(e) => setM({ ...m, cidade: e.target.value })} />
            <Input placeholder="Orçamento" type="number" value={m.orcamento} onChange={(e) => setM({ ...m, orcamento: e.target.value })} />
            <Select value={m.origem} onValueChange={(v) => setM({ ...m, origem: v })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {["indicacao", "whatsapp", "site", "evento", "planilha"].map((o) => <SelectItem key={o} value={o}>{o}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={m.urgencia} onValueChange={(v) => setM({ ...m, urgencia: v })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>{["alta", "media", "baixa"].map((u) => <SelectItem key={u} value={u}>{u}</SelectItem>)}</SelectContent>
            </Select>
            <Select value={m.consultant_id} onValueChange={(v) => setM({ ...m, consultant_id: v })}>
              <SelectTrigger className="col-span-2"><SelectValue placeholder="Consultora" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Não atribuir</SelectItem>
                {consultants.map((c) => <SelectItem key={c.id} value={c.id}>{c.email}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <Button className="mt-3 w-full" disabled={busy} onClick={createManual}>Criar lead</Button>
        </Card>
      </div>

      {/* Distribuir & reciclar */}
      <Card className="mt-6 p-5">
        <p className="mb-1 text-sm font-semibold flex items-center gap-2"><Shuffle className="h-4 w-4" /> Distribuir &amp; reciclar leads</p>
        <p className="mb-4 text-xs text-muted-foreground">Cada lead vai para apenas uma consultora. Marque quem deve participar do rodízio.</p>

        <Label className="text-xs">Consultoras participantes</Label>
        <div className="mt-2 flex flex-wrap gap-2">
          {consultants.map((c) => {
            const on = selectedConsultants.has(c.id);
            return (
              <button
                key={c.id}
                type="button"
                onClick={() => toggleConsultant(c.id)}
                className={`rounded-full border px-3 py-1 text-xs transition-colors ${on ? "border-primary bg-primary/10 text-primary" : "border-border text-muted-foreground hover:bg-accent/50"}`}
              >
                {c.email}
              </button>
            );
          })}
          {!consultants.length && <span className="text-xs text-muted-foreground">Nenhuma consultora encontrada.</span>}
        </div>

        <div className="mt-5 grid gap-4 md:grid-cols-2">
          {/* Distribuir não atribuídos */}
          <div className="rounded-lg border p-4">
            <p className="mb-2 text-sm font-medium">Distribuir leads não atribuídos</p>
            <Label className="text-xs">Critério</Label>
            <Select value={distMode} onValueChange={(v) => setDistMode(v as any)}>
              <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="round_robin">Round-robin (rodízio igual)</SelectItem>
                <SelectItem value="score">Por score (espalha os quentes)</SelectItem>
                <SelectItem value="city">Por cidade (mesma cidade, mesma pessoa)</SelectItem>
              </SelectContent>
            </Select>
            <Button className="mt-3 w-full" variant="secondary" disabled={busy} onClick={runDistribute}>
              <Shuffle className="mr-2 h-4 w-4" /> Distribuir agora
            </Button>
          </div>

          {/* Reciclar parados */}
          <div className="rounded-lg border p-4">
            <p className="mb-2 text-sm font-medium">Reciclar leads parados</p>
            <p className="mb-2 text-xs text-muted-foreground">Tira leads sem tratativa de quem não trabalhou e passa para quem tem menos fila.</p>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label className="text-xs">Parados há (dias)</Label>
                <Input type="number" min={1} max={60} value={idleDays} onChange={(e) => setIdleDays(Math.max(1, Math.min(60, Number(e.target.value) || 1)))} className="mt-1" />
              </div>
              <div>
                <Label className="text-xs">Ordem</Label>
                <Select value={recycleMode} onValueChange={(v) => setRecycleMode(v as any)}>
                  <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="score">Por score</SelectItem>
                    <SelectItem value="round_robin">Round-robin</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <Button className="mt-3 w-full" variant="secondary" disabled={busy} onClick={runRecycle}>
              <RefreshCw className="mr-2 h-4 w-4" /> Reciclar agora
            </Button>
          </div>
        </div>
      </Card>


      {/* Ranking + origem */}
      <div className="mt-6 grid gap-4 lg:grid-cols-2">
        <Card className="p-5">
          <p className="mb-3 text-sm font-semibold flex items-center gap-2"><Trophy className="h-4 w-4" /> Ranking por consultora</p>
          <Table>
            <TableHeader><TableRow><TableHead>Consultora</TableHead><TableHead className="text-right">Leads</TableHead><TableHead className="text-right">Ganhos</TableHead><TableHead className="text-right">Conv.</TableHead></TableRow></TableHeader>
            <TableBody>
              {(stats?.ranking ?? []).map((r) => (
                <TableRow key={r.consultantId ?? "none"}>
                  <TableCell className="max-w-[180px] truncate">{r.email}</TableCell>
                  <TableCell className="text-right">{r.total}</TableCell>
                  <TableCell className="text-right">{r.ganhos}</TableCell>
                  <TableCell className="text-right">{r.conversao}%</TableCell>
                </TableRow>
              ))}
              {!stats?.ranking.length && <TableRow><TableCell colSpan={4} className="text-center text-sm text-muted-foreground">Sem dados.</TableCell></TableRow>}
            </TableBody>
          </Table>
        </Card>
        <Card className="p-5">
          <p className="mb-3 text-sm font-semibold">Origem com melhor conversão</p>
          <Table>
            <TableHeader><TableRow><TableHead>Origem</TableHead><TableHead className="text-right">Leads</TableHead><TableHead className="text-right">Conv.</TableHead></TableRow></TableHeader>
            <TableBody>
              {(stats?.porOrigem ?? []).map((o) => (
                <TableRow key={o.origem}><TableCell>{o.origem}</TableCell><TableCell className="text-right">{o.total}</TableCell><TableCell className="text-right">{o.conversao}%</TableCell></TableRow>
              ))}
              {!stats?.porOrigem.length && <TableRow><TableCell colSpan={3} className="text-center text-sm text-muted-foreground">Sem dados.</TableCell></TableRow>}
            </TableBody>
          </Table>
        </Card>
      </div>

      {/* Leads + assignment */}
      <Card className="mt-6 overflow-hidden">
        <div className="border-b px-5 py-4"><p className="text-sm font-semibold">Leads ({leads.length}) — atribuição</p></div>
        <div className="max-h-[520px] overflow-auto">
          <Table>
            <TableHeader><TableRow><TableHead>Nome</TableHead><TableHead>Cidade</TableHead><TableHead>Status</TableHead><TableHead className="text-right">Score</TableHead><TableHead>Consultora</TableHead></TableRow></TableHeader>
            <TableBody>
              {leads.map((l) => (
                <TableRow key={l.id}>
                  <TableCell><Link to="/prospeccao/$leadId" params={{ leadId: l.id }} className="font-medium hover:underline">{l.nome}</Link></TableCell>
                  <TableCell className="text-muted-foreground">{l.cidade ?? "—"}</TableCell>
                  <TableCell><Badge variant="outline" className={STATUS_TONE[l.status]}>{STATUS_LABEL[l.status]}</Badge></TableCell>
                  <TableCell className="text-right font-semibold">{l.score}</TableCell>
                  <TableCell>
                    <Select value={l.consultant_id ?? "none"} onValueChange={(v) => reassign(l.id, v)}>
                      <SelectTrigger className="h-8 w-[200px]"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">Não atribuído</SelectItem>
                        {consultants.map((c) => <SelectItem key={c.id} value={c.id}>{c.email}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </TableCell>
                </TableRow>
              ))}
              {!leads.length && <TableRow><TableCell colSpan={5} className="text-center text-sm text-muted-foreground">Nenhum lead ainda.</TableCell></TableRow>}
            </TableBody>
          </Table>
        </div>
      </Card>
      <div className="sr-only">{emailById.size}</div>
    </AppShell>
  );
}
