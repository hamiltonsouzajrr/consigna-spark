import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState, useCallback } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useRhAccess } from "@/hooks/use-rh-access";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import {
  Play, RefreshCw, ExternalLink, Loader2, Bell, CalendarSearch, FileText,
  CheckCircle2, AlertTriangle, Clock, ListChecks, XCircle,
} from "lucide-react";
import {
  getBuscaDiariaDashboard, getFontes, getAlertas, getLogsAutomacao,
  rodarBuscaAgora, buscarPorData, buscarIntervaloDias, reprocessarFonteFn,
  marcarAlertaLido, getFontePdfUrl, extrairMes2026,
  type BuscaDiariaDashboard, type Fonte, type Alerta, type LogAutomacao, type ResultadoBuscaDTO,
} from "@/lib/radar/diario.functions";

export const Route = createFileRoute("/radar/busca-diaria")({
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

function BuscaDiariaPage() {
  const { isAdmin } = useRhAccess();

  const fnDashboard = useServerFn(getBuscaDiariaDashboard);
  const fnFontes = useServerFn(getFontes);
  const fnAlertas = useServerFn(getAlertas);
  const fnLogs = useServerFn(getLogsAutomacao);
  const fnRodar = useServerFn(rodarBuscaAgora);
  const fnPorData = useServerFn(buscarPorData);
  const fnIntervalo = useServerFn(buscarIntervaloDias);
  const fnReprocessar = useServerFn(reprocessarFonteFn);
  const fnMarcarLido = useServerFn(marcarAlertaLido);
  const fnPdfUrl = useServerFn(getFontePdfUrl);
  const fnExtrairMes = useServerFn(extrairMes2026);

  const [dash, setDash] = useState<BuscaDiariaDashboard | null>(null);
  const [fontes, setFontes] = useState<Fonte[]>([]);
  const [alertas, setAlertas] = useState<Alerta[]>([]);
  const [logs, setLogs] = useState<LogAutomacao[]>([]);
  const [loading, setLoading] = useState(true);
  const [running, setRunning] = useState<string | null>(null);
  const [dataEspecifica, setDataEspecifica] = useState("");
  const [anoProgresso, setAnoProgresso] = useState<string | null>(null);
  const [pendProgresso, setPendProgresso] = useState<string | null>(null);

  const carregar = useCallback(async () => {
    try {
      const [d, f, a, l] = await Promise.all([fnDashboard(), fnFontes(), fnAlertas(), fnLogs()]);
      setDash(d); setFontes(f); setAlertas(a); setLogs(l);
    } catch (e: any) {
      toast.error(e?.message ?? "Falha ao carregar painel.");
    } finally {
      setLoading(false);
    }
  }, [fnDashboard, fnFontes, fnAlertas, fnLogs]);

  useEffect(() => { carregar(); }, [carregar]);

  const reportar = (r: ResultadoBuscaDTO) => {
    if (r.arquivos_encontrados === 0) {
      toast.info("Nenhuma edição encontrada para o período.");
    } else {
      toast.success(`${r.arquivos_baixados} PDF(s) baixado(s), ${r.registros_extraidos} registro(s) extraído(s).`);
    }
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

  // Extrai todo o ano de 2026 retroativamente, mês a mês (jan-jun). Cada mês é
  // uma requisição separada para não estourar o tempo limite do servidor. Como
  // edições já baixadas são puladas (dedup), pode ser re-executado para retomar.
  const MESES_2026 = [
    { n: 1, nome: "Janeiro" }, { n: 2, nome: "Fevereiro" }, { n: 3, nome: "Março" },
    { n: 4, nome: "Abril" }, { n: 5, nome: "Maio" }, { n: 6, nome: "Junho" },
  ];
  const extrairTodo2026 = async () => {
    setRunning("ano2026");
    const total: ResultadoBuscaDTO = {
      arquivos_encontrados: 0, arquivos_baixados: 0, registros_extraidos: 0,
      duracao_ms: 0, duplicados: 0, requer_ocr: 0, erros: [], fontes: [],
    };
    try {
      for (const m of MESES_2026) {
        setAnoProgresso(`Processando ${m.nome}/2026… (${m.n} de ${MESES_2026.length})`);
        try {
          const r = await fnExtrairMes({ data: { mes: m.n } });
          total.arquivos_encontrados += r.arquivos_encontrados;
          total.arquivos_baixados += r.arquivos_baixados;
          total.registros_extraidos += r.registros_extraidos;
          total.requer_ocr += r.requer_ocr;
          total.erros.push(...r.erros);
        } catch (e: any) {
          total.erros.push(`${m.nome}: ${e?.message ?? "falha"}`);
          toast.error(`Falha em ${m.nome}/2026: ${e?.message ?? "erro"}`);
        }
        await carregar();
      }
      toast.success(
        `2026 concluído: ${total.arquivos_baixados} PDF(s) novo(s), ${total.registros_extraidos} registro(s).`,
      );
      if (total.requer_ocr > 0) toast.info(`${total.requer_ocr} edição(ões) exigem OCR (processar pela aba Importar).`);
      if (total.erros.length) toast.error(`${total.erros.length} erro(s) durante a extração do ano.`);
    } finally {
      setAnoProgresso(null);
      setRunning(null);
    }
  };

  // Processa todos os PDFs já baixados que ainda estão aguardando análise.
  // Percorre fonte por fonte (cada uma é uma requisição) e mostra o progresso.
  const processarPendentes = async () => {
    const pend = fontes.filter(
      (f) =>
        f.caminho_arquivo &&
        ["pendente", "processando", "requer_ocr", "erro"].includes(
          (f.status_processamento ?? "").toLowerCase(),
        ),
    );
    if (!pend.length) {
      toast.info("Nenhum arquivo pendente para processar.");
      return;
    }
    setRunning("pendentes");
    let ok = 0;
    let registros = 0;
    const erros: string[] = [];
    try {
      for (let i = 0; i < pend.length; i++) {
        setPendProgresso(`Processando ${i + 1} de ${pend.length}…`);
        try {
          const r = await fnReprocessar({ data: { id: pend[i].id } });
          registros += r.registros_extraidos;
          erros.push(...r.erros);
          ok++;
        } catch (e: any) {
          erros.push(`${pend[i].numero_edicao ?? pend[i].id}: ${e?.message ?? "falha"}`);
        }
        await carregar();
      }
      toast.success(`Processados ${ok}/${pend.length} arquivo(s), ${registros} registro(s) extraído(s).`);
      if (erros.length) toast.error(`${erros.length} erro(s) durante o processamento.`);
    } finally {
      setPendProgresso(null);
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
          Busca automática de promoções, progressões e eventos funcionais publicados no Diário Oficial de Alagoas.
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
          {dash?.ultimaEdicao?.titulo && (
            <p className="mt-1 truncate text-xs text-muted-foreground" title={dash.ultimaEdicao.titulo}>
              {dash.ultimaEdicao.titulo}
            </p>
          )}
        </Card>
      </div>

      {/* Ações */}
      <Card className="space-y-3 p-4">
        <h3 className="text-sm font-semibold">Ações</h3>
        {!isAdmin && (
          <p className="text-xs text-muted-foreground">As ações de busca são restritas a administradores.</p>
        )}
        <div className="flex flex-wrap items-center gap-2">
          <Button disabled={!isAdmin || !!running} onClick={() => runAction("hoje", () => fnRodar())}>
            {running === "hoje" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4" />}
            Rodar busca agora
          </Button>
          <Button variant="outline" disabled={!isAdmin || !!running} onClick={() => runAction("7", () => fnIntervalo({ data: { dias: 7 } }))}>
            {running === "7" ? <Loader2 className="h-4 w-4 animate-spin" /> : <CalendarSearch className="h-4 w-4" />}
            Últimos 7 dias
          </Button>
          <Button variant="outline" disabled={!isAdmin || !!running} onClick={() => runAction("30", () => fnIntervalo({ data: { dias: 30 } }))}>
            {running === "30" ? <Loader2 className="h-4 w-4 animate-spin" /> : <CalendarSearch className="h-4 w-4" />}
            Últimos 30 dias
          </Button>
          <div className="flex items-center gap-2">
            <Input
              type="date"
              value={dataEspecifica}
              onChange={(e) => setDataEspecifica(e.target.value)}
              className="w-[170px]"
              disabled={!isAdmin || !!running}
            />
            <Button
              variant="outline"
              disabled={!isAdmin || !!running || !dataEspecifica}
              onClick={() => runAction("data", () => fnPorData({ data: { data: dataEspecifica } }))}
            >
              {running === "data" ? <Loader2 className="h-4 w-4 animate-spin" /> : <CalendarSearch className="h-4 w-4" />}
              Buscar data
            </Button>
          </div>
          <Button variant="ghost" disabled={!!running} onClick={carregar}>
            <RefreshCw className="h-4 w-4" /> Atualizar
          </Button>
        </div>

        <div className="rounded-lg border border-primary/30 bg-primary/5 p-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="min-w-0">
              <p className="text-sm font-semibold">Extração retroativa de 2026</p>
              <p className="text-xs text-muted-foreground">
                Percorre janeiro a junho de 2026 e baixa/processa todas as edições. Edições já
                baixadas são puladas — pode rodar de novo para retomar.
              </p>
            </div>
            <Button
              variant="default"
              disabled={!isAdmin || !!running}
              onClick={extrairTodo2026}
            >
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
          Os registros extraídos aparecem em{" "}
          <Link to="/radar/registros" className="font-medium text-primary underline">Registros</Link>, com filtros e exportação.
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
                {!a.lido && (
                  <Button size="sm" variant="ghost" onClick={() => marcarLido(a.id)}>Lido</Button>
                )}
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* Fontes */}
      <Card className="p-4">
        <h3 className="mb-3 text-sm font-semibold">Edições encontradas</h3>
        {fontes.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nenhuma edição registrada ainda. Use "Rodar busca agora".</p>
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
