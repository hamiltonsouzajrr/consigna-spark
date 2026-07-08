import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState, useCallback, useRef } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useRhAccess } from "@/hooks/use-rh-access";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { toast } from "sonner";
import {
  Play, RefreshCw, ExternalLink, Loader2, Bell, CalendarSearch, FileText,
  CheckCircle2, AlertTriangle, Clock, ListChecks, XCircle, Download, Search,
} from "lucide-react";
import {
  getBuscaDiariaDashboard, getFontes, getAlertas, getLogsAutomacao,
  rodarBuscaAgora, reprocessarFonteFn, marcarAlertaLido, getFontePdfUrl, extrairMes2026,
  iniciarBuscaPromocoes, processarProximoDaFilaFn, getBuscaJob, getJobAtivo, getPromovidosPeriodo,
  type BuscaDiariaDashboard, type Fonte, type Alerta, type LogAutomacao, type ResultadoBuscaDTO,
  type BuscaJob, type PromovidoPeriodo,
} from "@/lib/radar/diario.functions";
import { getCobertura2026, type CoberturaMes } from "@/lib/radar/radar.functions";

export const Route = createFileRoute("/_authenticated/radar/busca-diaria")({
  ssr: false,
  component: BuscaDiariaPage,
});

function statusTone(s: string): string {
  if (["concluido"].includes(s)) return "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-200";
  if (["erro"].includes(s)) return "bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-200";
  if (["requer_ocr"].includes(s)) return "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-200";
  return "bg-slate-100 text-slate-700 dark:bg-slate-800/60 dark:text-slate-300";
}

function sevTone(s: string): string {
  switch (s) {
    case "sucesso": return "border-emerald-200 bg-emerald-50 dark:border-emerald-900/40 dark:bg-emerald-950/30";
    case "erro": return "border-red-200 bg-red-50 dark:border-red-900/40 dark:bg-red-950/30";
    case "alerta": return "border-amber-200 bg-amber-50 dark:border-amber-900/40 dark:bg-amber-950/30";
    default: return "border-border bg-muted/40";
  }
}

function fmtDateTime(s: string | null): string {
  if (!s) return "—";
  return new Date(s).toLocaleString("pt-BR", { timeZone: "America/Maceio" });
}

function fmtDate(s: string | null): string {
  if (!s) return "—";
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s);
  if (m) return `${m[3]}/${m[2]}/${m[1]}`;
  return s;
}

function Kpi({ label, value, icon: Icon, tone }: { label: string; value: number | string; icon: any; tone?: string }) {
  return (
    <Card className="p-4">
      <div className="flex items-center gap-3">
        <div className={`flex h-9 w-9 items-center justify-center rounded-lg ${tone ?? "bg-primary/10 text-primary"}`}>
          <Icon className="h-5 w-5" />
        </div>
        <div>
          <p className="text-2xl font-bold leading-none">{value}</p>
          <p className="mt-1 text-xs text-muted-foreground">{label}</p>
        </div>
      </div>
    </Card>
  );
}

type Periodo = "semana" | "mes" | "trimestre";
const PERIODOS: { key: Periodo; label: string }[] = [
  { key: "semana", label: "Esta semana" },
  { key: "mes", label: "Este mês" },
  { key: "trimestre", label: "Este trimestre" },
];

function csvEscape(v: unknown): string {
  const s = String(v ?? "");
  return /[",\n;]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

function BuscaDiariaPage() {
  const { isAdmin } = useRhAccess();

  const fnDashboard = useServerFn(getBuscaDiariaDashboard);
  const fnFontes = useServerFn(getFontes);
  const fnAlertas = useServerFn(getAlertas);
  const fnLogs = useServerFn(getLogsAutomacao);
  const fnRodar = useServerFn(rodarBuscaAgora);
  const fnReprocessar = useServerFn(reprocessarFonteFn);
  const fnMarcarLido = useServerFn(marcarAlertaLido);
  const fnPdfUrl = useServerFn(getFontePdfUrl);
  const fnExtrairMes = useServerFn(extrairMes2026);
  const fnCobertura = useServerFn(getCobertura2026);
  const fnIniciar = useServerFn(iniciarBuscaPromocoes);
  const fnProximo = useServerFn(processarProximoDaFilaFn);
  const fnGetJob = useServerFn(getBuscaJob);
  const fnJobAtivo = useServerFn(getJobAtivo);
  const fnPromovidos = useServerFn(getPromovidosPeriodo);

  const [dash, setDash] = useState<BuscaDiariaDashboard | null>(null);
  const [fontes, setFontes] = useState<Fonte[]>([]);
  const [alertas, setAlertas] = useState<Alerta[]>([]);
  const [logs, setLogs] = useState<LogAutomacao[]>([]);
  const [loading, setLoading] = useState(true);
  const [running, setRunning] = useState<string | null>(null);
  const [anoProgresso, setAnoProgresso] = useState<string | null>(null);
  const [cobertura, setCobertura] = useState<CoberturaMes[]>([]);

  const [periodo, setPeriodo] = useState<Periodo>("semana");
  const [job, setJob] = useState<BuscaJob | null>(null);
  const [promovidos, setPromovidos] = useState<PromovidoPeriodo[]>([]);
  const [carregandoResultados, setCarregandoResultados] = useState(false);
  const drivingRef = useRef(false);

  const carregar = useCallback(async () => {
    try {
      const [d, f, a, l, c] = await Promise.all([fnDashboard(), fnFontes(), fnAlertas(), fnLogs(), fnCobertura()]);
      setDash(d); setFontes(f); setAlertas(a); setLogs(l); setCobertura(c);
    } catch (e: any) {
      toast.error(e?.message ?? "Falha ao carregar painel.");
    } finally {
      setLoading(false);
    }
  }, [fnDashboard, fnFontes, fnAlertas, fnLogs, fnCobertura]);

  const carregarPromovidos = useCallback(
    async (j: BuscaJob | null) => {
      if (!j?.date_from || !j?.date_to) return;
      setCarregandoResultados(true);
      try {
        const rows = await fnPromovidos({ data: { dateFrom: j.date_from, dateTo: j.date_to } });
        setPromovidos(rows);
      } catch (e: any) {
        toast.error(e?.message ?? "Falha ao carregar resultados.");
      } finally {
        setCarregandoResultados(false);
      }
    },
    [fnPromovidos],
  );

  // Processa a fila do job em loop no cliente (progresso imediato enquanto a tela
  // está aberta). Se o usuário sair, o cron continua o processamento.
  const driveJob = useCallback(
    async (jobId: string) => {
      if (drivingRef.current) return;
      drivingRef.current = true;
      try {
        let finalJob: BuscaJob | null = null;
        while (true) {
          const prog = await fnProximo({ data: { jobId } });
          const j = await fnGetJob({ data: { jobId } });
          if (j) setJob(j);
          finalJob = j;
          if (prog.done) break;
        }
        toast.success("Busca de promoções concluída.");
        await carregarPromovidos(finalJob);
        await carregar();
      } catch (e: any) {
        toast.error(e?.message ?? "Falha durante a busca.");
      } finally {
        drivingRef.current = false;
      }
    },
    [fnProximo, fnGetJob, carregarPromovidos, carregar],
  );

  useEffect(() => {
    carregar();
    // Retoma um job em andamento ao abrir a tela.
    (async () => {
      try {
        const ativo = await fnJobAtivo();
        if (ativo) {
          setJob(ativo);
          if (ativo.periodo) setPeriodo(ativo.periodo as Periodo);
          driveJob(ativo.id);
        }
      } catch {
        /* ignora */
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const iniciarBusca = async () => {
    if (drivingRef.current) {
      toast.info("Já existe uma busca em andamento.");
      return;
    }
    setRunning("periodo");
    setPromovidos([]);
    try {
      const { jobId, total } = await fnIniciar({ data: { periodo } });
      const j = await fnGetJob({ data: { jobId } });
      setJob(j);
      if (total === 0) {
        toast.info("Nenhuma edição encontrada no período selecionado.");
        await carregarPromovidos(j);
      } else {
        toast.success(`${total} edição(ões) enfileirada(s). Processando…`);
        driveJob(jobId);
      }
    } catch (e: any) {
      toast.error(e?.message ?? "Falha ao iniciar a busca.");
    } finally {
      setRunning(null);
    }
  };

  const reportar = (r: ResultadoBuscaDTO) => {
    if (r.arquivos_encontrados === 0) toast.info("Nenhuma edição encontrada.");
    else toast.success(`${r.arquivos_baixados} PDF(s), ${r.registros_extraidos} registro(s).`);
    if (r.erros.length) toast.error(`${r.erros.length} erro(s) durante o processamento.`);
  };

  const runAction = async (key: string, fn: () => Promise<ResultadoBuscaDTO>) => {
    setRunning(key);
    try {
      const r = await fn();
      reportar(r);
      await carregar();
    } catch (e: any) {
      toast.error(e?.message ?? "Falha na execução.");
    } finally {
      setRunning(null);
    }
  };

  const MESES_2026 = [
    { n: 1, nome: "Janeiro" }, { n: 2, nome: "Fevereiro" }, { n: 3, nome: "Março" },
    { n: 4, nome: "Abril" }, { n: 5, nome: "Maio" }, { n: 6, nome: "Junho" },
  ];
  const extrairTodo2026 = async () => {
    setRunning("ano2026");
    let baixados = 0, registros = 0, ocr = 0;
    const erros: string[] = [];
    try {
      for (const m of MESES_2026) {
        setAnoProgresso(`Processando ${m.nome}/2026… (${m.n} de ${MESES_2026.length})`);
        try {
          const r = await fnExtrairMes({ data: { mes: m.n } });
          baixados += r.arquivos_baixados; registros += r.registros_extraidos; ocr += r.requer_ocr;
          erros.push(...r.erros);
        } catch (e: any) {
          erros.push(`${m.nome}: ${e?.message ?? "falha"}`);
        }
        await carregar();
      }
      toast.success(`2026 concluído: ${baixados} PDF(s) novo(s), ${registros} registro(s).`);
      if (ocr > 0) toast.info(`${ocr} edição(ões) exigem OCR (aba Importar).`);
      if (erros.length) toast.error(`${erros.length} erro(s) durante a extração do ano.`);
    } finally {
      setAnoProgresso(null);
      setRunning(null);
    }
  };

  const abrirPdf = async (caminho: string | null) => {
    if (!caminho) { toast.error("PDF não disponível."); return; }
    try {
      const { url } = await fnPdfUrl({ data: { caminho } });
      window.open(url, "_blank");
    } catch (e: any) {
      toast.error(e?.message ?? "Falha ao abrir PDF.");
    }
  };

  const marcarLido = async (id?: string, todos?: boolean) => {
    try {
      await fnMarcarLido({ data: { id, todos } });
      await carregar();
    } catch (e: any) {
      toast.error(e?.message ?? "Falha.");
    }
  };

  const exportarCsv = () => {
    if (!promovidos.length) { toast.info("Nada para exportar."); return; }
    const header = [
      "Nome completo", "Cargo atual", "Cargo/classe promovido", "Data da promoção",
      "CPF parcial", "Nome parcial", "Matrícula", "Órgão/lotação",
    ];
    const linhas = promovidos.map((p) => [
      p.nome_completo || p.nome_servidor,
      p.cargo_atual ?? "",
      p.cargo_promovido ?? "",
      fmtDate(p.data_promocao ?? p.data_publicacao),
      p.cpf_parcial ?? "",
      p.nome_parcial ?? "",
      p.matricula ?? "",
      p.orgao_lotacao ?? "",
    ]);
    const csv = [header, ...linhas].map((r) => r.map(csvEscape).join(";")).join("\n");
    const blob = new Blob([`\uFEFF${csv}`], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `promovidos-${job?.periodo ?? "periodo"}-${job?.date_from ?? ""}_a_${job?.date_to ?? ""}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const jobAtivoRodando = !!job && ["running", "queued"].includes(job.status) && (job.total ?? 0) > 0;
  const pct = job && job.total > 0 ? Math.round((job.processed / job.total) * 100) : 0;

  if (loading) {
    return (
      <div className="flex min-h-[30vh] items-center justify-center text-muted-foreground">
        <Loader2 className="h-6 w-6 animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold">Busca Diária do Diário Oficial</h2>
        <p className="text-sm text-muted-foreground">
          Busca automática de servidores promovidos publicados no Diário Oficial de Alagoas.
          A automação roda em dias úteis às 06:30.
        </p>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Kpi label="PDFs baixados hoje" value={dash?.pdfsHoje ?? 0} icon={FileText} />
        <Kpi label="Aguardando processamento" value={dash?.aguardandoProcessamento ?? 0} icon={Clock} tone="bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-200" />
        <Kpi label="Registros hoje" value={dash?.registrosHoje ?? 0} icon={ListChecks} />
        <Kpi label="Promoções confirmadas" value={dash?.promocoesConfirmadas ?? 0} icon={CheckCircle2} tone="bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-200" />
        <Kpi label="Pendentes de revisão" value={dash?.pendentesRevisao ?? 0} icon={ListChecks} />
        <Kpi label="Possíveis falsos positivos" value={dash?.falsosPositivos ?? 0} icon={XCircle} tone="bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-200" />
        <Kpi label="Alertas não lidos" value={dash?.alertasNaoLidos ?? 0} icon={Bell} tone="bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-200" />
        <Card className="p-4">
          <p className="text-xs text-muted-foreground">Última consulta</p>
          <p className="mt-1 text-sm font-medium">{fmtDateTime(dash?.ultimaConsulta ?? null)}</p>
        </Card>
      </div>

      {/* Buscar promoções por período */}
      <Card className="space-y-4 p-4">
        <div>
          <h3 className="text-sm font-semibold">Buscar promoções</h3>
          <p className="text-xs text-muted-foreground">
            Escolha o período; o sistema calcula as datas e baixa/analisa as edições do Diário Oficial
            em segundo plano. Você pode sair da tela e voltar depois — o progresso continua.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="flex rounded-lg border p-0.5">
            {PERIODOS.map((p) => (
              <button
                key={p.key}
                type="button"
                disabled={!isAdmin || jobAtivoRodando}
                onClick={() => setPeriodo(p.key)}
                className={`rounded-md px-3 py-1.5 text-sm transition ${
                  periodo === p.key ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted"
                }`}
              >
                {p.label}
              </button>
            ))}
          </div>
          <Button disabled={!isAdmin || jobAtivoRodando || running === "periodo"} onClick={iniciarBusca}>
            {running === "periodo" || jobAtivoRodando ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
            Buscar promoções
          </Button>
        </div>
        {!isAdmin && <p className="text-xs text-muted-foreground">A busca é restrita a administradores.</p>}

        {/* Barra de progresso */}
        {job && (job.total ?? 0) > 0 && (
          <div className="space-y-2 rounded-lg border border-primary/30 bg-primary/5 p-3">
            <div className="flex items-center justify-between text-xs">
              <span className="font-medium">
                {job.periodo_label ?? "Período"} · {fmtDate(job.date_from)} a {fmtDate(job.date_to)}
              </span>
              <span className="text-muted-foreground">
                {job.processed}/{job.total} edições · {job.registros} registros
                {job.erros > 0 ? ` · ${job.erros} erro(s)` : ""}
              </span>
            </div>
            <Progress value={pct} />
            <p className="flex items-center gap-2 text-xs text-muted-foreground">
              {jobAtivoRodando ? (
                <>
                  <Loader2 className="h-3 w-3 animate-spin" />
                  {job.current_label ? `Processando: ${job.current_label}` : "Processando…"}
                </>
              ) : (
                <>
                  <CheckCircle2 className="h-3 w-3 text-emerald-600" />
                  Busca concluída.
                </>
              )}
            </p>
          </div>
        )}
      </Card>

      {/* Resultados: promovidos recentemente */}
      <Card className="space-y-3 p-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h3 className="text-sm font-semibold">Promovidos recentemente</h3>
            <p className="text-xs text-muted-foreground">
              {job?.date_from ? `Período: ${fmtDate(job.date_from)} a ${fmtDate(job.date_to)}` : "Faça uma busca para ver os resultados."}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button size="sm" variant="ghost" disabled={!job || carregandoResultados} onClick={() => carregarPromovidos(job)}>
              {carregandoResultados ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
              Atualizar
            </Button>
            <Button size="sm" variant="outline" disabled={!promovidos.length} onClick={exportarCsv}>
              <Download className="h-4 w-4" /> Exportar CSV
            </Button>
          </div>
        </div>

        {promovidos.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            {carregandoResultados ? "Carregando…" : "Nenhum promovido no período (ou busca ainda não realizada)."}
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left text-xs text-muted-foreground">
                  <th className="py-2 pr-3">Nome completo</th>
                  <th className="py-2 pr-3">Cargo atual</th>
                  <th className="py-2 pr-3">Cargo/classe promovido</th>
                  <th className="py-2 pr-3">Data da promoção</th>
                  <th className="py-2 pr-3">CPF parcial</th>
                  <th className="py-2 pr-3">Nome parcial</th>
                  <th className="py-2 pr-3">Matrícula</th>
                  <th className="py-2 pr-3">Órgão/lotação</th>
                </tr>
              </thead>
              <tbody>
                {promovidos.map((p) => (
                  <tr key={p.id} className="border-b last:border-0 align-top">
                    <td className="py-2 pr-3 font-medium">{p.nome_completo || p.nome_servidor}</td>
                    <td className="py-2 pr-3 max-w-[180px] truncate" title={p.cargo_atual ?? ""}>{p.cargo_atual ?? "—"}</td>
                    <td className="py-2 pr-3 max-w-[200px]">{p.cargo_promovido ?? "—"}</td>
                    <td className="py-2 pr-3 whitespace-nowrap">{fmtDate(p.data_promocao ?? p.data_publicacao)}</td>
                    <td className="py-2 pr-3 whitespace-nowrap">{p.cpf_parcial ?? "—"}</td>
                    <td className="py-2 pr-3">{p.nome_parcial ?? "—"}</td>
                    <td className="py-2 pr-3">{p.matricula ?? "—"}</td>
                    <td className="py-2 pr-3 max-w-[180px] truncate" title={p.orgao_lotacao ?? ""}>{p.orgao_lotacao ?? "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {/* Cobertura 2026 */}
      <Card className="space-y-3 p-4">
        <div>
          <h3 className="text-sm font-semibold">Painel de Cobertura 2026</h3>
          <p className="text-xs text-muted-foreground">Edições do Diário Oficial baixadas e processadas por mês.</p>
        </div>
        <div className="grid grid-cols-3 gap-2 sm:grid-cols-6">
          {MESES_2026.map((m) => {
            const c = cobertura.find((x) => x.mes === m.n) ?? { mes: m.n, total: 0, processadas: 0 };
            const completo = c.total > 0 && c.processadas >= c.total;
            const parcial = c.total > 0 && c.processadas < c.total;
            const icon = completo ? "✅" : parcial ? "⏳" : "❌";
            const tone = completo
              ? "border-emerald-300 bg-emerald-50 dark:border-emerald-900/50 dark:bg-emerald-950/30"
              : parcial
              ? "border-amber-300 bg-amber-50 dark:border-amber-900/50 dark:bg-amber-950/30"
              : "border-border bg-muted/40";
            return (
              <div key={m.n} className={`rounded-lg border p-3 text-center ${tone}`}>
                <p className="text-xs font-semibold uppercase tracking-wide">{m.nome.slice(0, 3)}</p>
                <p className="my-1 text-2xl leading-none">{icon}</p>
                <p className="text-[11px] text-muted-foreground">{c.processadas}/{c.total} edições</p>
              </div>
            );
          })}
        </div>
      </Card>

      {/* Ações complementares */}
      <Card className="space-y-3 p-4">
        <h3 className="text-sm font-semibold">Outras ações</h3>
        <div className="flex flex-wrap items-center gap-2">
          <Button variant="outline" disabled={!isAdmin || !!running} onClick={() => runAction("hoje", () => fnRodar())}>
            {running === "hoje" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4" />}
            Rodar busca de hoje
          </Button>
          <Button variant="ghost" disabled={!!running} onClick={carregar}>
            <RefreshCw className="h-4 w-4" /> Atualizar painel
          </Button>
        </div>

        <div className="rounded-lg border border-primary/30 bg-primary/5 p-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="min-w-0">
              <p className="text-sm font-semibold">Extração retroativa de 2026</p>
              <p className="text-xs text-muted-foreground">
                Percorre janeiro a junho de 2026. Edições já baixadas são puladas — pode rodar de novo para retomar.
              </p>
            </div>
            <Button variant="default" disabled={!isAdmin || !!running} onClick={extrairTodo2026}>
              {running === "ano2026" ? <Loader2 className="h-4 w-4 animate-spin" /> : <CalendarSearch className="h-4 w-4" />}
              EXTRAIR TODO 2026
            </Button>
          </div>
          {anoProgresso && (
            <p className="mt-2 flex items-center gap-2 text-xs font-medium text-primary">
              <Loader2 className="h-3 w-3 animate-spin" /> {anoProgresso}
            </p>
          )}
        </div>

        <p className="text-xs text-muted-foreground">
          Todos os registros extraídos aparecem em{" "}
          <Link to="/radar/registros" className="font-medium text-primary underline">Registros</Link>, com filtros e revisão.
        </p>
      </Card>

      {/* Alertas */}
      {alertas.length > 0 && (
        <Card className="space-y-3 p-4">
          <div className="flex items-center justify-between">
            <h3 className="flex items-center gap-2 text-sm font-semibold">
              <Bell className="h-4 w-4" /> Alertas
            </h3>
            <Button size="sm" variant="ghost" onClick={() => marcarLido(undefined, true)}>Marcar todos como lidos</Button>
          </div>
          <div className="space-y-2">
            {alertas.slice(0, 12).map((a) => (
              <div key={a.id} className={`flex items-start justify-between gap-3 rounded-lg border p-3 ${sevTone(a.severidade)} ${a.lido ? "opacity-60" : ""}`}>
                <div className="min-w-0">
                  <p className="text-sm font-medium">{a.titulo}</p>
                  {a.mensagem && <p className="text-xs text-muted-foreground">{a.mensagem}</p>}
                  <p className="mt-1 text-[11px] text-muted-foreground">{fmtDateTime(a.criado_em)}</p>
                </div>
                {!a.lido && <Button size="sm" variant="ghost" onClick={() => marcarLido(a.id)}>Lido</Button>}
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* Fontes */}
      <Card className="p-4">
        <h3 className="mb-3 text-sm font-semibold">Edições encontradas</h3>
        {fontes.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nenhuma edição registrada ainda. Use "Buscar promoções".</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left text-xs text-muted-foreground">
                  <th className="py-2 pr-3">Data</th>
                  <th className="py-2 pr-3">Edição</th>
                  <th className="py-2 pr-3">Tipo</th>
                  <th className="py-2 pr-3">Download</th>
                  <th className="py-2 pr-3">Processamento</th>
                  <th className="py-2 pr-3">Registros</th>
                  <th className="py-2 pr-3 text-right">Ações</th>
                </tr>
              </thead>
              <tbody>
                {fontes.map((f) => (
                  <tr key={f.id} className="border-b last:border-0">
                    <td className="py-2 pr-3 whitespace-nowrap">{f.data_publicacao ?? "—"}</td>
                    <td className="py-2 pr-3 whitespace-nowrap">
                      {f.numero_edicao ?? "—"} {f.suplemento && <Badge variant="outline" className="ml-1 text-[10px]">Supl.</Badge>}
                    </td>
                    <td className="py-2 pr-3 max-w-[200px] truncate" title={f.tipo_edicao ?? ""}>{f.tipo_edicao ?? "—"}</td>
                    <td className="py-2 pr-3"><span className={`rounded px-2 py-0.5 text-xs ${statusTone(f.status_download)}`}>{f.status_download}</span></td>
                    <td className="py-2 pr-3"><span className={`rounded px-2 py-0.5 text-xs ${statusTone(f.status_processamento)}`}>{f.status_processamento}</span></td>
                    <td className="py-2 pr-3">{f.total_registros_extraidos}</td>
                    <td className="py-2 pr-3">
                      <div className="flex items-center justify-end gap-1">
                        <Button size="sm" variant="ghost" title="Abrir PDF original" onClick={() => abrirPdf(f.caminho_arquivo)}>
                          <ExternalLink className="h-4 w-4" />
                        </Button>
                        {isAdmin && (
                          <Button
                            size="sm"
                            variant="ghost"
                            title="Reprocessar edição"
                            disabled={!!running}
                            onClick={() => runAction(`re-${f.id}`, () => fnReprocessar({ data: { id: f.id } }))}
                          >
                            {running === `re-${f.id}` ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
                          </Button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {/* Logs */}
      <Card className="p-4">
        <h3 className="mb-3 text-sm font-semibold">Histórico da automação</h3>
        {logs.length === 0 ? (
          <p className="text-sm text-muted-foreground">Sem execuções registradas.</p>
        ) : (
          <div className="space-y-2">
            {logs.map((l) => (
              <div key={l.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border p-2 text-xs">
                <span className="font-medium">{fmtDateTime(l.executado_em)}</span>
                <Badge variant="outline">{l.gatilho}</Badge>
                <span className="text-muted-foreground">
                  {l.arquivos_baixados}/{l.arquivos_encontrados} PDFs · {l.registros_extraidos} registros · {(l.duracao_ms / 1000).toFixed(1)}s
                </span>
                {l.erros && (
                  <span className="flex items-center gap-1 text-red-600 dark:text-red-300">
                    <AlertTriangle className="h-3 w-3" /> erro
                  </span>
                )}
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}
