import { createFileRoute, Navigate, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useAuth } from "@/lib/auth";
import { AppShell } from "@/components/AppShell";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import {
  Award, ArrowLeft, Search, Loader2, Building2, Calendar, UserCheck,
} from "lucide-react";
import {
  getConsultoras, getMeusLeadsRadar, marcarAbordagem,
  type Consultora, type DoRegistro,
} from "@/lib/radar/radar.functions";

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

const ABORDAGEM_STYLE: Record<string, string> = {
  novo: "bg-sky-500/15 text-sky-600 dark:text-sky-400",
  contatado: "bg-amber-500/15 text-amber-600 dark:text-amber-400",
  proposta_enviada: "bg-violet-500/15 text-violet-600 dark:text-violet-400",
  convertido: "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400",
  sem_interesse: "bg-muted text-muted-foreground",
};

function fmtData(iso: string | null): string {
  if (!iso) return "";
  const [y, m, d] = iso.split("-");
  if (!y || !m || !d) return iso;
  return `${d}/${m}/${y}`;
}

function potencialBadge(p: string | null) {
  const v = String(p ?? "").trim().toLowerCase();
  if (v === "alto") return <Badge className="bg-emerald-500/15 text-emerald-600 dark:text-emerald-400">Alto potencial</Badge>;
  if (v === "médio" || v === "medio") return <Badge className="bg-amber-500/15 text-amber-600 dark:text-amber-400">Médio potencial</Badge>;
  return null;
}

// Tenta casar o nome do usuário logado com uma consultora cadastrada.
function matchConsultora(consultoras: Consultora[], user: any): string | null {
  const meta = user?.user_metadata ?? {};
  const candidates = [meta.full_name, meta.name, (user?.email ?? "").split("@")[0]]
    .map((s: any) => String(s ?? "").trim().toLowerCase())
    .filter(Boolean);
  for (const c of consultoras) {
    const nome = c.nome.trim().toLowerCase();
    if (candidates.some((cand) => cand === nome || nome.includes(cand) || cand.includes(nome))) {
      return c.nome;
    }
  }
  return null;
}

function Page() {
  const { user, loading } = useAuth();
  const fetchConsultoras = useServerFn(getConsultoras);
  const fetchLeads = useServerFn(getMeusLeadsRadar);
  const abordagemFn = useServerFn(marcarAbordagem);

  const [consultoras, setConsultoras] = useState<Consultora[]>([]);
  const [consultora, setConsultora] = useState<string>("");
  const [leads, setLeads] = useState<DoRegistro[]>([]);
  const [loadingLeads, setLoadingLeads] = useState(false);
  const [q, setQ] = useState("");

  // Carrega a lista de consultoras e define a consultora logada (auto-match
  // pelo nome do usuário, ou a escolha previamente salva).
  useEffect(() => {
    if (!user) return;
    (async () => {
      try {
        const cs = await fetchConsultoras();
        setConsultoras(cs);
        const saved = typeof window !== "undefined" ? window.localStorage.getItem(STORAGE_KEY) : null;
        const savedValid = saved && cs.some((c) => c.nome === saved) ? saved : null;
        const auto = savedValid ?? matchConsultora(cs, user) ?? "";
        setConsultora(auto);
      } catch (e: any) {
        toast.error(e?.message ?? "Erro ao carregar consultoras.");
      }
    })();
  }, [user]);

  const loadLeads = async (nome: string) => {
    if (!nome) {
      setLeads([]);
      return;
    }
    setLoadingLeads(true);
    try {
      const data = await fetchLeads({ data: { consultora: nome } });
      setLeads(data);
    } catch (e: any) {
      toast.error(e?.message ?? "Erro ao carregar leads.");
    } finally {
      setLoadingLeads(false);
    }
  };

  useEffect(() => {
    if (consultora) {
      if (typeof window !== "undefined") window.localStorage.setItem(STORAGE_KEY, consultora);
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

  const visible = useMemo(() => {
    const term = q.trim().toLowerCase();
    if (!term) return leads;
    return leads.filter((r) =>
      String(r.nome_servidor).toLowerCase().includes(term) ||
      String(r.cargo ?? "").toLowerCase().includes(term) ||
      String(r.orgao ?? "").toLowerCase().includes(term),
    );
  }, [leads, q]);

  const stats = useMemo(() => {
    const total = leads.length;
    const novos = leads.filter((r) => (r.status_abordagem || "novo") === "novo").length;
    const convertidos = leads.filter((r) => r.status_abordagem === "convertido").length;
    return { total, novos, convertidos };
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
              <Award className="h-6 w-6 text-amber-500" /> Meus leads — Recém promovidos
            </h1>
            <p className="text-sm text-muted-foreground">
              Servidores promovidos do Radar Diário Oficial atribuídos a você.
            </p>
          </div>
        </div>
      </div>

      <Card className="mb-6 flex flex-wrap items-end gap-4 p-4">
        <div>
          <label className="mb-1 flex items-center gap-1 text-xs font-medium text-muted-foreground">
            <UserCheck className="h-3.5 w-3.5" /> Sou a consultora
          </label>
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
        </div>
        {consultora && (
          <div className="flex gap-4 text-sm">
            <div><span className="font-bold">{stats.total}</span> <span className="text-muted-foreground">leads</span></div>
            <div><span className="font-bold text-sky-600 dark:text-sky-400">{stats.novos}</span> <span className="text-muted-foreground">novos</span></div>
            <div><span className="font-bold text-emerald-600 dark:text-emerald-400">{stats.convertidos}</span> <span className="text-muted-foreground">convertidos</span></div>
          </div>
        )}
      </Card>

      {!consultora && (
        <Card className="p-8 text-center text-sm text-muted-foreground">
          Selecione seu nome acima para ver os leads atribuídos a você.
        </Card>
      )}

      {consultora && (
        <>
          <div className="mb-4 relative w-full max-w-xs">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input className="pl-9" placeholder="Buscar nome, cargo ou órgão" value={q} onChange={(e) => setQ(e.target.value)} />
          </div>

          {loadingLeads && (
            <p className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" /> Carregando leads…
            </p>
          )}

          {!loadingLeads && visible.length === 0 && (
            <Card className="p-8 text-center text-sm text-muted-foreground">
              Nenhum lead atribuído a você ainda. Novos leads aparecem automaticamente conforme o rodízio.
            </Card>
          )}

          <div className="space-y-3">
            {visible.map((r) => {
              const st = r.status_abordagem || "novo";
              return (
                <Card key={r.id} className="p-4">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="font-semibold">{r.nome_servidor}</p>
                        {potencialBadge(r.potencial_financeiro)}
                      </div>
                      {r.cargo && <p className="text-sm text-muted-foreground">{r.cargo}</p>}
                      <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
                        {r.orgao && <span className="flex items-center gap-1"><Building2 className="h-3.5 w-3.5" /> {r.orgao}</span>}
                        {r.data_publicacao && (
                          <span className="flex items-center gap-1 text-sky-600 dark:text-sky-400">
                            <Calendar className="h-3.5 w-3.5" /> 📅 {fmtData(r.data_publicacao)}
                          </span>
                        )}
                      </div>
                      {r.trecho_original && (
                        <p className="mt-2 line-clamp-2 text-xs text-muted-foreground/80">{r.trecho_original}</p>
                      )}
                    </div>
                    <Badge className={ABORDAGEM_STYLE[st] ?? ""}>
                      {ABORDAGEM_OPTS.find((o) => o.value === st)?.label ?? st}
                    </Badge>
                  </div>
                  <div className="mt-3 flex flex-wrap gap-1.5 border-t pt-3">
                    {ABORDAGEM_OPTS.map((o) => (
                      <Button
                        key={o.value}
                        size="sm"
                        variant={st === o.value ? "default" : "outline"}
                        onClick={() => handleAbordagem(r.id, o.value)}
                      >
                        {o.label}
                      </Button>
                    ))}
                  </div>
                </Card>
              );
            })}
          </div>
        </>
      )}
    </AppShell>
  );
}
