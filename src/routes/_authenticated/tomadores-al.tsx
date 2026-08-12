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
import { Wallet, Search, Copy, Download, Upload, Users, Shuffle, UserCheck, Phone, RefreshCw, Briefcase } from "lucide-react";
import { MULT_PRINCIPAL, MULT_CARTAO_BENEFICIO, MULT_CARTAO_CONSIGNADO } from "@/lib/al/credito";
import { COEF_MARGEM_AL_PADRAO } from "@/lib/al/margem";
import { toast } from "sonner";
import tomadoresAsset from "@/assets/tomadores_al.json.asset.json";
import {
  getTomadoresAl, marcarAbordagemTomador, distribuirTomadoresAl, getDistribuicaoTomadoresAl,
  getResumoCarteiraTomadores, importarConsultorasDosAcessos,
  type TomadorAl, type DistribuicaoConsultora, type ResumoCarteira,
} from "@/lib/prospeccao/tomadores-al.functions";
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
}: {
  label: string;
  margem: number | null;
  mult: { medio: number };
}) {
  const m = margem ?? 0;
  return (
    <div className="rounded-lg border border-border/60 bg-muted/30 p-2.5">
      <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">{label}</p>
      <p className="text-sm font-semibold text-foreground">{brl(m)}</p>
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
  const [page, setPage] = useState(0);
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

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetchTomadores({
        data: {
          offset: page * PAGE_SIZE,
          limit: PAGE_SIZE,
          termo,
          orgao: orgao === "todos" ? "" : orgao,
          minMargem: Number(minMargem) || 0,
          consultora: filtroConsultora || undefined,
        },
      });
      setRows(res.rows);
      setTotal(res.total);
      setConsultoraNome(res.consultoraNome);
      setVinculada(res.isAdmin || res.vinculada);
    } catch (e: any) {
      toast.error("Erro ao carregar base: " + (e?.message ?? e));
    } finally {
      setLoading(false);
    }
  }, [page, termo, orgao, minMargem, filtroConsultora]);

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

  const handleAbordagem = async (id: string, status: TomadorAl["status_abordagem"]) => {
    try {
      await abordagemFn({ data: { id, status } });
      setRows((l) => l.map((r) => (r.id === id ? { ...r, status_abordagem: status } : r)));
      toast.success("Situação atualizada.");
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

            <div className="grid gap-2 grid-cols-2 lg:grid-cols-4">
              {[
                { label: "Atribuídos", valor: resumo?.atribuidos ?? 0, tone: "text-foreground" },
                { label: "Pendentes (novos)", valor: resumo?.pendentes ?? 0, tone: "text-sky-600 dark:text-sky-400" },
                { label: "Em andamento", valor: resumo?.emAndamento ?? 0, tone: "text-amber-600 dark:text-amber-400" },
                { label: "Concluídos", valor: resumo?.concluidos ?? 0, tone: "text-emerald-600 dark:text-emerald-400" },
              ].map((k) => (
                <div key={k.label} className="rounded-lg border border-border/60 bg-background p-3">
                  <p className="text-[11px] text-muted-foreground">{k.label}</p>
                  <p className={`text-lg font-bold ${k.tone}`}>{k.valor.toLocaleString("pt-BR")}</p>
                </div>
              ))}
            </div>

            <p className="text-xs text-muted-foreground">
              {resumo?.convertidos ?? 0} convertido(s) · {resumo?.semInteresse ?? 0} sem interesse ·{" "}
              {(resumo?.vagasLivres ?? 0) > 0
                ? `${resumo?.vagasLivres} vaga(s) livre(s) na carteira — novos tomadores entram automaticamente.`
                : "Carteira completa com 10 leads em aberto."}
            </p>
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
                Nenhuma consultora ativa cadastrada — por isso os leads aparecem apenas na visão de
                administrador e nada foi distribuído. Cadastre cada consultora com o mesmo e-mail
                que ela usa para entrar no sistema e depois clique em “Repor carteiras”. Cada uma recebe 10 leads exclusivos, repostos conforme finaliza.
              </p>
            )}

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



        <div className="grid gap-4 rounded-xl border border-border/60 bg-card p-4 md:grid-cols-4">
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
            <Label className="text-xs">Margem mínima de empréstimo</Label>
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
              Nenhum tomador atribuído a você.{isAdmin ? " Use “Importar planilha” e depois “Distribuir sem consultora”." : ""}
            </p>
          </div>
        ) : (
          <div className="grid gap-4 lg:grid-cols-2">
            {rows.map((r) => (
              <article key={r.id} className="rounded-xl border border-border/60 bg-card p-4">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <p className="font-semibold text-foreground">{r.nome}</p>
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
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        navigator.clipboard.writeText(r.documento);
                        toast.success("CPF copiado");
                      }}
                    >
                      <Copy className="h-4 w-4" />
                    </Button>
                  </div>
                </div>

                <div className="mt-3 flex flex-wrap items-center gap-2">
                  <Phone className="h-3.5 w-3.5 text-muted-foreground" />
                  {r.telefones?.length ? (
                    r.telefones.map((t) => (
                      <a
                        key={t}
                        href={`tel:+55${t}`}
                        className="rounded-full border border-border/60 px-2.5 py-0.5 text-xs font-medium text-foreground"
                      >
                        {fmtTel(t)}
                      </a>
                    ))
                  ) : (
                    <span className="text-xs text-muted-foreground">Telefone não cadastrado</span>
                  )}
                </div>

                <div className="mt-3 grid gap-2 sm:grid-cols-3">
                  <MargemLinha label="Empréstimo" margem={r.margem_disp_emprestimo} mult={MULT_PRINCIPAL} />
                  <MargemLinha label="Cartão crédito" margem={r.margem_disp_cartao_credito} mult={MULT_CARTAO_CONSIGNADO} />
                  <MargemLinha
                    label="Cartão benefício"
                    margem={margemBeneficioDisp(r)}
                    mult={MULT_CARTAO_BENEFICIO}
                  />
                </div>

                <p className="mt-2 text-[11px] text-muted-foreground">
                  Margem bruta empréstimo {brl(r.margem_bruta_emprestimo)} · utilizado{" "}
                  {(r.pct_utilizado_emprestimo ?? 0).toFixed(1).replace(".", ",")}% · valores estimados,
                  confirmar com Digitação
                </p>

                <div className="mt-3 flex flex-wrap gap-1">
                  {ABORDAGEM_OPTS.filter((o) => o.value !== r.status_abordagem).map((o) => (
                    <Button
                      key={o.value}
                      size="sm"
                      variant="outline"
                      className="h-7 px-2 text-[11px]"
                      onClick={() => handleAbordagem(r.id, o.value)}
                    >
                      {o.label}
                    </Button>
                  ))}
                </div>
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
