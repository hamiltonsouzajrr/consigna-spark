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
  FileSpreadsheet, FileText, FileDown, Phone, Users, UserPlus,
} from "lucide-react";
import {
  getRegistros, getArquivos, atualizarRegistro, getArquivoUrl, marcarAbordagem,
  getDistribuicaoConsultoras, getConsultoras, adicionarConsultora,
  toggleConsultora, removerConsultora, distribuirLeadsAutomatico, distribuirTodosLeads,
  type DoRegistro, type DoArquivo, type DistribuicaoConsultora, type Consultora,
} from "@/lib/radar/radar.functions";

export const Route = createFileRoute("/_authenticated/radar/registros")({
  component: RegistrosPage,
});

const STATUS = ["Novo", "Revisado", "Aprovado", "Ignorado", "Duplicado"];
const POTENCIAIS = ["Alto", "Médio", "Baixo", "Ignorar"];

const ABORDAGEM_OPTIONS: { value: string; label: string }[] = [
  { value: "novo", label: "Novo" },
  { value: "contatado", label: "Contatado" },
  { value: "proposta_enviada", label: "Proposta enviada" },
  { value: "convertido", label: "Convertido" },
  { value: "sem_interesse", label: "Sem interesse" },
];
const ABORDAGEM_LABEL: Record<string, string> = Object.fromEntries(
  ABORDAGEM_OPTIONS.map((o) => [o.value, o.label]),
);

function abordagemBorder(s: string): string {
  switch (s) {
    case "contatado":
    case "proposta_enviada":
      return "border-blue-400 dark:border-blue-500/60";
    case "convertido":
      return "border-emerald-500 dark:border-emerald-500/60";
    case "sem_interesse":
      return "opacity-60 border-border";
    default:
      return "";
  }
}

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

// Formata "2026-06-17" → "17/06/2026". Aceita também data com horário.
function fmtBR(s: string | null | undefined): string {
  if (!s) return "";
  const m = String(s).slice(0, 10).match(/^(\d{4})-(\d{2})-(\d{2})$/);
  return m ? `${m[3]}/${m[2]}/${m[1]}` : String(s);
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
  const abordagemFn = useServerFn(marcarAbordagem);
  const urlFn = useServerFn(getArquivoUrl);
  const distribuicaoFn = useServerFn(getDistribuicaoConsultoras);
  const consultorasFn = useServerFn(getConsultoras);
  const addConsultoraFn = useServerFn(adicionarConsultora);
  const toggleConsultoraFn = useServerFn(toggleConsultora);
  const removerConsultoraFn = useServerFn(removerConsultora);
  const distribuirFn = useServerFn(distribuirLeadsAutomatico);
  const distribuirTodosFn = useServerFn(distribuirTodosLeads);

  const [list, setList] = useState<DoRegistro[]>([]);
  const [arquivos, setArquivos] = useState<Record<string, DoArquivo>>({});
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");
  const [cpfQ, setCpfQ] = useState("");
  const [orgao, setOrgao] = useState("todos");
  const [tipo, setTipo] = useState("todos");
  const [status, setStatus] = useState("todos");
  const [abordagem, setAbordagem] = useState("todos");
  const [potencial, setPotencial] = useState("todos");
  const [consultora, setConsultora] = useState("todos");
  const [data, setData] = useState("");
  const [expanded, setExpanded] = useState<string | null>(null);
  const [trechoOpen, setTrechoOpen] = useState<Set<string>>(new Set());
  const [distribuicao, setDistribuicao] = useState<DistribuicaoConsultora[]>([]);
  const [consultoras, setConsultoras] = useState<Consultora[]>([]);
  const [novaConsultora, setNovaConsultora] = useState("");
  const [novaConsultoraEmail, setNovaConsultoraEmail] = useState("");
  const [savingConsultora, setSavingConsultora] = useState(false);
  const [atribuindo, setAtribuindo] = useState(false);
  const [atribuindoTodos, setAtribuindoTodos] = useState(false);
  const [exportFields, setExportFields] = useState<Set<string>>(
    new Set(["nome_servidor", "matricula", "cargo", "orgao", "tipo_movimentacao", "data_publicacao", "pagina", "status_revisao"]),
  );
  const [showExport, setShowExport] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const [regs, arqs, dist, cons] = await Promise.all([
        fetchRegs(), fetchArqs(), distribuicaoFn(), consultorasFn(),
      ]);
      setList(regs);
      setArquivos(Object.fromEntries(arqs.map((a) => [a.id, a])));
      setDistribuicao(dist);
      setConsultoras(cons);
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

  const handleAddConsultora = async () => {
    const nome = novaConsultora.trim();
    const email = novaConsultoraEmail.trim();
    if (!nome) {
      toast.warning("Digite o nome da consultora.");
      return;
    }
    setSavingConsultora(true);
    try {
      await addConsultoraFn({ data: { nome, email } });
      toast.success(`Consultora ${nome} cadastrada.`);
      setNovaConsultora("");
      setNovaConsultoraEmail("");
      await load();
    } catch (e: any) {
      toast.error(e?.message?.includes("duplicate") ? "Consultora já cadastrada." : (e?.message ?? "Erro ao cadastrar consultora."));
    } finally {
      setSavingConsultora(false);
    }
  };

  const handleToggleConsultora = async (c: Consultora) => {
    try {
      await toggleConsultoraFn({ data: { id: c.id, ativo: !c.ativo } });
      await load();
    } catch (e: any) {
      toast.error(e?.message ?? "Erro ao atualizar consultora.");
    }
  };

  const handleRemoverConsultora = async (c: Consultora) => {
    try {
      await removerConsultoraFn({ data: { id: c.id } });
      toast.success(`Consultora ${c.nome} removida.`);
      await load();
    } catch (e: any) {
      toast.error(e?.message ?? "Erro ao remover consultora.");
    }
  };

  const distribuirAgora = async () => {
    setAtribuindo(true);
    try {
      const { atribuidos, consultoras: nConsultoras } = await distribuirFn();
      if (nConsultoras === 0) {
        toast.warning("Cadastre ao menos uma consultora ativa.");
      } else if (atribuidos === 0) {
        toast.info("Nenhum lead disponível para distribuir.");
      } else {
        toast.success(`${atribuidos} lead(s) distribuído(s) entre ${nConsultoras} consultora(s).`);
      }
      await load();
    } catch (e: any) {
      toast.error(e?.message ?? "Erro ao distribuir leads.");
    } finally {
      setAtribuindo(false);
    }
  };

  const distribuirTodos = async () => {
    setAtribuindoTodos(true);
    try {
      const { atribuidos, consultoras: nConsultoras } = await distribuirTodosFn();
      if (nConsultoras === 0) {
        toast.warning("Cadastre ao menos uma consultora ativa.");
      } else if (atribuidos === 0) {
        toast.info("Nenhum registro sem consultora para atribuir.");
      } else {
        toast.success(`${atribuidos} registro(s) atribuído(s) entre ${nConsultoras} consultora(s).`);
      }
      await load();
    } catch (e: any) {
      toast.error(e?.message ?? "Erro ao atribuir registros.");
    } finally {
      setAtribuindoTodos(false);
    }
  };



  const consultoraOptions = useMemo(
    () => Array.from(new Set([...consultoras.map((c) => c.nome), ...distribuicao.map((d) => d.consultora)])),
    [consultoras, distribuicao],
  );



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
    const termDigits = term.replace(/\D/g, "");
    const isNumericTerm = term.length > 0 && /^[\d.\-\s]+$/.test(term);
    const cpfTerm = cpfQ.replace(/\D/g, "");
    const ab = (r: DoRegistro) => (r.status_abordagem || "novo");
    const filtered = list.filter((r) => {
      if (term) {
        const cpfDigits = (r.cpf_parcial || "").replace(/\D/g, "");
        const nameHit = r.nome_servidor.toLowerCase().includes(term);
        const cpfHit = isNumericTerm && termDigits.length > 0 && cpfDigits.includes(termDigits);
        if (!nameHit && !cpfHit) return false;
      }
      if (cpfTerm) {
        const cpfDigits = (r.cpf_parcial || "").replace(/\D/g, "");
        if (!cpfDigits.includes(cpfTerm)) return false;
      }
      if (orgao !== "todos" && r.orgao !== orgao) return false;
      if (tipo !== "todos" && (r.categoria || r.tipo_movimentacao) !== tipo) return false;
      if (status !== "todos" && r.status_revisao !== status) return false;
      if (abordagem !== "todos" && ab(r) !== abordagem) return false;
      if (potencial !== "todos" && (r.potencial_financeiro || "") !== potencial) return false;
      if (consultora !== "todos" && (r.consultora_responsavel || "") !== consultora) return false;
      if (data && r.data_publicacao !== data) return false;
      return true;
    });

    // Ordenação inteligente focada em abordagem comercial:
    // 1) Alto + novo, 2) Médio + novo, 3) demais novos, 4) já trabalhados.
    const rank = (r: DoRegistro) => {
      const novo = ab(r) === "novo";
      const pot = r.potencial_financeiro || "";
      if (novo && pot === "Alto") return 0;
      if (novo && pot === "Médio") return 1;
      if (novo) return 2;
      if (ab(r) === "contatado" || ab(r) === "proposta_enviada") return 3;
      if (ab(r) === "convertido") return 4;
      return 5; // sem_interesse
    };
    return [...filtered].sort((a, b) => {
      const ra = rank(a);
      const rb = rank(b);
      if (ra !== rb) return ra - rb;
      return (b.data_publicacao || "").localeCompare(a.data_publicacao || "");
    });
  }, [list, q, cpfQ, orgao, tipo, status, abordagem, potencial, consultora, data]);

  const setAbordagemFor = async (id: string, novo: string) => {
    const prev = list;
    setList((l) =>
      l.map((r) =>
        r.id === id
          ? { ...r, status_abordagem: novo, contatado_em: novo === "contatado" ? new Date().toISOString() : r.contatado_em }
          : r,
      ),
    );
    try {
      await abordagemFn({ data: { id, status: novo as any } });
      toast.success(`Marcado como ${ABORDAGEM_LABEL[novo] ?? novo}.`);
    } catch (e: any) {
      toast.error(e?.message ?? "Erro ao atualizar abordagem.");
      setList(prev);
    }
  };


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
        <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-4 xl:grid-cols-8">
          <div className="relative lg:col-span-2">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input className="pl-9" placeholder="Buscar por nome ou CPF…" value={q} onChange={(e) => setQ(e.target.value)} />
          </div>
          <div className="relative lg:col-span-2">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input className="pl-9" placeholder="Filtrar por CPF…" value={cpfQ} onChange={(e) => setCpfQ(e.target.value)} />
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
          <Select value={abordagem} onValueChange={setAbordagem}>
            <SelectTrigger><SelectValue placeholder="Abordagem" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Toda abordagem</SelectItem>
              {ABORDAGEM_OPTIONS.map((a) => <SelectItem key={a.value} value={a.value}>{a.label}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={consultora} onValueChange={setConsultora}>
            <SelectTrigger><SelectValue placeholder="Consultora" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todas as consultoras</SelectItem>
              {consultoraOptions.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
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

      {/* Distribuição automática de Leads */}
      <Card className="p-4">
        <div className="flex items-center gap-2">
          <Users className="h-4 w-4 text-primary" />
          <h3 className="text-sm font-semibold">Distribuição automática de Leads</h3>
        </div>
        <p className="mt-1 text-xs text-muted-foreground">
          Cada novo registro elegível (potencial alto/médio e ainda não abordado) é atribuído
          <strong> automaticamente</strong>, em rodízio, à consultora ativa com menos leads — direto no banco,
          assim que o registro é inserido. Use <strong>Redistribuir pendentes</strong> para leads que ficaram sem consultora.
        </p>

        {/* Cadastro de consultoras */}
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <Input
            className="w-56"
            placeholder="Nome da consultora…"
            value={novaConsultora}
            onChange={(e) => setNovaConsultora(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") handleAddConsultora(); }}
          />
          <Input
            className="w-64"
            type="email"
            placeholder="E-mail de login (opcional)…"
            value={novaConsultoraEmail}
            onChange={(e) => setNovaConsultoraEmail(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") handleAddConsultora(); }}
          />
          <Button onClick={handleAddConsultora} disabled={savingConsultora} variant="secondary">
            {savingConsultora ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : <UserPlus className="mr-1 h-4 w-4" />}
            Adicionar consultora
          </Button>
          <Button onClick={distribuirAgora} disabled={atribuindo}>
            {atribuindo ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : <Users className="mr-1 h-4 w-4" />}
            Redistribuir pendentes
          </Button>
        </div>

        {consultoras.length > 0 && (
          <div className="mt-3 flex flex-wrap gap-2">
            {consultoras.map((c) => {
              const total = c.total_leads_atribuidos ?? 0;
              return (
                <div
                  key={c.id}
                  className={`flex items-center gap-2 rounded-md border px-2 py-1 text-xs ${c.ativo ? "border-primary/40 bg-primary/5" : "border-muted bg-muted/30 opacity-60"}`}
                >
                  <button
                    type="button"
                    onClick={() => handleToggleConsultora(c)}
                    title={c.ativo ? "Ativa — clique para pausar" : "Pausada — clique para ativar"}
                    className="flex items-center gap-1 font-medium"
                  >
                    <span className={`inline-block h-2 w-2 rounded-full ${c.ativo ? "bg-green-500" : "bg-muted-foreground"}`} />
                    {c.nome}
                    {c.email && <span className="font-normal text-muted-foreground">· {c.email}</span>}
                  </button>
                  <Badge variant="secondary" className="text-[10px]">{total} lead{total === 1 ? "" : "s"}</Badge>
                  <button
                    type="button"
                    onClick={() => handleRemoverConsultora(c)}
                    title="Remover consultora"
                    className="text-muted-foreground hover:text-destructive"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </div>
              );
            })}
          </div>
        )}
        {consultoras.length === 0 && (
          <p className="mt-3 text-xs text-amber-600">
            Nenhuma consultora cadastrada. Cadastre consultoras para ativar a distribuição automática.
          </p>
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
            const ab = r.status_abordagem || "novo";
            const potText =
              r.potencial_financeiro === "Alto" ? "🟢 ALTO" :
              r.potencial_financeiro === "Médio" ? "🟡 MÉDIO" :
              r.potencial_financeiro || "";
            const showFullTrecho = trechoOpen.has(r.id);
            return (
              <Card key={r.id} className={`overflow-hidden border-2 ${abordagemBorder(ab)}`}>
                <div className="p-3">
                  <div className="flex flex-wrap items-center gap-3">
                    <button
                      className="flex flex-1 items-center gap-3 text-left"
                      onClick={() => setExpanded(open ? null : r.id)}
                    >
                      {open ? <ChevronUp className="h-4 w-4 shrink-0" /> : <ChevronDown className="h-4 w-4 shrink-0" />}
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                          <span className="font-semibold">{r.nome_servidor}</span>
                          {r.orgao && <span className="truncate text-xs text-muted-foreground">{r.orgao}</span>}
                          {(r.categoria || r.tipo_movimentacao) && (
                            <span className="truncate text-xs text-muted-foreground">· {r.categoria || r.tipo_movimentacao}</span>
                          )}
                          {r.data_publicacao && <span className="text-xs text-muted-foreground">· {r.data_publicacao}</span>}
                        </div>
                        {r.data_publicacao && (
                          <p className="mt-0.5 text-xs font-semibold text-blue-600 dark:text-blue-400">
                            📅 {fmtBR(r.data_publicacao)}
                          </p>
                        )}
                        <p className="mt-0.5 text-xs text-muted-foreground">
                          {r.cpf_parcial && <span className="font-semibold text-primary">CPF: {r.cpf_parcial}</span>}
                          {r.cpf_parcial && r.matricula && "   "}
                          {r.matricula && <span>Matrícula: {r.matricula}</span>}
                        </p>
                      </div>
                    </button>
                    {potText && (
                      <Badge className={`text-xs ${potencialTone(r.potencial_financeiro || "")}`}>{potText}</Badge>
                    )}
                    {ab !== "novo" && (
                      <Badge variant="outline" className="text-xs">{ABORDAGEM_LABEL[ab] ?? ab}</Badge>
                    )}
                    {r.duplicado_possivel && <Badge className="bg-orange-500 text-white">duplicado?</Badge>}
                    {r.consultora_responsavel && (
                      <Badge className="bg-purple-100 text-purple-800 dark:bg-purple-900/40 dark:text-purple-200 text-xs">
                        <Users className="mr-1 h-3 w-3" /> {r.consultora_responsavel}
                      </Badge>
                    )}
                  </div>
                  <div className="mt-2 flex flex-wrap gap-2">
                    <Button
                      size="sm"
                      className="bg-blue-600 hover:bg-blue-700"
                      disabled={ab === "contatado"}
                      onClick={() => setAbordagemFor(r.id, "contatado")}
                    >
                      <Phone className="mr-1 h-4 w-4" /> ABORDAR
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => setStatusFor(r.id, "Revisado")}>
                      <Check className="mr-1 h-4 w-4" /> REVISADO
                    </Button>
                    <Select value={ab} onValueChange={(v) => setAbordagemFor(r.id, v)}>
                      <SelectTrigger className="h-8 w-[160px] text-xs"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {ABORDAGEM_OPTIONS.map((a) => <SelectItem key={a.value} value={a.value}>{a.label}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                {open && (
                  <div className="border-t bg-muted/30 p-4">
                    {r.data_publicacao && (
                      <div className="mb-3 inline-flex items-center gap-2 rounded-md border border-emerald-300 bg-emerald-50 px-3 py-1.5 text-sm font-semibold text-emerald-800 dark:border-emerald-900/50 dark:bg-emerald-950/40 dark:text-emerald-200">
                        🎉 Promovido em {fmtBR(r.data_publicacao)}
                      </div>
                    )}
                    <div className="grid gap-2 text-sm md:grid-cols-2">
                      <div>🧑 <span className="text-muted-foreground">Nome:</span> <strong>{r.nome_servidor}</strong></div>
                      <div>🪪 <span className="text-muted-foreground">CPF:</span> <strong>{r.cpf_parcial || "—"}</strong></div>
                      <div>🏛️ <span className="text-muted-foreground">Órgão:</span> <strong>{r.orgao || "—"}</strong></div>
                      <div>💼 <span className="text-muted-foreground">Tipo:</span> <strong>{r.categoria || r.tipo_movimentacao || "—"}</strong></div>
                      <div>📅 <span className="text-muted-foreground">Data do ato:</span> <strong>{r.data_ato || r.data_publicacao || "—"}</strong></div>
                      <div>🏷️ <span className="text-muted-foreground">Matrícula:</span> <strong>{r.matricula || "—"}</strong></div>
                    </div>

                    <div className="mt-3 grid gap-2 text-sm md:grid-cols-2 lg:grid-cols-3">
                      <Info label="Página" value={r.pagina} />
                      <Info label="Nº ato" value={r.numero_ato} />
                      <Info label="Confiança IA" value={r.confianca_ia} />
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
                      <div className="mt-3">
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() =>
                            setTrechoOpen((prev) => {
                              const next = new Set(prev);
                              if (next.has(r.id)) next.delete(r.id);
                              else next.add(r.id);
                              return next;
                            })
                          }
                        >
                          {showFullTrecho ? "ocultar trecho" : "ver trecho completo"}
                        </Button>
                        {showFullTrecho && (
                          <div className="mt-2 rounded-md border bg-background p-3 text-sm italic text-muted-foreground">
                            “{r.trecho_original}”
                          </div>
                        )}
                      </div>
                    )}

                    <Roteiro nome={r.nome_servidor} data={r.data_publicacao} />

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

// Roteiro de abordagem comercial fixo, exibido no card expandido.
function Roteiro({ nome, data }: { nome: string; data: string | null }) {
  const dataFmt = fmtBR(data);
  const copiarNome = async () => {
    try {
      await navigator.clipboard.writeText(nome);
      toast.success("Nome copiado.");
    } catch {
      toast.error("Não foi possível copiar.");
    }
  };
  return (
    <div className="mt-4 rounded-lg border border-blue-200 bg-blue-50/60 p-4 dark:border-blue-900/40 dark:bg-blue-950/20">
      <h4 className="mb-3 text-sm font-semibold">📋 Roteiro de Abordagem</h4>
      <div className="space-y-3 text-sm">
        <div>
          <p className="font-semibold">PASSO 1 — Localizar no Nova Vida</p>
          <p className="mt-1 flex flex-wrap items-center gap-1 text-muted-foreground">
            → Abrir sistema Nova Vida e buscar pelo nome:{" "}
            <strong className="text-foreground">{nome}</strong>
            <Button size="sm" variant="ghost" className="h-6 px-2" onClick={copiarNome}>
              <Copy className="h-3 w-3" />
            </Button>
          </p>
          <p className="text-muted-foreground">→ Verificar estado/situação atual da pessoa</p>
        </div>
        <div>
          <p className="font-semibold">PASSO 2 — Verificar margem disponível</p>
          <p className="mt-1 text-muted-foreground">→ Checar margem consignável atual no sistema</p>
          <p className="text-muted-foreground">
            → Confirmar aumento de margem pela promoção de{" "}
            <strong className="text-foreground">{dataFmt || "—"}</strong>
          </p>
        </div>
        <div>
          <p className="font-semibold">PASSO 3 — Abordar o servidor</p>
          <p className="mt-1 text-muted-foreground">
            → Parabenizar pela promoção: "Vi que você foi promovido(a) em {dataFmt || "—"}"
          </p>
          <p className="text-muted-foreground">
            → Apresentar oferta de crédito consignado com nova margem ampliada
          </p>
        </div>
      </div>
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
