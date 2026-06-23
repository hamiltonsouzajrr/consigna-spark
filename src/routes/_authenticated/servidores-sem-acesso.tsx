import { createFileRoute, Navigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { AppShell } from "@/components/AppShell";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { TrendingUp, Target, Copy, Search, ChevronLeft, ChevronRight, Loader2 } from "lucide-react";
import { formatCpf, normalizeCpf } from "@/lib/cpf";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/_authenticated/servidores-sem-acesso")({
  head: () => ({
    meta: [
      { title: "Servidores sem acesso SafeConsig — Grupo Positive" },
      {
        name: "description",
        content:
          "Servidores cadastrados na SafeConsig sem e-mail — alta probabilidade de margem disponível.",
      },
      { name: "robots", content: "noindex,nofollow" },
    ],
  }),
  component: Page,
});

type Lead = {
  id: string;
  cpf: string;
  status: string;
  mensagem: string | null;
  consultado_em: string;
};

const PAGE_SIZE = 20;

function Page() {
  const { user, loading: authLoading } = useAuth();
  const [leads, setLeads] = useState<Lead[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(0);
  const [search, setSearch] = useState("");
  const [debounced, setDebounced] = useState("");

  useEffect(() => {
    const t = setTimeout(() => setDebounced(search), 300);
    return () => clearTimeout(t);
  }, [search]);

  useEffect(() => {
    setPage(0);
  }, [debounced]);

  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    setLoading(true);
    const cpfDigits = normalizeCpf(debounced);
    const from = page * PAGE_SIZE;
    const to = from + PAGE_SIZE - 1;
    (async () => {
      let q = supabase
        .from("safeconsig_leads")
        .select("id,cpf,status,mensagem,consultado_em", { count: "exact" })
        .eq("status", "sem_email")
        .order("consultado_em", { ascending: false })
        .range(from, to);
      if (cpfDigits.length > 0) q = q.ilike("cpf", `%${cpfDigits}%`);
      const { data, count, error } = await q;
      if (cancelled) return;
      if (error) {
        toast.error("Falha ao carregar leads", { description: error.message });
        setLeads([]);
        setTotal(0);
      } else {
        setLeads((data ?? []) as Lead[]);
        setTotal(count ?? 0);
      }
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [user, debounced, page]);

  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  const copyCpf = (cpf: string) => {
    navigator.clipboard.writeText(cpf).then(
      () => toast.success("CPF copiado", { description: formatCpf(cpf) }),
      () => toast.error("Não foi possível copiar"),
    );
  };

  if (authLoading) return null;
  if (!user) return <Navigate to="/login" />;

  return (
    <AppShell>
      <div className="space-y-6">
        {/* Hero */}
        <div className="relative overflow-hidden rounded-xl border bg-gradient-to-br from-emerald-500 via-emerald-600 to-green-700 p-6 text-white shadow-lg">
          <div className="flex items-start justify-between gap-4 flex-wrap">
            <div className="flex items-center gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-white/20 backdrop-blur">
                <TrendingUp className="h-6 w-6" />
              </div>
              <div>
                <h1 className="text-2xl font-bold leading-tight">
                  Servidores sem acesso SafeConsig
                </h1>
                <p className="text-sm text-white/90">
                  Cadastrados sem e-mail — alta probabilidade de margem disponível.
                </p>
              </div>
            </div>
            <div className="rounded-lg bg-white/15 px-4 py-3 backdrop-blur">
              <div className="text-xs uppercase tracking-wide text-white/80">
                Servidores aptos
              </div>
              <div className="text-3xl font-bold tabular-nums">{total}</div>
            </div>
          </div>
        </div>

        {/* Busca */}
        <Card className="p-4">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar por CPF (qualquer parte)..."
              className="pl-9"
              inputMode="numeric"
            />
          </div>
        </Card>

        {/* Lista */}
        {loading ? (
          <div className="flex items-center justify-center py-16 text-muted-foreground">
            <Loader2 className="mr-2 h-5 w-5 animate-spin" /> Carregando...
          </div>
        ) : leads.length === 0 ? (
          <Card className="p-12 text-center text-muted-foreground">
            Nenhum servidor encontrado.
          </Card>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {leads.map((lead) => (
              <Card
                key={lead.id}
                className="relative overflow-hidden border-emerald-200 bg-gradient-to-br from-emerald-50 to-white p-5 shadow-sm transition hover:shadow-md dark:border-emerald-900/50 dark:from-emerald-950/40 dark:to-background"
              >
                <div className="absolute right-0 top-0 h-20 w-20 -translate-y-8 translate-x-8 rounded-full bg-emerald-400/20 blur-2xl" />
                <Badge
                  className="mb-3 border-0 bg-emerald-600 text-white hover:bg-emerald-700"
                >
                  <Target className="mr-1 h-3 w-3" />
                  ALTA CHANCE DE MARGEM
                </Badge>
                <div className="mb-1 text-xs uppercase tracking-wide text-muted-foreground">
                  CPF
                </div>
                <div className="mb-3 font-mono text-xl font-bold tabular-nums text-emerald-900 dark:text-emerald-100">
                  {formatCpf(lead.cpf)}
                </div>
                <div className="mb-4 text-xs text-muted-foreground">
                  Última consulta:{" "}
                  {new Date(lead.consultado_em).toLocaleString("pt-BR")}
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  className="w-full border-emerald-300 text-emerald-700 hover:bg-emerald-100 hover:text-emerald-800 dark:border-emerald-800 dark:text-emerald-200 dark:hover:bg-emerald-900/40"
                  onClick={() => copyCpf(lead.cpf)}
                >
                  <Copy className="mr-2 h-4 w-4" /> Copiar CPF
                </Button>
              </Card>
            ))}
          </div>
        )}

        {/* Paginação */}
        {total > PAGE_SIZE && (
          <div className="flex items-center justify-between gap-2 pt-2">
            <div className="text-sm text-muted-foreground">
              Página {page + 1} de {pages} · {total} servidores
            </div>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                disabled={page === 0}
                onClick={() => setPage((p) => Math.max(0, p - 1))}
              >
                <ChevronLeft className="mr-1 h-4 w-4" /> Anterior
              </Button>
              <Button
                variant="outline"
                size="sm"
                disabled={page >= pages - 1}
                onClick={() => setPage((p) => Math.min(pages - 1, p + 1))}
              >
                Próxima <ChevronRight className="ml-1 h-4 w-4" />
              </Button>
            </div>
          </div>
        )}
      </div>
    </AppShell>
  );
}
