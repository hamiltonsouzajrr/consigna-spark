import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { AppShell } from "@/components/AppShell";
import { supabase } from "@/integrations/supabase/client";
import { useRhAccess } from "@/hooks/use-rh-access";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import { Wallet, Search, Copy, Download, Upload, Users, Shuffle, UserCheck, Phone, RefreshCw, Briefcase, TrendingUp } from "lucide-react";
import { MULT_PRINCIPAL, MULT_CARTAO_BENEFICIO, MULT_CARTAO_CONSIGNADO } from "@/lib/al/credito";
import { COEF_MARGEM_AL_PADRAO } from "@/lib/al/margem";
import { cn } from "@/lib/utils";
import { telLink, whatsappLink } from "@/lib/prospeccao/constants";
import { WhatsAppIcon } from "@/components/WhatsAppIcon";
import { toast } from "sonner";
import tomadoresAsset from "@/assets/tomadores_al.json.asset.json";
import {
  getTomadoresAl, marcarAbordagemTomador, distribuirTomadoresAl, getDistribuicaoTomadoresAl,
  getResumoCarteiraTomadores, importarConsultorasDosAcessos, getContagemFaixasTomadores,
  type TomadorAl, type DistribuicaoConsultora, type ResumoCarteira,
} from "@/lib/prospeccao/tomadores-al.functions";
import {
  TIPOS_MARGEM, FAIXAS_MARGEM, TIPO_MARGEM_LABEL, TIPO_MARGEM_CURTO, FAIXA_LABEL,
  faixaDaMargem, type TipoMargem, type FaixaMargem,
} from "@/lib/prospeccao/margem-faixas";
import {
  getConsultoras, adicionarConsultora, toggleConsultora, type Consultora,
} from "@/lib/radar/radar.functions";

export const Route = createFileRoute("/_authenticated/tomadores-al")({
  head: () => ({
    meta: [
      { title: "Clientes Tomadores com Margem — AL" },
      { name: "description", content: "Base de servidores de Alagoas tomadores de crédito com margem disponível, distribuída automaticamente por consultora." },
      { property: "og:title", content: "Clientes Tomadores com Margem — AL" },
      { property: "og:description", content: "Base de servidores de Alagoas tomadores de crédito com margem disponível." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex,nofollow" },
    ],
  }),
  component: Page,
});

const PAGE_SIZE = 10;

// Mensagem inicial de WhatsApp, personalizada com o primeiro nome do servidor.
function msgWhatsapp(nome?: string | null): string {
  const primeiro = (nome ?? "").trim().split(/\s+/)[0] ?? "";
  const saudacao = primeiro ? `Olá, ${primeiro}!` : "Olá!";
  return `${saudacao} Sou consultor(a) do Grupo Positive. Identifiquei margem disponível no seu contracheque para crédito consignado com desconto em folha. Posso te enviar uma simulação sem compromisso?`;
}

// Motivos rápidos para medir a qualidade do estoque de leads.

const MOTIVOS_SEM_INTERESSE = [
  "Não atende",
  "Sem interesse",
  "Já tem contrato",
  "Margem baixa",
  "Telefone errado",
] as const;

const ABORDAGEM_OPTS: { value: TomadorAl["status_abordagem"]; label: string }[] = [
  { value: "novo", label: "Novo" },
  { value: "contatado", label: "Contatado" },
  { value: "proposta_enviada", label: "Proposta" },
  { value: "convertido", label: "Convertido" },
  { value: "sem_interesse", label: "Sem interesse" },
];
const ABORDAGEM_LABEL: Record<string, string> = Object.fromEntries(ABORDAGEM_OPTS.map((o) => [o.value, o.label]));
const ABORDAGEM_STYLE: Record<string, string> = {
  novo: "bg-sky-500/15 text-sky-600 dark:text-sky-400",
  contatado: "bg-amber-500/15 text-amber-600 dark:text-amber-400",
  proposta_enviada: "bg-violet-500/15 text-violet-600 dark:text-violet-400",
  convertido: "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400",
  sem_interesse: "bg-muted text-muted-foreground",
};

const brl = (n: number | null) =>
  (n ?? 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

const fmtCpf = (d: string) =>
  d?.length === 11 ? `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6, 9)}-${d.slice(9)}` : d;

const fmtTel = (t: string) =>
  t.length === 11
    ? `(${t.slice(0, 2)}) ${t.slice(2, 7)}-${t.slice(7)}`
    : t.length === 10
    ? `(${t.slice(0, 2)}) ${t.slice(2, 6)}-${t.slice(6)}`
    : t;

// A planilha não traz a margem disponível de cartão benefício. Derivamos com os
// coeficientes de AL do sistema: base = bruta empréstimo / 40%; benefício = 15% da base.
const margemBeneficioDisp = (r: TomadorAl) => {
  const base = (r.margem_bruta_emprestimo ?? 0) / COEF_MARGEM_AL_PADRAO.principal;
  const bruta = base * COEF_MARGEM_AL_PADRAO.cartaoBeneficio;
  return Math.max(0, bruta - (r.margem_util_cartao_beneficio ?? 0));
};

// Valor aproximado liberado usando os multiplicadores médios do sistema
// (src/lib/al/credito.ts). Sempre estimativa — confirmar com Digitação.
function MargemLinha({
  label,
  margem,
  mult,
  destaque = false,
}: {
  label: string;
  margem: number | null;
  mult: { medio: number };
  destaque?: boolean;
}) {
  const m = margem ?? 0;
  return (
    <div
      className={cn(
        "rounded-lg border p-2.5",
        destaque
          ? "border-primary bg-primary/10 ring-1 ring-primary/40"
          : "border-border/60 bg-muted/30",
      )}
    >
      <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">{label}</p>
      <p className={cn("font-semibold text-foreground", destaque ? "text-lg" : "text-sm")}>{brl(m)}</p>
      <p className="text-[11px] text-emerald-600 dark:text-emerald-400">
        ≈ {brl(m * mult.medio)} liberado
      </p>
    </div>
  );
}


function Page() {
  const { isAdmin } = useRhAccess();
  const fetchTomadores = useServerFn(getTomadoresAl);
  const abordagemFn = useServerFn(marcarAbordagemTomador);
  const distribuirFn = useServerFn(distribuirTomadoresAl);
  const fetchConsultoras = useServerFn(getConsultoras);
  const fetchDistribuicao = useServerFn(getDistribuicaoTomadoresAl);
  const fetchResumo = useServerFn(getResumoCarteiraTomadores);
  const fetchFaixas = useServerFn(getContagemFaixasTomadores);

  const addConsultoraFn = useServerFn(adicionarConsultora);
  const toggleConsultoraFn = useServerFn(toggleConsultora);
  const importarAcessosFn = useServerFn(importarConsultorasDosAcessos);
  const [importandoAcessos, setImportandoAcessos] = useState(false);

  const [busca, setBusca] = useState("");
  const [termo, setTermo] = useState("");
  const [orgao, setOrgao] = useState("todos");
  const [novoNome, setNovoNome] = useState("");
  const [novoEmail, setNovoEmail] = useState("");
  const [salvandoConsultora, setSalvandoConsultora] = useState(false);
  const [minMargem, setMinMargem] = useState("0");
  const [tipoMargem, setTipoMargem] = useState<TipoMargem>("emprestimo");
  const [faixa, setFaixa] = useState<FaixaMargem>("todas");
  const [faixasCount, setFaixasCount] = useState<{ baixa: number; media: number; alta: number } | null>(null);
  const [page, setPage] = useState(0);
  const [aba, setAba] = useState<"carteira" | "historico">("carteira");
  const [motivoPara, setMotivoPara] = useState<string | null>(null);
  const [rows, setRows] = useState<TomadorAl[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [orgaos, setOrgaos] = useState<string[]>([]);
  const [importing, setImporting] = useState(false);
  const [progress, setProgress] = useState(0);
  const [distribuindo, setDistribuindo] = useState(false);

  const [consultoraNome, setConsultoraNome] = useState<string | null>(null);
  const [vinculada, setVinculada] = useState(true);
  const [consultoras, setConsultoras] = useState<Consultora[]>([]);
  const [filtroConsultora, setFiltroConsultora] = useState("");
  const [dist, setDist] = useState<{
    total: number; semResponsavel: number; atribuidos: number; orfaos: number;
    consultoras: DistribuicaoConsultora[];
  } | null>(null);
  const [distLoading, setDistLoading] = useState(false);
  const [resumo, setResumo] = useState<ResumoCarteira | null>(null);
  const [resumoLoading, setResumoLoading] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => { setTermo(busca.trim()); setPage(0); }, 350);
    return () => clearTimeout(t);
  }, [busca]);

  const recarregarDistribuicao = useCallback(async () => {
    setDistLoading(true);
    try {
      setDist(await fetchDistribuicao());
    } catch { /* painel opcional */ }
    finally { setDistLoading(false); }
  }, [fetchDistribuicao]);

  useEffect(() => {
    if (!isAdmin) return;
    fetchConsultoras().then(setConsultoras).catch(() => { /* seletor opcional */ });
    void recarregarDistribuicao();
  }, [isAdmin]);

  const filtrosMargem = useMemo(
    () => ({
      termo,
      orgao: orgao === "todos" ? "" : orgao,
      minMargem: Number(minMargem) || 0,
      tipoMargem,
      faixa,
      consultora: filtroConsultora || undefined,
      aba,
    }),
    [termo, orgao, minMargem, tipoMargem, faixa, filtroConsultora, aba],
  );

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [res, cont] = await Promise.all([
        fetchTomadores({
          data: { offset: page * PAGE_SIZE, limit: PAGE_SIZE, ...filtrosMargem },
        }),
        fetchFaixas({ data: { ...filtrosMargem } }).catch(() => null),
      ]);
      setRows(res.rows);
      setTotal(res.total);
      setConsultoraNome(res.consultoraNome);
      setVinculada(res.isAdmin || res.vinculada);
      setFaixasCount(cont);
    } catch (e: any) {
      toast.error("Erro ao carregar base: " + (e?.message ?? e));
    } finally {
      setLoading(false);
    }
  }, [page, filtrosMargem, fetchTomadores, fetchFaixas]);

  useEffect(() => { load(); }, [load]);

  const recarregarResumo = useCallback(async () => {
    setResumoLoading(true);
    try {
      setResumo(await fetchResumo({ data: { consultora: filtroConsultora || undefined } }));
    } catch { /* painel opcional */ }
    finally { setResumoLoading(false); }
  }, [fetchResumo, filtroConsultora]);

  useEffect(() => { void recarregarResumo(); }, [recarregarResumo]);

  const atualizarCarteira = async () => {
    await Promise.all([load(), recarregarResumo()]);
    toast.success("Carteira atualizada.");
  };

  useEffect(() => {
    supabase
      .from("tomadores_al")
      .select("orgao")
      .limit(2000)
      .then(({ data }) => {
        const set = new Set((data ?? []).map((r: any) => r.orgao).filter(Boolean));
        setOrgaos([...set].sort());
      });
  }, [total]);

  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const somaMargem = useMemo(
    () => rows.reduce((a, r) => a + (r.margem_disp_emprestimo ?? 0), 0),
    [rows],
  );

  const handleAbordagem = async (
    id: string,
    status: TomadorAl["status_abordagem"],
    motivo?: string,
  ) => {
    const finalizado = status === "convertido" || status === "sem_interesse";
    try {
      const res: any = await abordagemFn({ data: { id, status, motivo } });
      setMotivoPara(null);
      setRows((l) =>
        finalizado
          ? l.filter((r) => r.id !== id)
          : l.map((r) => (r.id === id ? { ...r, status_abordagem: status } : r)),
      );
      const repostos = Number(res?.repostos ?? 0);
      if (repostos > 0) {
        toast.success(`Situação atualizada · ${repostos} novo(s) lead(s) na sua carteira.`);
      } else {
        toast.success("Situação atualizada.");
      }
      // Ao finalizar, a lista é recarregada para já mostrar os substitutos do estoque.
      if (finalizado || repostos > 0) {
        if (page !== 0) setPage(0);
        else await load();
      }
      void recarregarResumo();
    } catch (e: any) {
      toast.error(e?.message ?? "Erro ao atualizar.");
    }
  };


  const distribuir = async () => {
    setDistribuindo(true);
    try {
      const res = await distribuirFn();
      if (!res.consultoras) toast.error("Nenhuma consultora ativa cadastrada.");
      else toast.success(`${res.atribuidos} novos leads repostos nas carteiras de ${res.consultoras} consultora(s).`);
      await load();
      await recarregarDistribuicao();
    } catch (e: any) {
      toast.error(e?.message ?? "Erro ao distribuir.");
    } finally {
      setDistribuindo(false);
    }
  };

  const recarregarConsultoras = async () => {
    try {
      setConsultoras(await fetchConsultoras());
    } catch { /* seletor opcional */ }
  };

  const importarAcessos = async () => {
    setImportandoAcessos(true);
    try {
      const res = await importarAcessosFn();
      if (!res.criadas) toast.info("Nenhum acesso novo para importar.");
      else toast.success(`${res.criadas} consultora(s) importada(s) dos acessos. Use “Repor carteiras”.`);
      await recarregarConsultoras();
      await recarregarDistribuicao();
    } catch (e: any) {
      toast.error(e?.message ?? "Erro ao importar acessos.");
    } finally {
      setImportandoAcessos(false);
    }
  };


  const salvarConsultora = async () => {
    if (!novoNome.trim()) { toast.error("Informe o nome da consultora."); return; }
    if (!novoEmail.trim()) { toast.error("Informe o e-mail de login da consultora."); return; }
    setSalvandoConsultora(true);
    try {
      await addConsultoraFn({ data: { nome: novoNome.trim(), email: novoEmail.trim().toLowerCase() } });
      setNovoNome("");
      setNovoEmail("");
      await recarregarConsultoras();
      await recarregarDistribuicao();
      toast.success("Consultora cadastrada. Agora use “Repor carteiras”.");
    } catch (e: any) {
      toast.error(e?.message ?? "Erro ao cadastrar consultora.");
    } finally {
      setSalvandoConsultora(false);
    }
  };

  const alternarConsultora = async (c: Consultora) => {
    try {
      await toggleConsultoraFn({ data: { id: c.id, ativo: !c.ativo } });
      await recarregarConsultoras();
      await recarregarDistribuicao();
    } catch (e: any) {
      toast.error(e?.message ?? "Erro ao atualizar consultora.");
    }
  };



  const importar = async () => {
    setImporting(true);
    setProgress(0);
    try {
      const res = await fetch(tomadoresAsset.url);
      const { cols, rows: raw } = (await res.json()) as { cols: string[]; rows: any[][] };
      const records = raw.map((r) => Object.fromEntries(cols.map((c, i) => [c, r[i]])));
      const CHUNK = 500;
      for (let i = 0; i < records.length; i += CHUNK) {
        const { error } = await supabase.from("tomadores_al").insert(records.slice(i, i + CHUNK) as any);
        if (error) throw error;
        setProgress(Math.round(((i + CHUNK) / records.length) * 100));
      }
      toast.success(`${records.length} tomadores importados`);
      setPage(0);
      await load();
    } catch (e: any) {
      toast.error("Falha na importação: " + (e?.message ?? e));
    } finally {
      setImporting(false);
    }
  };

  const exportarCsv = () => {
    const head = ["Nome", "CPF", "Órgão", "Lotação", "Matrícula", "Margem Empréstimo", "Margem Cartão", "% Utilizado", "Consultora", "Situação"];
    const lines = rows.map((r) => [
      r.nome, r.documento, r.orgao ?? "", r.descricao_lotacao ?? "", r.matricula ?? "",
      String(r.margem_disp_emprestimo ?? 0).replace(".", ","),
      String(r.margem_disp_cartao_credito ?? 0).replace(".", ","),
      (r.pct_utilizado_emprestimo ?? 0).toFixed(1).replace(".", ","),
      r.consultora_responsavel ?? "", ABORDAGEM_LABEL[r.status_abordagem] ?? r.status_abordagem,
    ]);
    const csv = [head, ...lines].map((l) => l.map((c) => `"${c}"`).join(";")).join("\n");
    const url = URL.createObjectURL(new Blob(["\ufeff" + csv], { type: "text/csv;charset=utf-8" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = "tomadores-margem-al.csv";
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <AppShell>
      <div className="space-y-6">
        <header className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="inline-flex items-center gap-2 rounded-full border border-primary/30 bg-primary/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-widest text-primary">
              <Wallet className="h-3 w-3" /> Base Alagoas
            </p>
            <h1 className="mt-2 text-2xl font-bold tracking-tight md:text-3xl">
              CLIENTES TOMADORES COM MARGEM - AL
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">
              {isAdmin ? "Visão de administrador" : "Seus leads exclusivos"} ·{" "}
              {total.toLocaleString("pt-BR")} registros · margem nesta página: {brl(somaMargem)}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            {isAdmin && (
              <>
                <Button variant="outline" size="sm" onClick={exportarCsv} disabled={!rows.length}>
                  <Download className="mr-2 h-4 w-4" /> Exportar CSV
                </Button>
                <Button variant="outline" size="sm" onClick={distribuir} disabled={distribuindo}>
                  <Shuffle className="mr-2 h-4 w-4" />
                  {distribuindo ? "Repondo…" : "Repor carteiras (10 por consultora)"}
                </Button>
                <Button size="sm" onClick={importar} disabled={importing}>
                  <Upload className="mr-2 h-4 w-4" />
                  {importing ? `Importando ${progress}%` : "Importar planilha"}
                </Button>
              </>
            )}
          </div>
        </header>

        {(resumo?.consultoraNome || (!isAdmin && vinculada)) && (
          <section className="space-y-3 rounded-xl border border-border/60 bg-card p-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h2 className="flex items-center gap-2 text-sm font-semibold">
                <Briefcase className="h-4 w-4" /> Minha carteira
                {resumo?.consultoraNome && (
                  <span className="text-xs font-normal text-muted-foreground">· {resumo.consultoraNome}</span>
                )}
              </h2>
              <Button variant="outline" size="sm" onClick={atualizarCarteira} disabled={resumoLoading || loading}>
                <RefreshCw className={`mr-2 h-4 w-4 ${resumoLoading ? "animate-spin" : ""}`} />
                {resumoLoading ? "Atualizando…" : "Atualizar status"}
              </Button>
            </div>

            <div className="grid gap-2 grid-cols-2 sm:grid-cols-4">
              {[
                {
                  label: "Ativos",
                  valor: (resumo?.pendentes ?? 0) + (resumo?.emAndamento ?? 0),
                  tone: "text-foreground",
                  hint: "novos + em andamento",
                },
                {
                  label: "Convertidos",
                  valor: resumo?.convertidos ?? 0,
                  tone: "text-emerald-600 dark:text-emerald-400",
                  hint: "desfechos positivos",
                },
                {
                  label: "Sem interesse",
                  valor: resumo?.semInteresse ?? 0,
                  tone: "text-muted-foreground",
                  hint: "descartados",
                },
                {
                  label: "Vagas livres",
                  valor: resumo?.vagasLivres ?? 0,
                  tone: "text-amber-600 dark:text-amber-400",
                  hint: "espaço para novos leads",
                },
              ].map((k) => (
                <div key={k.label} className="rounded-lg border border-border/60 bg-background p-3">
                  <p className="text-[11px] text-muted-foreground">{k.label}</p>
                  <p className={`text-xl font-bold ${k.tone}`}>{k.valor.toLocaleString("pt-BR")}</p>
                  <p className="text-[10px] text-muted-foreground">{k.hint}</p>
                </div>
              ))}
            </div>

            <div className="space-y-1">
              <div className="flex items-center justify-between text-xs">
                <span className="text-muted-foreground">Capacidade da carteira</span>
                <span className="font-medium">{((resumo?.pendentes ?? 0) + (resumo?.emAndamento ?? 0))} / 30</span>
              </div>
              <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
                <div
                  className={cn(
                    "h-full rounded-full transition-all",
                    ((resumo?.pendentes ?? 0) + (resumo?.emAndamento ?? 0)) < 12
                      ? "bg-amber-500"
                      : "bg-primary",

                  )}
                  style={{ width: `${Math.min(100, (((resumo?.pendentes ?? 0) + (resumo?.emAndamento ?? 0)) / 30) * 100)}%` }}
                />
              </div>
              {((resumo?.pendentes ?? 0) + (resumo?.emAndamento ?? 0)) < 5 && (
                <p className="flex items-center gap-1 text-xs font-medium text-amber-600 dark:text-amber-400">
                  <TrendingUp className="h-3.5 w-3.5" />
                  Carteira acabando — marque desfechos para repor leads automaticamente.
                </p>
              )}
            </div>
          </section>
        )}

        {isAdmin && (
          <section className="space-y-3 rounded-xl border border-border/60 bg-card p-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h2 className="flex items-center gap-2 text-sm font-semibold">
                <Users className="h-4 w-4" /> Consultoras e distribuição
              </h2>
              <span className="text-xs text-muted-foreground">
                {consultoras.filter((c) => c.ativo).length} ativa(s) de {consultoras.length}
              </span>
            </div>

            {consultoras.filter((c) => c.ativo).length === 0 && (
              <p className="rounded-lg border border-amber-300 bg-amber-50 p-3 text-xs text-amber-900 dark:border-amber-900/40 dark:bg-amber-950/30 dark:text-amber-200">
                Existem acessos criados no login, mas nenhuma consultora vinculada aqui — é isso que
                impede a distribuição. Clique em “Importar consultoras dos acessos” para criar o
                vínculo automaticamente pelos e-mails já cadastrados (admins são ignorados) e depois
                use “Repor carteiras”. Cada uma recebe 10 leads exclusivos, repostos conforme finaliza.
              </p>
            )}

            <Button
              variant="outline"
              size="sm"
              className="h-10 w-full sm:w-auto"
              onClick={importarAcessos}
              disabled={importandoAcessos}
            >
              <UserCheck className="mr-2 h-4 w-4" />
              {importandoAcessos ? "Importando…" : "Importar consultoras dos acessos"}
            </Button>


            <div className="grid gap-2 sm:grid-cols-[1fr_1fr_auto]">
              <Input
                value={novoNome}
                onChange={(e) => setNovoNome(e.target.value)}
                placeholder="Nome da consultora"
                className="h-10"
              />
              <Input
                value={novoEmail}
                onChange={(e) => setNovoEmail(e.target.value)}
                placeholder="e-mail de login"
                className="h-10"
              />
              <Button size="sm" className="h-10" onClick={salvarConsultora} disabled={salvandoConsultora}>
                {salvandoConsultora ? "Salvando…" : "Cadastrar"}
              </Button>
            </div>

            <div className="grid gap-2 sm:grid-cols-4">
              {[
                { label: "Total na base", valor: dist?.total ?? total, tone: "text-foreground" },
                { label: "Com responsável", valor: dist?.atribuidos ?? 0, tone: "text-emerald-600 dark:text-emerald-400" },
                { label: "Estoque (sem responsável)", valor: dist?.semResponsavel ?? 0, tone: "text-amber-600 dark:text-amber-400" },
                { label: "Órfãos (consultora removida)", valor: dist?.orfaos ?? 0, tone: "text-rose-600 dark:text-rose-400" },
              ].map((k) => (
                <div key={k.label} className="rounded-lg border border-border/60 bg-background p-3">
                  <p className="text-[11px] text-muted-foreground">{k.label}</p>
                  <p className={`text-lg font-bold ${k.tone}`}>{k.valor.toLocaleString("pt-BR")}</p>
                </div>
              ))}
            </div>

            <div className="flex items-center justify-between">
              <p className="text-xs text-muted-foreground">
                {distLoading ? "Atualizando contagem…" : "Contagem apurada direto na base de tomadores."}
              </p>
              <Button variant="ghost" size="sm" className="h-7 px-2 text-[11px]" onClick={recarregarDistribuicao} disabled={distLoading}>
                Atualizar
              </Button>
            </div>

            {(dist?.consultoras.length ?? consultoras.length) > 0 && (
              <ul className="divide-y divide-border/60 rounded-lg border border-border/60">
                {(dist?.consultoras ?? consultoras.map((c) => ({
                  id: c.id, nome: c.nome, email: c.email ?? null, ativo: c.ativo,
                  atribuidos: c.total_leads_atribuidos ?? 0, trabalhados: 0,
                  contador_cadastro: c.total_leads_atribuidos ?? 0,
                }))).map((c) => (
                  <li key={c.id} className="flex flex-wrap items-center justify-between gap-2 px-3 py-2">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium">{c.nome}</p>
                      <p className="truncate text-xs text-muted-foreground">
                        {c.email ?? "sem e-mail vinculado"}
                      </p>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge className="bg-sky-500/15 text-sky-700 dark:text-sky-300">
                        {c.atribuidos.toLocaleString("pt-BR")} atribuídos
                      </Badge>
                      <Badge className="bg-violet-500/15 text-violet-700 dark:text-violet-300">
                        {c.trabalhados.toLocaleString("pt-BR")} trabalhados
                      </Badge>
                      <Badge className={c.ativo ? "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400" : "bg-muted text-muted-foreground"}>
                        {c.ativo ? "Ativa" : "Inativa"}
                      </Badge>
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-7 px-2 text-[11px]"
                        onClick={() => alternarConsultora({ ...(consultoras.find((x) => x.id === c.id) ?? ({} as Consultora)), id: c.id, ativo: c.ativo } as Consultora)}
                      >
                        {c.ativo ? "Desativar" : "Ativar"}
                      </Button>
                    </div>
                  </li>
                ))}
              </ul>
            )}

            {!!dist?.orfaos && (
              <p className="rounded-lg border border-rose-300 bg-rose-50 p-3 text-xs text-rose-900 dark:border-rose-900/40 dark:bg-rose-950/30 dark:text-rose-200">
                {dist.orfaos.toLocaleString("pt-BR")} tomadores estão vinculados a nomes que não
                existem mais no cadastro de consultoras. Cadastre a consultora com o mesmo nome ou
                limpe o responsável para redistribuir.
              </p>
            )}
          </section>
        )}



        <div className="grid gap-4 rounded-xl border border-border/60 bg-card p-4 md:grid-cols-2 lg:grid-cols-5">
          <div>
            <Label className="text-xs">Buscar por nome ou CPF</Label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Nome ou CPF" className="h-10 pl-9" />
            </div>
          </div>
          <div>
            <Label className="text-xs">Órgão</Label>
            <Select value={orgao} onValueChange={(v) => { setOrgao(v); setPage(0); }}>
              <SelectTrigger className="h-10"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos os órgãos</SelectItem>
                {orgaos.map((o) => <SelectItem key={o} value={o}>{o}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-xs">Tipo de margem</Label>
            <Select
              value={tipoMargem}
              onValueChange={(v) => { setTipoMargem(v as TipoMargem); setPage(0); }}
            >
              <SelectTrigger className="h-10"><SelectValue /></SelectTrigger>
              <SelectContent>
                {TIPOS_MARGEM.map((t) => (
                  <SelectItem key={t} value={t}>{TIPO_MARGEM_LABEL[t]}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-xs">Faixa de valor</Label>
            <Select value={faixa} onValueChange={(v) => { setFaixa(v as FaixaMargem); setPage(0); }}>
              <SelectTrigger className="h-10"><SelectValue /></SelectTrigger>
              <SelectContent>
                {FAIXAS_MARGEM.map((f) => (
                  <SelectItem key={f} value={f}>{FAIXA_LABEL[f]}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-xs">Valor mínimo (ajuste fino)</Label>
            <Select value={minMargem} onValueChange={(v) => { setMinMargem(v); setPage(0); }}>
              <SelectTrigger className="h-10"><SelectValue /></SelectTrigger>
              <SelectContent>
                {["0", "100", "200", "300", "500", "1000"].map((v) => (
                  <SelectItem key={v} value={v}>{v === "0" ? "Qualquer" : `Acima de ${brl(Number(v))}`}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="flex items-center gap-1 text-xs"><UserCheck className="h-3.5 w-3.5" /> Consultora</Label>
            {isAdmin ? (
              <select
                value={filtroConsultora}
                onChange={(e) => { setFiltroConsultora(e.target.value); setPage(0); }}
                className="h-10 w-full rounded-md border bg-background px-2 text-sm"
              >
                <option value="">Todas as consultoras (admin)</option>
                {consultoras.map((c) => (
                  <option key={c.id} value={c.nome}>{c.nome}{!c.ativo ? " (inativa)" : ""}</option>
                ))}
              </select>
            ) : (
              <div className="flex h-10 items-center gap-2 rounded-md border bg-primary/5 px-3 text-sm font-medium">
                {consultoraNome ?? "—"}
              </div>
            )}
          </div>
        </div>

        {faixasCount && (
          <div className="flex flex-wrap items-center gap-2 text-xs">
            <span className="text-muted-foreground">
              Faixas em {TIPO_MARGEM_CURTO[tipoMargem]}:
            </span>
            <button
              type="button"
              onClick={() => { setFaixa("alta"); setPage(0); }}
              className={cn(
                "rounded-full border px-2.5 py-1 font-semibold",
                faixa === "alta"
                  ? "border-emerald-600 bg-emerald-600 text-white"
                  : "border-emerald-300 bg-emerald-50 text-emerald-900 dark:border-emerald-900/50 dark:bg-emerald-950/40 dark:text-emerald-200",
              )}
            >
              Alta {faixasCount.alta.toLocaleString("pt-BR")}
            </button>
            <button
              type="button"
              onClick={() => { setFaixa("media"); setPage(0); }}
              className={cn(
                "rounded-full border px-2.5 py-1 font-semibold",
                faixa === "media"
                  ? "border-amber-600 bg-amber-600 text-white"
                  : "border-amber-300 bg-amber-50 text-amber-900 dark:border-amber-900/50 dark:bg-amber-950/40 dark:text-amber-200",
              )}
            >
              Média {faixasCount.media.toLocaleString("pt-BR")}
            </button>
            <button
              type="button"
              onClick={() => { setFaixa("baixa"); setPage(0); }}
              className={cn(
                "rounded-full border px-2.5 py-1 font-semibold",
                faixa === "baixa"
                  ? "border-slate-600 bg-slate-600 text-white"
                  : "border-slate-300 bg-slate-50 text-slate-900 dark:border-slate-700 dark:bg-slate-900/60 dark:text-slate-200",
              )}
            >
              Baixa {faixasCount.baixa.toLocaleString("pt-BR")}
            </button>
            {faixa !== "todas" && (
              <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => { setFaixa("todas"); setPage(0); }}>
                Limpar faixa
              </Button>
            )}
            {!isAdmin && (
              <span className="text-[11px] text-muted-foreground">
                Clique numa faixa para receber leads dela — sua carteira mantém 10 em aberto por faixa (até 30).
              </span>
            )}
          </div>
        )}



        <div className="flex gap-2">
          {([
            { v: "carteira", label: "Minha carteira" },
            { v: "historico", label: "Histórico" },
          ] as const).map((t) => (
            <Button
              key={t.v}
              size="sm"
              variant={aba === t.v ? "default" : "outline"}
              onClick={() => { setAba(t.v); setPage(0); }}
            >
              {t.label}
            </Button>
          ))}
        </div>

        {loading ? (
          <p className="py-10 text-center text-sm text-muted-foreground">Carregando base…</p>
        ) : !vinculada ? (
          <div className="rounded-xl border border-dashed border-border/70 p-10 text-center">
            <Users className="mx-auto mb-3 h-8 w-8 text-muted-foreground" />
            <p className="text-sm text-muted-foreground">
              Seu login ainda não está vinculado a uma consultora. Peça ao administrador para cadastrar seu e-mail.
            </p>
          </div>
        ) : rows.length === 0 ? (
          <div className="rounded-xl border border-dashed border-border/70 p-10 text-center">
            <Users className="mx-auto mb-3 h-8 w-8 text-muted-foreground" />
            <p className="text-sm text-muted-foreground">
              {aba === "historico"
                ? "Nenhum lead finalizado ainda."
                : `Nenhum tomador atribuído a você.${isAdmin ? " Use “Importar planilha” e depois “Distribuir sem consultora”." : ""}`}
            </p>
          </div>
        ) : (
          <div className="grid gap-4 lg:grid-cols-2">
            {rows.map((r) => (
              <article key={r.id} className="rounded-xl border border-border/60 bg-card p-4 transition-all hover:shadow-md">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-foreground truncate">{r.nome}</p>
                    <p className="text-xs text-muted-foreground">
                      CPF {fmtCpf(r.documento)} · mat. {r.matricula ?? "—"} · {r.descricao_cargo ?? "—"}
                    </p>
                    <p className="text-xs text-muted-foreground">{r.orgao ?? "—"}</p>
                    {isAdmin && r.consultora_responsavel && (
                      <Badge variant="outline" className="mt-1 text-[10px]">{r.consultora_responsavel}</Badge>
                    )}
                  </div>
                  <div className="flex items-center gap-1">
                    <Badge className={ABORDAGEM_STYLE[r.status_abordagem] ?? ""}>
                      {ABORDAGEM_LABEL[r.status_abordagem] ?? r.status_abordagem}
                    </Badge>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button
                          variant="ghost"
                          size="sm"
                          title="Tratar lead"
                          className="h-8 w-8 p-0"
                        >
                          <Phone className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="max-h-[70vh] overflow-y-auto">
                        <DropdownMenuLabel>Agendar follow-up</DropdownMenuLabel>
                        <DropdownMenuSeparator />
                        {[
                          { label: "Em 1 hora", date: new Date(Date.now() + 60 * 60 * 1000) },
                          { label: "Amanhã 9h", date: (() => { const d = new Date(); d.setDate(d.getDate() + 1); d.setHours(9, 0, 0, 0); return d; })() },
                          { label: "Em 2 dias", date: (() => { const d = new Date(); d.setDate(d.getDate() + 2); d.setHours(9, 0, 0, 0); return d; })() },
                        ].map((f) => (
                          <DropdownMenuItem
                            key={f.label}
                            onSelect={async () => {
                              try {
                                const iso = f.date.toISOString();
                                await supabase.from("tomadores_al").update({ next_follow_up_at: iso } as any).eq("id", r.id);
                                // Also log event if possible
                                await supabase.from("lead_events").insert({
                                  lead_id: r.id,
                                  consultant_id: user?.id,
                                  kind: "followup",
                                  body: `Follow-up agendado: ${f.label}`
                                } as any).catch(() => {});
                                toast.success(`Follow-up agendado: ${f.label}`);
                                load();
                              } catch (e) {
                                toast.error("Erro ao agendar follow-up");
                              }
                            }}
                          >
                            <CalendarClock className="mr-2 h-3.5 w-3.5" /> {f.label}
                          </DropdownMenuItem>
                        ))}
                        <DropdownMenuSeparator />
                        <DropdownMenuLabel>Ações</DropdownMenuLabel>
                        <DropdownMenuItem onSelect={() => {
                          navigator.clipboard.writeText(r.documento);
                          toast.success("CPF copiado");
                        }}>
                          <Copy className="mr-2 h-3.5 w-3.5" /> Copiar CPF
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </div>

                <div className="mt-3 space-y-1.5">
                  {r.telefones?.length ? (
                    r.telefones.map((t) => (
                      <div key={t} className="flex flex-wrap items-center gap-1.5">
                        <Phone className="h-3.5 w-3.5 text-muted-foreground" />
                        <span className="rounded-full border border-border/60 px-2.5 py-0.5 text-xs font-medium text-foreground">
                          {fmtTel(t)}
                        </span>
                        <Button asChild size="sm" variant="outline" className="h-7 px-2 text-[11px]">
                          <a href={telLink(t) ?? "#"}>
                            <Phone className="mr-1 h-3 w-3" /> Ligar
                          </a>
                        </Button>
                        <Button
                          asChild
                          size="sm"
                          className="h-7 bg-emerald-600 px-2 text-[11px] text-white hover:bg-emerald-700"
                        >
                          <a
                            href={whatsappLink(t, msgWhatsapp(r.nome)) ?? "#"}
                            target="_blank"
                            rel="noopener noreferrer"
                          >
                            <WhatsAppIcon className="mr-1 h-3 w-3" /> WhatsApp
                          </a>
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-7 px-1.5"
                          onClick={() => {
                            navigator.clipboard.writeText(fmtTel(t));
                            toast.success("Telefone copiado");
                          }}
                        >
                          <Copy className="h-3 w-3" />
                        </Button>
                      </div>
                    ))
                  ) : (
                    <div className="flex items-center gap-2">
                      <Phone className="h-3.5 w-3.5 text-muted-foreground" />
                      <span className="text-xs text-muted-foreground">Telefone não cadastrado</span>
                    </div>
                  )}
                </div>


                {tipoMargem !== "qualquer" && (
                  <div className="mt-3">
                    <Badge
                      className={cn(
                        "text-[10px]",
                        faixaDaMargem(
                          tipoMargem === "cartao_credito"
                            ? r.margem_disp_cartao_credito
                            : tipoMargem === "cartao_beneficio"
                            ? margemBeneficioDisp(r)
                            : r.margem_disp_emprestimo,
                          tipoMargem,
                        ) === "alta"
                          ? "bg-emerald-600 text-white"
                          : faixaDaMargem(
                              tipoMargem === "cartao_credito"
                                ? r.margem_disp_cartao_credito
                                : tipoMargem === "cartao_beneficio"
                                ? margemBeneficioDisp(r)
                                : r.margem_disp_emprestimo,
                              tipoMargem,
                            ) === "media"
                          ? "bg-amber-500 text-white"
                          : "bg-slate-500 text-white",
                      )}
                    >
                      {TIPO_MARGEM_CURTO[tipoMargem]} ·{" "}
                      {FAIXA_LABEL[
                        faixaDaMargem(
                          tipoMargem === "cartao_credito"
                            ? r.margem_disp_cartao_credito
                            : tipoMargem === "cartao_beneficio"
                            ? margemBeneficioDisp(r)
                            : r.margem_disp_emprestimo,
                          tipoMargem,
                        )
                      ]}
                    </Badge>
                  </div>
                )}

                <div className="mt-3 grid gap-2 sm:grid-cols-3">
                  <MargemLinha
                    label="Empréstimo"
                    margem={r.margem_disp_emprestimo}
                    mult={MULT_PRINCIPAL}
                    destaque={tipoMargem === "emprestimo"}
                  />
                  <MargemLinha
                    label="Cartão crédito"
                    margem={r.margem_disp_cartao_credito}
                    mult={MULT_CARTAO_CONSIGNADO}
                    destaque={tipoMargem === "cartao_credito"}
                  />
                  <MargemLinha
                    label="Cartão benefício"
                    margem={margemBeneficioDisp(r)}
                    mult={MULT_CARTAO_BENEFICIO}
                    destaque={tipoMargem === "cartao_beneficio"}
                  />
                </div>


                <p className="mt-2 text-[11px] text-muted-foreground">
                  Margem bruta empréstimo {brl(r.margem_bruta_emprestimo)} · utilizado{" "}
                  {(r.pct_utilizado_emprestimo ?? 0).toFixed(1).replace(".", ",")}% · valores estimados,
                  confirmar com Digitação
                </p>

                {aba === "historico" ? (
                  <p className="mt-3 text-[11px] text-muted-foreground">
                    Finalizado{r.finalizado_em ? ` em ${new Date(r.finalizado_em).toLocaleDateString("pt-BR")}` : ""}
                    {r.motivo_sem_interesse ? ` · motivo: ${r.motivo_sem_interesse}` : ""}
                  </p>
                ) : motivoPara === r.id ? (
                  <div className="mt-3 rounded-lg border border-border/60 bg-muted/30 p-2">
                    <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                      Motivo do sem interesse
                    </p>
                    <div className="flex flex-wrap gap-1">
                      {MOTIVOS_SEM_INTERESSE.map((m) => (
                        <Button
                          key={m}
                          size="sm"
                          variant="outline"
                          className="h-7 px-2 text-[11px]"
                          onClick={() => handleAbordagem(r.id, "sem_interesse", m)}
                        >
                          {m}
                        </Button>
                      ))}
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-7 px-2 text-[11px]"
                        onClick={() => setMotivoPara(null)}
                      >
                        Cancelar
                      </Button>
                    </div>
                  </div>
                ) : (
                  <div className="mt-3 flex flex-wrap gap-1">
                    {ABORDAGEM_OPTS.filter((o) => o.value !== r.status_abordagem).map((o) => (
                      <Button
                        key={o.value}
                        size="sm"
                        variant="outline"
                        className="h-7 px-2 text-[11px]"
                        onClick={() =>
                          o.value === "sem_interesse"
                            ? setMotivoPara(r.id)
                            : handleAbordagem(r.id, o.value)
                        }
                      >
                        {o.label}
                      </Button>
                    ))}
                  </div>
                )}

              </article>
            ))}
          </div>
        )}

        {total > PAGE_SIZE && (
          <div className="flex items-center justify-center gap-3">
            <Button variant="outline" size="sm" disabled={page === 0} onClick={() => setPage((p) => p - 1)}>Anterior</Button>
            <span className="text-xs text-muted-foreground">Página {page + 1} de {pages}</span>
            <Button variant="outline" size="sm" disabled={page + 1 >= pages} onClick={() => setPage((p) => p + 1)}>Próxima</Button>
          </div>
        )}
      </div>
    </AppShell>
  );
}
