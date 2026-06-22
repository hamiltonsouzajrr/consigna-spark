import { createFileRoute, Navigate, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
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
  Award, ArrowLeft, Search, Loader2, Building2, UserCheck, Copy,
  ChevronDown, ChevronUp, PartyPopper, FileText,
} from "lucide-react";
import {
  getConsultoras, getMinhaConsultora, getMeusLeadsRadar, marcarAbordagem,
  type Consultora, type DoRegistro,
} from "@/lib/radar/radar.functions";
import { PromovidosPdfImport } from "@/components/prospeccao/PromovidosPdfImport";

export const Route = createFileRoute("/prospeccao/promovidos")({
  head: () => ({
    meta: [
      { title: "Meus leads — Recém promovidos" },
      { name: "description", content: "Leads do Radar Diário Oficial atribuídos à consultora logada." },
      { name: "robots", content: "noindex,nofollow" },
    ],
  }),
  component: Page,
});

const STORAGE_KEY = "radar.consultora.selecionada";

const ABORDAGEM_OPTS: { value: DoRegistro["status_abordagem"]; label: string }[] = [
  { value: "novo", label: "Novo" },
  { value: "contatado", label: "Contatado" },
  { value: "proposta_enviada", label: "Proposta enviada" },
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

function fmtData(iso: string | null): string {
  if (!iso) return "";
  const [y, m, d] = String(iso).slice(0, 10).split("-");
  if (!y || !m || !d) return iso;
  return `${d}/${m}/${y}`;
}
function mesDe(iso: string | null): string {
  return iso ? String(iso).slice(0, 7) : "";
}
function fmtMes(ym: string): string {
  const [y, m] = ym.split("-");
  return new Date(Number(y), Number(m) - 1, 1).toLocaleDateString("pt-BR", { month: "long", year: "numeric" });
}
function potencialBadge(p: string | null) {
  const v = String(p ?? "").trim().toLowerCase();
  if (v === "alto") return <Badge className="bg-emerald-500/15 text-emerald-600 dark:text-emerald-400">Alto potencial</Badge>;
  if (v === "médio" || v === "medio") return <Badge className="bg-amber-500/15 text-amber-600 dark:text-amber-400">Médio potencial</Badge>;
  return null;
}

function Page() {
  const { user, loading } = useAuth();
  const { isAdmin } = useRhAccess();
  const fetchConsultoras = useServerFn(getConsultoras);
  const fetchMinha = useServerFn(getMinhaConsultora);
  const fetchLeads = useServerFn(getMeusLeadsRadar);
  const abordagemFn = useServerFn(marcarAbordagem);

  const [tab, setTab] = useState<"leads" | "pdf">("leads");
  const [consultoras, setConsultoras] = useState<Consultora[]>([]);
  const [consultora, setConsultora] = useState<string>("");
  const [vinculada, setVinculada] = useState(false); // true quando casou por e-mail
  const [leads, setLeads] = useState<DoRegistro[]>([]);
  const [loadingLeads, setLoadingLeads] = useState(false);
  const [q, setQ] = useState("");
  const [mesFiltro, setMesFiltro] = useState("todos");
  const [statusFiltro, setStatusFiltro] = useState("todos");
  const [expandido, setExpandido] = useState<Set<string>>(new Set());

  // Identifica a consultora logada: 1) vínculo por e-mail (tabela consultoras);
  // 2) escolha salva anteriormente; 3) seleção manual.
  useEffect(() => {
    if (!user) return;
    (async () => {
      try {
        const [cs, minha] = await Promise.all([fetchConsultoras(), fetchMinha()]);
        setConsultoras(cs);
        if (minha?.nome) {
          setConsultora(minha.nome);
          setVinculada(true);
        } else {
          const saved = typeof window !== "undefined" ? window.localStorage.getItem(STORAGE_KEY) : null;
          if (saved && cs.some((c) => c.nome === saved)) setConsultora(saved);
        }
      } catch (e: any) {
        toast.error(e?.message ?? "Erro ao carregar consultoras.");
      }
    })();
  }, [user]);

  const loadLeads = async (nome: string) => {
    if (!nome) { setLeads([]); return; }
    setLoadingLeads(true);
    try {
      setLeads(await fetchLeads({ data: { consultora: nome } }));
    } catch (e: any) {
      toast.error(e?.message ?? "Erro ao carregar leads.");
    } finally {
      setLoadingLeads(false);
    }
  };

  useEffect(() => {
    if (consultora) {
      if (!vinculada && typeof window !== "undefined") window.localStorage.setItem(STORAGE_KEY, consultora);
      loadLeads(consultora);
    } else {
      setLeads([]);
    }
  }, [consultora]);

  const handleAbordagem = async (id: string, status: DoRegistro["status_abordagem"]) => {
    try {
      await abordagemFn({ data: { id, status } });
      setLeads((l) => l.map((r) => (r.id === id ? { ...r, status_abordagem: status } : r)));
      toast.success("Situação atualizada.");
    } catch (e: any) {
      toast.error(e?.message ?? "Erro ao atualizar.");
    }
  };

  const toggleExpand = (id: string) =>
    setExpandido((s) => {
      const n = new Set(s);
      n.has(id) ? n.delete(id) : n.add(id);
      return n;
    });

  const mesOptions = useMemo(
    () => Array.from(new Set(leads.map((r) => mesDe(r.data_publicacao)).filter(Boolean))).sort((a, b) => b.localeCompare(a)),
    [leads],
  );

  const visible = useMemo(() => {
    const term = q.trim().toLowerCase();
    return leads.filter((r) => {
      if (mesFiltro !== "todos" && mesDe(r.data_publicacao) !== mesFiltro) return false;
      if (statusFiltro !== "todos" && (r.status_abordagem || "novo") !== statusFiltro) return false;
      if (term && !(
        String(r.nome_servidor).toLowerCase().includes(term) ||
        String(r.cargo ?? "").toLowerCase().includes(term) ||
        String(r.orgao ?? "").toLowerCase().includes(term) ||
        String(r.cpf_parcial ?? "").includes(term)
      )) return false;
      return true;
    });
  }, [leads, q, mesFiltro, statusFiltro]);

  const stats = useMemo(() => {
    const total = leads.length;
    const abordados = leads.filter((r) => (r.status_abordagem || "novo") !== "novo").length;
    return { total, abordados };
  }, [leads]);

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
            <p className="text-sm text-muted-foreground">
              Servidores promovidos do Radar Diário Oficial atribuídos a você.
            </p>
          </div>
        </div>
      </div>

      <div className="mb-6 flex gap-1 border-b">
        <button
          onClick={() => setTab("leads")}
          className={`-mb-px border-b-2 px-4 py-2 text-sm font-medium ${tab === "leads" ? "border-primary text-foreground" : "border-transparent text-muted-foreground hover:text-foreground"}`}
        >
          Meus leads
        </button>
        {isAdmin && (
          <button
            onClick={() => setTab("pdf")}
            className={`-mb-px flex items-center gap-1 border-b-2 px-4 py-2 text-sm font-medium ${tab === "pdf" ? "border-primary text-foreground" : "border-transparent text-muted-foreground hover:text-foreground"}`}
          >
            <FileText className="h-3.5 w-3.5" /> Importar PDF
          </button>
        )}
      </div>

      {tab === "pdf" && isAdmin && <PromovidosPdfImport />}

      {tab === "leads" && (
        <>
          <Card className="mb-6 flex flex-wrap items-end gap-4 p-4">
            <div>
              <label className="mb-1 flex items-center gap-1 text-xs font-medium text-muted-foreground">
                <UserCheck className="h-3.5 w-3.5" /> Consultora
              </label>
              {vinculada ? (
                <div className="flex h-9 items-center gap-2 rounded-md border bg-primary/5 px-3 text-sm font-medium">
                  {consultora}
                  <Badge variant="secondary" className="text-[10px]">vinculada ao seu login</Badge>
                </div>
              ) : (
                <select
                  value={consultora}
                  onChange={(e) => setConsultora(e.target.value)}
                  className="h-9 min-w-56 rounded-md border bg-background px-2 text-sm"
                >
                  <option value="">Selecione seu nome…</option>
                  {consultoras.map((c) => (
                    <option key={c.id} value={c.nome}>{c.nome}{!c.ativo ? " (inativa)" : ""}</option>
                  ))}
                </select>
              )}
            </div>
            {consultora && (
              <div className="flex gap-5 text-sm">
                <div><span className="text-lg font-bold">{stats.total}</span> <span className="text-muted-foreground">leads atribuídos a você</span></div>
                <div><span className="text-lg font-bold text-emerald-600 dark:text-emerald-400">{stats.abordados}</span> <span className="text-muted-foreground">já abordados</span></div>
              </div>
            )}
          </Card>

          {!consultora && (
            <Card className="p-8 text-center text-sm text-muted-foreground">
              Selecione seu nome acima para ver os leads atribuídos a você.
              {!vinculada && " Peça ao administrador para cadastrar seu e-mail na consultora para o vínculo automático."}
            </Card>
          )}

          {consultora && (
            <>
              <div className="mb-4 flex flex-wrap items-end gap-3">
                <div className="relative w-full max-w-xs">
                  <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input className="pl-9" placeholder="Buscar nome, cargo, órgão ou CPF" value={q} onChange={(e) => setQ(e.target.value)} />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-muted-foreground">Mês</label>
                  <select value={mesFiltro} onChange={(e) => setMesFiltro(e.target.value)} className="h-9 rounded-md border bg-background px-2 text-sm capitalize">
                    <option value="todos">Todos os meses</option>
                    {mesOptions.map((m) => <option key={m} value={m}>{fmtMes(m)}</option>)}
                  </select>
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-muted-foreground">Status</label>
                  <select value={statusFiltro} onChange={(e) => setStatusFiltro(e.target.value)} className="h-9 rounded-md border bg-background px-2 text-sm">
                    <option value="todos">Todos os status</option>
                    {ABORDAGEM_OPTS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                  </select>
                </div>
                {(mesFiltro !== "todos" || statusFiltro !== "todos" || q) && (
                  <Button size="sm" variant="ghost" onClick={() => { setMesFiltro("todos"); setStatusFiltro("todos"); setQ(""); }}>Limpar</Button>
                )}
              </div>

              {loadingLeads && (
                <p className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" /> Carregando leads…
                </p>
              )}

              {!loadingLeads && visible.length === 0 && (
                <Card className="p-8 text-center text-sm text-muted-foreground">
                  Nenhum lead encontrado. Novos leads aparecem automaticamente conforme o rodízio.
                </Card>
              )}

              <div className="space-y-3">
                {visible.map((r) => {
                  const st = r.status_abordagem || "novo";
                  const open = expandido.has(r.id);
                  return (
                    <Card key={r.id} className="p-4">
                      {r.data_publicacao && (
                        <div className="mb-2">
                          <Badge className="bg-emerald-500/15 text-emerald-600 dark:text-emerald-400">
                            <PartyPopper className="mr-1 h-3.5 w-3.5" /> Promovido em {fmtData(r.data_publicacao)}
                          </Badge>
                        </div>
                      )}
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <p className="text-base font-semibold">{r.nome_servidor}</p>
                            {potencialBadge(r.potencial_financeiro)}
                          </div>
                          {r.cargo && <p className="text-sm text-muted-foreground">{r.cargo}</p>}
                          <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
                            {r.cpf_parcial && <span>CPF: {r.cpf_parcial}</span>}
                            {r.orgao && <span className="flex items-center gap-1"><Building2 className="h-3.5 w-3.5" /> {r.orgao}</span>}
                            {(r.categoria || r.tipo_movimentacao) && (
                              <Badge variant="secondary" className="text-[10px]">{r.categoria || r.tipo_movimentacao}</Badge>
                            )}
                          </div>
                        </div>
                        <Badge className={ABORDAGEM_STYLE[st] ?? ""}>{ABORDAGEM_LABEL[st] ?? st}</Badge>
                      </div>

                      <div className="mt-3 flex flex-wrap items-center gap-1.5 border-t pt-3">
                        {ABORDAGEM_OPTS.map((o) => (
                          <Button
                            key={o.value}
                            size="sm"
                            variant={st === o.value ? "default" : "outline"}
                            onClick={() => handleAbordagem(r.id, o.value)}
                          >
                            {o.value === "contatado" ? "Abordar" : o.label}
                          </Button>
                        ))}
                        <Button size="sm" variant="ghost" className="ml-auto" onClick={() => toggleExpand(r.id)}>
                          Roteiro {open ? <ChevronUp className="ml-1 h-3.5 w-3.5" /> : <ChevronDown className="ml-1 h-3.5 w-3.5" />}
                        </Button>
                      </div>

                      {open && <Roteiro nome={r.nome_servidor} data={r.data_publicacao} />}
                    </Card>
                  );
                })}
              </div>
            </>
          )}
        </>
      )}
    </AppShell>
  );
}

// Roteiro de abordagem comercial fixo, exibido ao expandir um lead.
function Roteiro({ nome, data }: { nome: string; data: string | null }) {
  const dataFmt = fmtData(data);
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
