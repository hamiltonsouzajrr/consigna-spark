import { createFileRoute, Navigate, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useAuth } from "@/lib/auth";
import { useRhAccess } from "@/hooks/use-rh-access";
import { AppShell } from "@/components/AppShell";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import {
  Award, ArrowLeft, Upload, Trash2, Plus, Save, FileText, Search, Loader2,
} from "lucide-react";
import {
  getPromovidos, savePromovidos, deletePromovido, type Promovido,
} from "@/lib/prospeccao/promovidos.functions";

export const Route = createFileRoute("/prospeccao/promovidos")({
  head: () => ({
    meta: [
      { title: "Recém promovidos — Prospecção" },
      { name: "description", content: "Lista de colaboradores recém-promovidos do mês, alimentada por PDFs." },
      { name: "robots", content: "noindex,nofollow" },
    ],
  }),
  component: Page,
});

type Draft = { nome: string; cpf: string; cargo: string };

const CPF_RE = /(\d{3}\.?\s?\d{3}\.?\s?\d{3}\s?-?\s?\d{2})/;
const HEADER_RE = /^(nome|cpf|cargo|matr[ií]cula|servidor|colaborador|promo[cç][aã]o|refer[eê]ncia|p[aá]gina|folha)$/i;

// Common job/role keywords to recognize a "cargo" line/segment.
const CARGO_RE = /(analista|assistente|auxiliar|gerente|gestor|coordenad|supervisor|diretor|t[eé]cnic|especialista|consultor|operador|estagi[aá]ri|aprendiz|secret[aá]ri|advogad|engenheir|arquitet|contad|economist|administrad|programad|desenvolvedor|design|m[eé]dic|enfermeir|professor|vendedor|atendente|caixa|escritur|gerencial|chefe|encarregad|l[ií]der|cargo|fun[cç][aã]o)/i;

// Seniority/level qualifiers that complete a cargo (never a name on their own).
const NIVEL_RE = /\b(s[eê]nior|j[uú]nior|pleno|n[ií]vel\s*[ivx]+|i{1,3}\b|iv\b|trainee)\b/i;

// Honorific/title prefixes that should be stripped from a name.
const HONORIFIC_RE = /^(sr\.?|sra\.?|dr\.?|dra\.?|exmo\.?|exma\.?|prof\.?)\s+/i;

// Format a raw CPF (digits with optional separators) to 000.000.000-00.
function formatCpf(raw: string): string {
  const d = raw.replace(/\D/g, "");
  if (d.length !== 11) return raw.replace(/\s/g, "");
  return `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6, 9)}-${d.slice(9)}`;
}

// Title-case a name, keeping common Portuguese connectors lowercase.
function titleCaseName(s: string): string {
  const lower = new Set(["da", "de", "do", "das", "dos", "e"]);
  return s
    .toLocaleLowerCase("pt-BR")
    .split(/\s+/)
    .filter(Boolean)
    .map((w, idx) =>
      lower.has(w) && idx > 0 ? w : w.charAt(0).toLocaleUpperCase("pt-BR") + w.slice(1),
    )
    .join(" ");
}

// A line that looks like a person's name: 2+ alphabetic words, no digits, not a cargo.
function looksLikeName(s: string): boolean {
  const t = s.trim();
  if (!t || /\d/.test(t) || HEADER_RE.test(t)) return false;
  if (!/^[A-Za-zÀ-ÿ'.\s-]+$/.test(t)) return false;
  const words = t.split(/\s+/).filter((w) => w.length > 1);
  if (words.length < 2) return false;
  // A pure cargo (e.g. "Analista Júnior") should not be treated as a name.
  if (CARGO_RE.test(t) && words.length <= 3) return false;
  return true;
}

// Clean a candidate name: strip matrícula, honorifics, trailing separators,
// and any trailing cargo segment that got glued onto the name.
function cleanName(s: string): string {
  let v = s
    .replace(/^\s*\d+\s*[-–.)]?\s*/, "")
    .replace(/[-–:|,;]+$/, "")
    .replace(HONORIFIC_RE, "")
    .trim();
  // If a cargo keyword appears mid-string, keep only the part before it.
  const cargoMatch = v.match(CARGO_RE);
  if (cargoMatch && cargoMatch.index && cargoMatch.index > 0) {
    const head = v.slice(0, cargoMatch.index).trim().replace(/[-–:|,;]+$/, "").trim();
    if (looksLikeName(head)) v = head;
  }
  return v.trim();
}

// Extract a cargo from a free-text segment (keeps from the cargo keyword onward).
function extractCargo(s: string): string {
  const t = s.replace(/^[-–:|,;]+/, "").trim();
  if (!t || CPF_RE.test(t) || HEADER_RE.test(t)) return "";
  const m = t.match(CARGO_RE);
  if (m && typeof m.index === "number") {
    return t.slice(m.index).replace(/[-–:|,;]+$/, "").trim();
  }
  return "";
}

type TextItem = { str?: string; transform?: number[] };

async function readTextContentWithoutSafariAsyncIterator(page: any): Promise<{ items: TextItem[] }> {
  const textContent = { items: [] as TextItem[] };
  const stream = typeof page.streamTextContent === "function" ? page.streamTextContent() : null;

  if (stream && typeof stream.getReader === "function") {
    const reader = stream.getReader();
    try {
      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        if (value?.items?.length) textContent.items.push(...value.items);
      }
    } finally {
      reader.releaseLock?.();
    }
    return textContent;
  }

  return page.getTextContent();
}

function currentMonth(): string {
  return new Date().toISOString().slice(0, 7);
}

function fmtMonth(iso: string): string {
  // iso is YYYY-MM-DD
  const [y, m] = iso.split("-");
  const date = new Date(Number(y), Number(m) - 1, 1);
  return date.toLocaleDateString("pt-BR", { month: "long", year: "numeric" });
}

// Extract text lines from a PDF (browser-side) using pdfjs.
// Falls back to OCR (tesseract) when the PDF has no selectable text (scanned).
async function extractPdfLines(file: File): Promise<string[]> {
  const pdfjs: any = await import("pdfjs-dist");
  // Resolve the worker bundled with the app (reliable across dev + build).
  pdfjs.GlobalWorkerOptions.workerSrc = new URL(
    "pdfjs-dist/build/pdf.worker.min.mjs",
    import.meta.url,
  ).href;

  const buf = await file.arrayBuffer();
  const doc = await pdfjs.getDocument({ data: buf }).promise;
  const lines: string[] = [];
  const ocrPages: number[] = [];

  for (let p = 1; p <= doc.numPages; p++) {
    const page = await doc.getPage(p);
    let pageLineCount = 0;
    try {
      const content = await readTextContentWithoutSafariAsyncIterator(page);
      // Group text items by their vertical position to reconstruct lines.
      const rows = new Map<number, { x: number; str: string }[]>();
      for (const item of content.items) {
        if (!item.str || !item.transform) continue;
        const y = Math.round(item.transform[5]);
        const x = item.transform[4];
        if (!rows.has(y)) rows.set(y, []);
        rows.get(y)!.push({ x, str: item.str });
      }
      const sortedY = Array.from(rows.keys()).sort((a, b) => b - a);
      for (const y of sortedY) {
        const parts = rows.get(y)!.sort((a, b) => a.x - b.x).map((r) => r.str);
        const line = parts.join(" ").replace(/\s+/g, " ").trim();
        if (line) {
          lines.push(line);
          pageLineCount += 1;
        }
      }
    } catch (error) {
      console.warn(`[promovidos] extração de texto falhou na página ${p}; tentando OCR`, error);
    }
    if (pageLineCount === 0) ocrPages.push(p);
  }

  // If every page had selectable text, we're done.
  if (ocrPages.length === 0) return lines;

  // Scanned/mixed PDF: run OCR only on pages without selectable text.
  const { default: Tesseract } = await import("tesseract.js");
  const ocrLines: string[] = [];
  for (const p of ocrPages) {
    const page = await doc.getPage(p);
    const viewport = page.getViewport({ scale: 1.75 });
    const canvas = document.createElement("canvas");
    canvas.width = viewport.width;
    canvas.height = viewport.height;
    const ctx = canvas.getContext("2d");
    if (!ctx) continue;
    await page.render({ canvasContext: ctx, viewport }).promise;
    const { data } = await Tesseract.recognize(canvas, "por");
    for (const raw of (data.text ?? "").split("\n")) {
      const line = raw.replace(/\s+/g, " ").trim();
      if (line) ocrLines.push(line);
    }
  }
  return ocrLines;
}


// Heuristic: turn lines into {nome, cpf, cargo}, prioritizing the three target
// fields in order — CPF (anchor), Nome, Cargo. Each line containing a CPF is a
// record; name and cargo are resolved from the same line or adjacent lines.
function parseLines(lines: string[]): Draft[] {
  const out: Draft[] = [];
  const usefulLines = lines.map((line) => line.replace(/\s+/g, " ").trim()).filter(Boolean);

  for (let i = 0; i < usefulLines.length; i++) {
    const line = usefulLines[i];
    const m = line.match(CPF_RE);
    if (!m) continue;

    // 1) CPF — the anchor, always normalized.
    const cpf = formatCpf(m[1]);

    const beforeRaw = line.slice(0, m.index).trim().replace(/[-–:|]+$/, "").trim();
    const afterRaw = line.slice((m.index ?? 0) + m[0].length).trim().replace(/^[-–:|]+/, "").trim();
    const before = cleanName(beforeRaw);
    const after = afterRaw;
    const previous = cleanName(usefulLines[i - 1]?.trim() ?? "");
    const nextRaw = usefulLines[i + 1]?.trim() ?? "";

    // 2) Nome — prioritize, in order: text before the CPF, the previous line,
    //    then any plausible before/previous text that is not itself a CPF.
    let nome = "";
    if (looksLikeName(before)) nome = before;
    else if (looksLikeName(previous)) nome = previous;
    else if (before && !CPF_RE.test(before) && !CARGO_RE.test(before)) nome = before;
    else if (previous && !CPF_RE.test(previous) && !CARGO_RE.test(previous)) nome = previous;
    if (nome) nome = titleCaseName(nome);

    // 3) Cargo — prioritize, in order: cargo segment after the CPF, then in the
    //    before text, then the next line, then any non-name leftover after the CPF.
    let cargo =
      extractCargo(after) ||
      extractCargo(beforeRaw) ||
      extractCargo(nextRaw);
    if (!cargo) {
      if (after && !CPF_RE.test(after) && !HEADER_RE.test(after)) cargo = after;
      else if (nextRaw && !CPF_RE.test(nextRaw) && !HEADER_RE.test(nextRaw) && !looksLikeName(nextRaw)) cargo = nextRaw;
    }
    // Apply level/seniority qualifier from the next line when missing.
    if (cargo && !NIVEL_RE.test(cargo) && NIVEL_RE.test(nextRaw) && nextRaw.length <= 20) {
      cargo = `${cargo} ${nextRaw}`.replace(/\s+/g, " ").trim();
    }

    out.push({ nome, cpf, cargo: cargo.trim() });
  }
  return out;
}


function Page() {
  const { user, loading } = useAuth();
  const { isAdmin } = useRhAccess();
  const fetchAll = useServerFn(getPromovidos);
  const saveFn = useServerFn(savePromovidos);
  const delFn = useServerFn(deletePromovido);

  const [list, setList] = useState<Promovido[]>([]);
  const [loadingList, setLoadingList] = useState(true);
  const [q, setQ] = useState("");

  // Upload / review state (admin only).
  const [mes, setMes] = useState(currentMonth());
  const [drafts, setDrafts] = useState<Draft[]>([]);
  const [rawLines, setRawLines] = useState<string[]>([]);
  const [parsing, setParsing] = useState(false);
  const [saving, setSaving] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const load = async () => {
    try {
      const data = await fetchAll();
      setList(data);
    } catch (e: any) {
      toast.error(e?.message ?? "Erro ao carregar promovidos.");
    } finally {
      setLoadingList(false);
    }
  };

  useEffect(() => {
    if (user) load();
  }, [user]);

  const onPickFile = async (file: File | undefined) => {
    if (!file) return;
    setParsing(true);
    const toastId = toast.loading("Lendo PDF… (PDFs escaneados usam OCR e podem demorar)");
    try {
      const lines = await extractPdfLines(file);
      setRawLines(lines);
      const parsed = parseLines(lines);
      if (parsed.length === 0) {
        toast.warning("Nenhum CPF reconhecido no PDF. Adicione os registros manualmente.", { id: toastId });
        setDrafts((d) => (d.length ? d : [{ nome: "", cpf: "", cargo: "" }]));
      } else {
        setDrafts(parsed);
        toast.success(`${parsed.length} registro(s) extraído(s). Revise antes de salvar.`, { id: toastId });
      }
    } catch (e: any) {
      console.error("[promovidos] erro ao ler PDF:", e);
      setRawLines([]);
      toast.error(`Não foi possível ler o PDF: ${e?.message ?? "erro desconhecido"}`, { id: toastId });
    } finally {
      setParsing(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  };


  const updateDraft = (i: number, field: keyof Draft, value: string) => {
    setDrafts((d) => d.map((row, idx) => (idx === i ? { ...row, [field]: value } : row)));
  };
  const removeDraft = (i: number) => setDrafts((d) => d.filter((_, idx) => idx !== i));
  const addDraft = () => setDrafts((d) => [...d, { nome: "", cpf: "", cargo: "" }]);

  const handleSave = async () => {
    const clean = drafts
      .map((d) => ({ nome: d.nome.trim(), cpf: d.cpf.trim(), cargo: d.cargo.trim() }))
      .filter((d) => d.nome && d.cpf && d.cargo);
    if (clean.length === 0) {
      toast.warning("Preencha nome, CPF e cargo de pelo menos um registro.");
      return;
    }
    setSaving(true);
    try {
      const { inserted } = await saveFn({ data: { mes_referencia: mes, entries: clean } });
      toast.success(`${inserted} promovido(s) salvo(s).`);
      setDrafts([]);
      setRawLines([]);
      load();
    } catch (e: any) {
      toast.error(e?.message ?? "Erro ao salvar.");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await delFn({ data: { id } });
      setList((l) => l.filter((p) => p.id !== id));
      toast.success("Registro removido.");
    } catch (e: any) {
      toast.error(e?.message ?? "Erro ao remover.");
    }
  };

  const visible = useMemo(() => {
    const term = q.trim().toLowerCase();
    if (!term) return list;
    return list.filter(
      (p) =>
        p.nome.toLowerCase().includes(term) ||
        p.cpf.includes(term) ||
        p.cargo.toLowerCase().includes(term),
    );
  }, [list, q]);

  // Group by month for display.
  const grouped = useMemo(() => {
    const map = new Map<string, Promovido[]>();
    for (const p of visible) {
      const key = p.mes_referencia;
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(p);
    }
    return Array.from(map.entries()).sort((a, b) => b[0].localeCompare(a[0]));
  }, [visible]);

  if (loading) return null;
  if (!user) return <Navigate to="/login" />;

  return (
    <AppShell>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <Button asChild variant="ghost" size="icon">
            <Link to="/prospeccao"><ArrowLeft className="h-4 w-4" /></Link>
          </Button>
          <div>
            <h1 className="flex items-center gap-2 text-2xl font-bold">
              <Award className="h-6 w-6 text-amber-500" /> Recém promovidos
            </h1>
            <p className="text-sm text-muted-foreground">Colaboradores promovidos no mês, importados de PDF.</p>
          </div>
        </div>
      </div>

      {isAdmin && (
        <Card className="mb-6 p-4">
          <div className="mb-4 flex flex-wrap items-end gap-3">
            <div>
              <label className="mb-1 block text-xs font-medium text-muted-foreground">Mês de referência</label>
              <Input type="month" value={mes} onChange={(e) => setMes(e.target.value)} className="w-44" />
            </div>
            <div>
              <input
                ref={fileRef}
                type="file"
                accept="application/pdf"
                className="hidden"
                onChange={(e) => onPickFile(e.target.files?.[0])}
              />
              <Button variant="outline" onClick={() => fileRef.current?.click()} disabled={parsing}>
                {parsing ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Upload className="mr-2 h-4 w-4" />}
                {parsing ? "Lendo PDF…" : "Importar PDF"}
              </Button>
            </div>
            <Button variant="ghost" onClick={addDraft}>
              <Plus className="mr-2 h-4 w-4" /> Adicionar manualmente
            </Button>
          </div>

          {drafts.length > 0 && (
            <div className="space-y-2">
              <div className="hidden gap-2 px-1 text-xs font-medium text-muted-foreground sm:grid sm:grid-cols-[1.5fr_1fr_1.2fr_auto]">
                <span>Nome completo</span><span>CPF</span><span>Cargo de promoção</span><span></span>
              </div>
              {drafts.map((d, i) => (
                <div key={i} className="grid gap-2 sm:grid-cols-[1.5fr_1fr_1.2fr_auto]">
                  <Input placeholder="Nome completo" value={d.nome} onChange={(e) => updateDraft(i, "nome", e.target.value)} />
                  <Input placeholder="CPF" value={d.cpf} onChange={(e) => updateDraft(i, "cpf", e.target.value)} />
                  <Input placeholder="Cargo" value={d.cargo} onChange={(e) => updateDraft(i, "cargo", e.target.value)} />
                  <Button variant="ghost" size="icon" onClick={() => removeDraft(i)}>
                    <Trash2 className="h-4 w-4 text-rose-500" />
                  </Button>
                </div>
              ))}
              <div className="flex items-center justify-between pt-2">
                <p className="text-xs text-muted-foreground">{drafts.length} registro(s) na revisão</p>
                <Button onClick={handleSave} disabled={saving}>
                  {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                  Salvar promovidos
                </Button>
              </div>
            </div>
          )}

          {rawLines.length > 0 && (
            <details className="mt-4 rounded-md border bg-muted/30 p-3 text-sm">
              <summary className="cursor-pointer font-medium">Ver texto extraído do PDF</summary>
              <pre className="mt-3 max-h-64 overflow-auto whitespace-pre-wrap text-xs text-muted-foreground">
                {rawLines.join("\n")}
              </pre>
            </details>
          )}

          {drafts.length === 0 && (
            <p className="flex items-center gap-2 text-sm text-muted-foreground">
              <FileText className="h-4 w-4" /> Importe um PDF com nome, CPF e cargo para revisar e salvar.
            </p>
          )}
        </Card>
      )}

      <div className="mb-4 relative w-full max-w-xs">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input className="pl-9" placeholder="Buscar nome, CPF ou cargo" value={q} onChange={(e) => setQ(e.target.value)} />
      </div>

      {loadingList && <p className="text-sm text-muted-foreground">Carregando…</p>}
      {!loadingList && grouped.length === 0 && (
        <Card className="p-8 text-center text-sm text-muted-foreground">
          Nenhum promovido cadastrado ainda.
        </Card>
      )}

      <div className="space-y-6">
        {grouped.map(([month, people]) => (
          <div key={month}>
            <h2 className="mb-3 text-sm font-semibold capitalize text-muted-foreground">
              {fmtMonth(month)} <Badge variant="secondary" className="ml-1">{people.length}</Badge>
            </h2>
            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {people.map((p) => (
                <Card key={p.id} className="flex items-center gap-3 p-3">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-amber-500/15 text-amber-600 dark:text-amber-400">
                    <Award className="h-5 w-5" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-semibold">{p.nome}</p>
                    <p className="truncate text-xs text-muted-foreground">{p.cargo}</p>
                    <p className="text-xs text-muted-foreground">CPF: {p.cpf}</p>
                  </div>
                  {isAdmin && (
                    <Button variant="ghost" size="icon" onClick={() => handleDelete(p.id)}>
                      <Trash2 className="h-4 w-4 text-rose-500" />
                    </Button>
                  )}
                </Card>
              ))}
            </div>
          </div>
        ))}
      </div>
    </AppShell>
  );
}
