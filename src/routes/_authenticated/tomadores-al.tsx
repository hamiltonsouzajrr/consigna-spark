import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { AppShell } from "@/components/AppShell";
import { supabase } from "@/integrations/supabase/client";
import { useRhAccess } from "@/hooks/use-rh-access";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import { Wallet, Search, Copy, Download, Upload, Users } from "lucide-react";
import { toast } from "sonner";
import tomadoresAsset from "@/assets/tomadores_al.json.asset.json";

export const Route = createFileRoute("/_authenticated/tomadores-al")({
  head: () => ({
    meta: [
      { title: "Clientes Tomadores com Margem — AL" },
      { name: "description", content: "Base de servidores de Alagoas tomadores de crédito com margem disponível, filtros por órgão e valor." },
      { property: "og:title", content: "Clientes Tomadores com Margem — AL" },
      { property: "og:description", content: "Base de servidores de Alagoas tomadores de crédito com margem disponível." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex,nofollow" },
    ],
  }),
  component: Page,
});

const PAGE_SIZE = 25;

type Row = {
  id: string;
  nome: string;
  documento: string;
  descricao_cargo: string | null;
  descricao_lotacao: string | null;
  dt_nascimento: string | null;
  orgao: string | null;
  matricula: string | null;
  margem_disp_cartao_credito: number | null;
  margem_disp_emprestimo: number | null;
  margem_bruta_emprestimo: number | null;
  pct_utilizado_emprestimo: number | null;
};

const brl = (n: number | null) =>
  (n ?? 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

const maskCpf = (d: string) =>
  d.length === 11 ? `${d.slice(0, 3)}.***.***-${d.slice(9)}` : d;

function Page() {
  const { isAdmin } = useRhAccess();
  const [busca, setBusca] = useState("");
  const [termo, setTermo] = useState("");
  const [orgao, setOrgao] = useState("todos");
  const [minMargem, setMinMargem] = useState("0");
  const [page, setPage] = useState(0);
  const [rows, setRows] = useState<Row[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [orgaos, setOrgaos] = useState<string[]>([]);
  const [importing, setImporting] = useState(false);
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    const t = setTimeout(() => { setTermo(busca.trim()); setPage(0); }, 350);
    return () => clearTimeout(t);
  }, [busca]);

  const load = async () => {
    setLoading(true);
    let q = supabase
      .from("tomadores_al")
      .select(
        "id,nome,documento,descricao_cargo,descricao_lotacao,dt_nascimento,orgao,matricula,margem_disp_cartao_credito,margem_disp_emprestimo,margem_bruta_emprestimo,pct_utilizado_emprestimo",
        { count: "exact" },
      )
      .gte("margem_disp_emprestimo", Number(minMargem) || 0)
      .order("margem_disp_emprestimo", { ascending: false })
      .range(page * PAGE_SIZE, page * PAGE_SIZE + PAGE_SIZE - 1);

    if (orgao !== "todos") q = q.eq("orgao", orgao);
    if (termo) {
      const digits = termo.replace(/\D/g, "");
      q = digits.length >= 3
        ? q.ilike("documento", `%${digits}%`)
        : q.ilike("nome", `%${termo}%`);
    }

    const { data, count, error } = await q;
    if (error) toast.error("Erro ao carregar base: " + error.message);
    setRows((data ?? []) as Row[]);
    setTotal(count ?? 0);
    setLoading(false);
  };

  useEffect(() => { load(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [page, orgao, minMargem, termo]);

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
    const head = ["Nome", "CPF", "Órgão", "Lotação", "Matrícula", "Margem Empréstimo", "Margem Cartão", "% Utilizado"];
    const lines = rows.map((r) => [
      r.nome, r.documento, r.orgao ?? "", r.descricao_lotacao ?? "", r.matricula ?? "",
      String(r.margem_disp_emprestimo ?? 0).replace(".", ","),
      String(r.margem_disp_cartao_credito ?? 0).replace(".", ","),
      (r.pct_utilizado_emprestimo ?? 0).toFixed(1).replace(".", ","),
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
              {total.toLocaleString("pt-BR")} servidores na base · margem visível nesta página: {brl(somaMargem)}
            </p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={exportarCsv} disabled={!rows.length}>
              <Download className="mr-2 h-4 w-4" /> Exportar CSV
            </Button>
            {isAdmin && (
              <Button size="sm" onClick={importar} disabled={importing}>
                <Upload className="mr-2 h-4 w-4" />
                {importing ? `Importando ${progress}%` : "Importar planilha"}
              </Button>
            )}
          </div>
        </header>

        <div className="grid gap-4 rounded-xl border border-border/60 bg-card p-4 md:grid-cols-3">
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
        </div>

        {loading ? (
          <p className="py-10 text-center text-sm text-muted-foreground">Carregando base…</p>
        ) : rows.length === 0 ? (
          <div className="rounded-xl border border-dashed border-border/70 p-10 text-center">
            <Users className="mx-auto mb-3 h-8 w-8 text-muted-foreground" />
            <p className="text-sm text-muted-foreground">
              Nenhum tomador encontrado.{isAdmin ? " Use “Importar planilha” para carregar a base." : ""}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto rounded-xl border border-border/60 bg-card">
            <table className="w-full text-sm">
              <thead className="bg-muted/60 text-xs uppercase tracking-wider text-muted-foreground">
                <tr>
                  <th className="px-4 py-3 text-left">Servidor</th>
                  <th className="px-4 py-3 text-left">Órgão</th>
                  <th className="px-4 py-3 text-right">Margem empréstimo</th>
                  <th className="px-4 py-3 text-right">Margem cartão</th>
                  <th className="px-4 py-3 text-right">% utilizado</th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.id} className="border-t border-border/50 align-top">
                    <td className="px-4 py-3">
                      <p className="font-semibold text-foreground">{r.nome}</p>
                      <p className="text-xs text-muted-foreground">
                        {maskCpf(r.documento)} · mat. {r.matricula ?? "—"} · {r.descricao_cargo ?? "—"}
                      </p>
                    </td>
                    <td className="px-4 py-3 text-xs text-muted-foreground">{r.orgao ?? "—"}</td>
                    <td className="px-4 py-3 text-right font-semibold text-foreground">{brl(r.margem_disp_emprestimo)}</td>
                    <td className="px-4 py-3 text-right">{brl(r.margem_disp_cartao_credito)}</td>
                    <td className="px-4 py-3 text-right">
                      <Badge variant={(r.pct_utilizado_emprestimo ?? 0) > 90 ? "destructive" : "secondary"}>
                        {(r.pct_utilizado_emprestimo ?? 0).toFixed(0)}%
                      </Badge>
                    </td>
                    <td className="px-4 py-3 text-right">
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
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
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
