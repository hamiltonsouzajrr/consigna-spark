import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useAuth } from "@/lib/auth";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import {
  Search, Loader2, Check, X, Copy, ChevronDown, ChevronUp, ExternalLink,
  FileSpreadsheet, FileText, FileDown,
} from "lucide-react";
import {
  getRegistros, getArquivos, atualizarRegistro, getArquivoUrl,
  type DoRegistro, type DoArquivo,
} from "@/lib/radar/radar.functions";

export const Route = createFileRoute("/radar/registros")({
  component: RegistrosPage,
});

const STATUS = ["Novo", "Revisado", "Aprovado", "Ignorado", "Duplicado"];
const POTENCIAIS = ["Alto", "Médio", "Baixo", "Ignorar"];

function potencialTone(p: string): string {
  switch (p) {
    case "Alto":
      return "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-200";
    case "Médio":
      return "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-200";
    case "Baixo":
      return "bg-slate-100 text-slate-700 dark:bg-slate-800/60 dark:text-slate-300";
    case "Ignorar":
      return "bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-200";
    default:
      return "bg-muted text-muted-foreground";
  }
}

function statusTone(s: string): string {
  switch (s) {
    case "Aprovado":
      return "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-200";
    case "Ignorado":
      return "bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-200";
    case "Duplicado":
      return "bg-orange-100 text-orange-800 dark:bg-orange-900/40 dark:text-orange-200";
    case "Revisado":
      return "bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-200";
    default:
      return "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-200";
  }
}

const EXPORT_FIELDS: { key: keyof DoRegistro; label: string }[] = [
  { key: "nome_servidor", label: "Nome" },
  { key: "matricula", label: "Matrícula" },
  { key: "cpf_parcial", label: "CPF parcial" },
  { key: "cargo", label: "Cargo" },
  { key: "orgao", label: "Órgão" },
  { key: "tipo_movimentacao", label: "Tipo" },
  { key: "categoria", label: "Categoria" },
  { key: "potencial_financeiro", label: "Potencial financeiro" },
  { key: "motivo_classificacao", label: "Motivo" },
  { key: "data_publicacao", label: "Data publicação" },
  { key: "data_ato", label: "Data do ato" },
  { key: "pagina", label: "Página" },
  { key: "numero_ato", label: "Nº ato" },
  { key: "classe_anterior", label: "Classe anterior" },
  { key: "classe_nova", label: "Classe nova" },
  { key: "nivel_anterior", label: "Nível anterior" },
  { key: "nivel_novo", label: "Nível novo" },
  { key: "referencia_anterior", label: "Ref. anterior" },
  { key: "referencia_nova", label: "Ref. nova" },
  { key: "status_revisao", label: "Status" },
  { key: "confianca_ia", label: "Confiança" },
  { key: "trecho_original", label: "Trecho original" },
];

function RegistrosPage() {
  const { user } = useAuth();
  const fetchRegs = useServerFn(getRegistros);
  const fetchArqs = useServerFn(getArquivos);
  const updateFn = useServerFn(atualizarRegistro);
  const urlFn = useServerFn(getArquivoUrl);

  const [list, setList] = useState<DoRegistro[]>([]);
  const [arquivos, setArquivos] = useState<Record<string, DoArquivo>>({});
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");
  const [orgao, setOrgao] = useState("todos");
  const [tipo, setTipo] = useState("todos");
  const [status, setStatus] = useState("todos");
  const [potencial, setPotencial] = useState("todos");
  const [data, setData] = useState("");
  const [expanded, setExpanded] = useState<string | null>(null);
  const [exportFields, setExportFields] = useState<Set<string>>(
    new Set(["nome_servidor", "matricula", "cargo", "orgao", "tipo_movimentacao", "data_publicacao", "pagina", "status_revisao"]),
  );
  const [showExport, setShowExport] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const [regs, arqs] = await Promise.all([fetchRegs(), fetchArqs()]);
      setList(regs);
      setArquivos(Object.fromEntries(arqs.map((a) => [a.id, a])));
    } catch (e: any) {
      toast.error(e?.message ?? "Erro ao carregar registros.");
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => {
    if (user) load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  const orgaoOptions = useMemo(
    () => Array.from(new Set(list.map((r) => r.orgao).filter(Boolean))) as string[],
    [list],
  );
  const tipoOptions = useMemo(
    () => Array.from(new Set(list.map((r) => r.categoria || r.tipo_movimentacao).filter(Boolean))) as string[],
    [list],
  );

  const visible = useMemo(() => {
    const term = q.trim().toLowerCase();
    return list.filter((r) => {
      if (term && !r.nome_servidor.toLowerCase().includes(term)) return false;
      if (orgao !== "todos" && r.orgao !== orgao) return false;
      if (tipo !== "todos" && (r.categoria || r.tipo_movimentacao) !== tipo) return false;
      if (status !== "todos" && r.status_revisao !== status) return false;
      if (potencial !== "todos" && (r.potencial_financeiro || "") !== potencial) return false;
      if (data && r.data_publicacao !== data) return false;
      return true;
    });
  }, [list, q, orgao, tipo, status, potencial, data]);

  const setStatusFor = async (id: string, novo: string) => {
    setList((l) => l.map((r) => (r.id === id ? { ...r, status_revisao: novo } : r)));
    try {
      await updateFn({ data: { id, patch: { status_revisao: novo } } });
    } catch (e: any) {
      toast.error(e?.message ?? "Erro ao atualizar.");
      load();
    }
  };

  const openOriginal = async (r: DoRegistro) => {
    const arq = arquivos[r.arquivo_id];
    if (!arq?.caminho_arquivo) {
      toast.warning("Arquivo original não disponível.");
      return;
    }
    try {
      const { url } = await urlFn({ data: { caminho: arq.caminho_arquivo } });
      window.open(url, "_blank", "noopener");
    } catch (e: any) {
      toast.error(e?.message ?? "Erro ao abrir arquivo.");
    }
  };

  const exportData = useMemo(() => {
    const cols = EXPORT_FIELDS.filter((f) => exportFields.has(f.key));
    const rows = visible.map((r) =>
      Object.fromEntries(cols.map((c) => [c.label, String(r[c.key] ?? "")])),
    );
    return { cols, rows };
  }, [visible, exportFields]);

  const exportCSV = () => {
    const { cols, rows } = exportData;
    const head = cols.map((c) => `"${c.label}"`).join(",");
    const body = rows
      .map((row) => cols.map((c) => `"${String(row[c.label] ?? "").replace(/"/g, '""')}"`).join(","))
      .join("\n");
    download(`radar-${Date.now()}.csv`, `${head}\n${body}`, "text/csv;charset=utf-8");
  };

  const exportExcel = async () => {
    const XLSX = await import("xlsx");
    const ws = XLSX.utils.json_to_sheet(exportData.rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Registros");
    XLSX.writeFile(wb, `radar-${Date.now()}.xlsx`);
  };

  const exportPDF = async () => {
    const { jsPDF } = await import("jspdf");
    const autoTable = (await import("jspdf-autotable")).default;
    const doc = new jsPDF({ orientation: "landscape" });
    doc.text("Radar Diário Oficial — Registros", 14, 14);
    autoTable(doc, {
      startY: 20,
      head: [exportData.cols.map((c) => c.label)],
      body: exportData.rows.map((row) => exportData.cols.map((c) => String(row[c.label] ?? ""))),
      styles: { fontSize: 7, cellWidth: "wrap" },
      headStyles: { fillColor: [37, 99, 235] },
    });
    doc.save(`radar-${Date.now()}.pdf`);
  };

  return (
    <div className="space-y-4">
      <Card className="p-4">
        <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-6">
          <div className="relative lg:col-span-2">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input className="pl-9" placeholder="Buscar por nome…" value={q} onChange={(e) => setQ(e.target.value)} />
          </div>
          <Select value={orgao} onValueChange={setOrgao}>
            <SelectTrigger><SelectValue placeholder="Órgão" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todos os órgãos</SelectItem>
              {orgaoOptions.map((o) => <SelectItem key={o} value={o}>{o}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={tipo} onValueChange={setTipo}>
            <SelectTrigger><SelectValue placeholder="Tipo" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todos os tipos</SelectItem>
              {tipoOptions.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={status} onValueChange={setStatus}>
            <SelectTrigger><SelectValue placeholder="Status" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todos os status</SelectItem>
              {STATUS.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={potencial} onValueChange={setPotencial}>
            <SelectTrigger><SelectValue placeholder="Potencial" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todos os potenciais</SelectItem>
              {POTENCIAIS.map((p) => <SelectItem key={p} value={p}>{p}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <Input type="date" value={data} onChange={(e) => setData(e.target.value)} className="w-44" />
          {data && <Button size="sm" variant="ghost" onClick={() => setData("")}>Limpar data</Button>}
          <span className="ml-auto text-sm text-muted-foreground">{visible.length} registro(s)</span>
          <Button size="sm" variant="outline" onClick={() => setShowExport((v) => !v)}>
            <FileDown className="mr-2 h-4 w-4" /> Exportar
          </Button>
        </div>

        {showExport && (
          <div className="mt-3 rounded-lg border p-3">
            <p className="mb-2 text-sm font-medium">Campos para exportar</p>
            <div className="flex flex-wrap gap-2">
              {EXPORT_FIELDS.map((f) => {
                const on = exportFields.has(f.key);
                return (
                  <button
                    key={f.key}
                    onClick={() =>
                      setExportFields((prev) => {
                        const next = new Set(prev);
                        if (next.has(f.key)) next.delete(f.key);
                        else next.add(f.key);
                        return next;
                      })
                    }
                    className={`rounded-full border px-3 py-1 text-xs transition ${
                      on ? "border-primary bg-primary/10 text-primary" : "text-muted-foreground"
                    }`}
                  >
                    {f.label}
                  </button>
                );
              })}
            </div>
            <div className="mt-3 flex flex-wrap gap-2">
              <Button size="sm" onClick={exportCSV}><FileText className="mr-2 h-4 w-4" /> CSV</Button>
              <Button size="sm" onClick={exportExcel}><FileSpreadsheet className="mr-2 h-4 w-4" /> Excel</Button>
              <Button size="sm" onClick={exportPDF}><FileDown className="mr-2 h-4 w-4" /> PDF</Button>
            </div>
          </div>
        )}
      </Card>

      {loading ? (
        <div className="flex min-h-[30vh] items-center justify-center text-muted-foreground">
          <Loader2 className="h-6 w-6 animate-spin" />
        </div>
      ) : visible.length === 0 ? (
        <Card className="p-8 text-center text-sm text-muted-foreground">
          Nenhum registro encontrado. Importe um Diário Oficial na aba <strong>Importar</strong>.
        </Card>
      ) : (
        <div className="space-y-2">
          {visible.map((r) => {
            const open = expanded === r.id;
            return (
              <Card key={r.id} className="overflow-hidden">
                <div className="flex flex-wrap items-center gap-3 p-3">
                  <button
                    className="flex flex-1 items-center gap-3 text-left"
                    onClick={() => setExpanded(open ? null : r.id)}
                  >
                    {open ? <ChevronUp className="h-4 w-4 shrink-0" /> : <ChevronDown className="h-4 w-4 shrink-0" />}
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-medium">{r.nome_servidor}</p>
                      <p className="truncate text-xs text-muted-foreground">
                        {[r.cargo, r.orgao, r.categoria || r.tipo_movimentacao].filter(Boolean).join(" · ")}
                      </p>
                    </div>
                  </button>
                  {r.potencial_financeiro && (
                    <Badge className={`text-xs ${potencialTone(r.potencial_financeiro)}`}>
                      {r.potencial_financeiro}
                    </Badge>
                  )}
                  {r.data_publicacao && <Badge variant="outline" className="text-xs">{r.data_publicacao}</Badge>}
                  {r.duplicado_possivel && <Badge className="bg-orange-500 text-white">duplicado?</Badge>}
                  <Badge className={`text-xs ${statusTone(r.status_revisao)}`}>{r.status_revisao}</Badge>
                </div>

                {open && (
                  <div className="border-t bg-muted/30 p-4">
                    <div className="grid gap-2 text-sm md:grid-cols-2 lg:grid-cols-3">
                      <Info label="Matrícula" value={r.matricula} />
                      <Info label="CPF parcial" value={r.cpf_parcial} />
                      <Info label="Página" value={r.pagina} />
                      <Info label="Nº ato" value={r.numero_ato} />
                      <Info label="Data do ato" value={r.data_ato} />
                      <Info label="Confiança IA" value={r.confianca_ia} />
                      <Info label="Categoria" value={r.categoria} />
                      <Info label="Potencial financeiro" value={r.potencial_financeiro} />
                      <Info label="Classe" value={join(r.classe_anterior, r.classe_nova)} />
                      <Info label="Nível" value={join(r.nivel_anterior, r.nivel_novo)} />
                      <Info label="Referência" value={join(r.referencia_anterior, r.referencia_nova)} />
                    </div>
                    {r.motivo_classificacao && (
                      <div className="mt-3 rounded-md border bg-background p-3 text-sm">
                        <span className="text-xs uppercase tracking-wide text-muted-foreground">Motivo da classificação: </span>
                        {r.motivo_classificacao}
                      </div>
                    )}
                    {r.trecho_original && (
                      <div className="mt-3 rounded-md border bg-background p-3 text-sm italic text-muted-foreground">
                        “{r.trecho_original}”
                      </div>
                    )}
                    <div className="mt-3 flex flex-wrap gap-2">
                      <Button size="sm" className="bg-emerald-600 hover:bg-emerald-700" onClick={() => setStatusFor(r.id, "Aprovado")}>
                        <Check className="mr-1 h-4 w-4" /> Aprovar
                      </Button>
                      <Button size="sm" variant="outline" onClick={() => setStatusFor(r.id, "Revisado")}>
                        Revisado
                      </Button>
                      <Button size="sm" variant="outline" onClick={() => setStatusFor(r.id, "Ignorado")}>
                        <X className="mr-1 h-4 w-4" /> Ignorar
                      </Button>
                      <Button size="sm" variant="outline" onClick={() => setStatusFor(r.id, "Duplicado")}>
                        <Copy className="mr-1 h-4 w-4" /> Duplicado
                      </Button>
                      <Button size="sm" variant="ghost" onClick={() => openOriginal(r)}>
                        <ExternalLink className="mr-1 h-4 w-4" /> Abrir arquivo
                      </Button>
                    </div>
                  </div>
                )}
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}

function Info({ label, value }: { label: string; value: string | null }) {
  return (
    <div>
      <span className="text-xs uppercase tracking-wide text-muted-foreground">{label}: </span>
      <span>{value || "—"}</span>
    </div>
  );
}
function join(a: string | null, b: string | null): string {
  if (!a && !b) return "";
  return `${a || "—"} → ${b || "—"}`;
}
function download(name: string, content: string, mime: string) {
  const blob = new Blob(["\ufeff" + content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  URL.revokeObjectURL(url);
}
