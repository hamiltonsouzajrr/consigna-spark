import { createFileRoute, Navigate } from "@tanstack/react-router";
import { useState, useEffect, useCallback } from "react";
import { AppShell } from "@/components/AppShell";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import {
  Search, Loader2, User, MapPin, Phone, Mail, Building2, AlertTriangle,
  Skull, Shield, Users, Briefcase, TrendingUp, Copy, HardHat, History, Trash2, Clock,
} from "lucide-react";
import { formatCpf } from "@/lib/cpf";

export const Route = createFileRoute("/pesquisas")({
  head: () => ({
    meta: [
      { title: "Pesquisas — Consulta Nova Vida" },
      { name: "description", content: "Busca cadastral por CPF/CNPJ via Nova Vida (NVCHECK)." },
      { name: "robots", content: "noindex,nofollow" },
    ],
  }),
  component: PesquisasPage,
});

type Endereco = {
  POSICAO?: string; TIPO?: string; TITULO?: string; LOGRADOURO?: string;
  NUMERO?: string; COMPLEMENTO?: string; BAIRRO?: string; CIDADE?: string;
  UF?: string; CEP?: string; AREARISCO?: string; LATITUDE?: string; LONGITUDE?: string;
};
type Telefone = {
  POSICAO?: string; DDD?: string; TELEFONE?: string; ASSINANTE?: string;
  TIPO?: string; TIPO_TELEFONE?: string; PROCON?: string; OPERADORA?: string; FLHOT?: string;
};
type Email = { EMAIL?: string; POSICAO?: string };
type Sociedade = {
  CNPJ?: string; RAZAO?: string; PARTICIPACAO?: string; DATA_FUNDACAO?: string;
  CNAE?: string; DESCRICAO_CNAE?: string; STATUS_RF?: string;
};
type Pessoa = { CPF?: string; NOME?: string; VINCULO?: string; NASC?: string };
type VinculoEmpregaticio = {
  CNPJ?: string;
  RAZAO?: string;
  CARGO?: string;
  ADMISSAO?: string;
  VINCULO?: string;
  SALARIO?: string;
  UF?: string;
  CIDADE?: string;
};

type Consulta = {
  CADASTRAIS?: Record<string, string>;
  ENDERECOS?: Endereco[];
  TELEFONES?: Telefone[];
  EMAILS?: Email[];
  SITUACAOCADASTRAL?: { DESCRICAO?: string };
  PERFILCONSUMO?: Record<string, string>;
  CONTATOSRUINS?: Telefone[];
  ULTIMAEMPRESALIGADA?: Sociedade[];
  OBITO?: { FLOBITO?: string };
  PESSOASLIGADAS?: Pessoa[];
  SOCIEDADES?: Sociedade[];
  PEP?: { FLPEP?: string };
  PEPRELACIONADOS?: Pessoa[];
  VINCULOSEMPREGATICIOS?: VinculoEmpregaticio[];
  erro?: string;
};

const blank = (v?: string | number | null) => {
  const s = v == null ? "" : String(v).trim();
  return s ? s : "—";
};
const flagYes = (v?: string) => (v ?? "").toUpperCase() === "S";

type HistoryRow = {
  id: string;
  documento: string;
  tipo: string;
  nome: string | null;
  resultado: Consulta | null;
  created_at: string;
};

function PesquisasPage() {
  const { user, loading } = useAuth();
  const [doc, setDoc] = useState("");
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<Consulta | null>(null);
  const [searchedDoc, setSearchedDoc] = useState<string>("");
  const [history, setHistory] = useState<HistoryRow[]>([]);

  const loadHistory = useCallback(async () => {
    const { data, error } = await supabase
      .from("pesquisas_nv")
      .select("id, documento, tipo, nome, resultado, created_at")
      .order("created_at", { ascending: false })
      .limit(20);
    if (!error && data) setHistory(data as HistoryRow[]);
  }, []);

  useEffect(() => {
    if (user) loadHistory();
  }, [user, loadHistory]);

  if (loading) return null;
  if (!user) return <Navigate to="/login" />;

  const submit = async (e?: React.FormEvent) => {
    e?.preventDefault();
    const clean = doc.replace(/\D/g, "");
    if (clean.length !== 11 && clean.length !== 14) {
      toast.error("Informe um CPF (11) ou CNPJ (14 dígitos)");
      return;
    }
    setBusy(true);
    setResult(null);
    try {
      const { data, error } = await supabase.functions.invoke("nv-check", {
        body: { documento: clean },
      });
      if (error) {
        toast.error(error.message);
        return;
      }
      if (!data?.ok) {
        toast.error(data?.error ?? "Falha na consulta");
        return;
      }
      const consulta = data.data as Consulta;
      setSearchedDoc(clean);
      setResult(consulta);

      // Salva no histórico de pesquisas
      const cad = consulta.CADASTRAIS ?? {};
      const nome = (cad.NOME as string) || (cad.RAZAO as string) || null;
      const tipo = cad.CNPJ ? "PJ" : "PF";
      const { error: insErr } = await supabase.from("pesquisas_nv").insert({
        user_id: user.id,
        documento: clean,
        tipo,
        nome,
        resultado: consulta as unknown as Record<string, unknown>,
      });
      if (!insErr) loadHistory();
    } finally {
      setBusy(false);
    }
  };

  const openFromHistory = (row: HistoryRow) => {
    if (!row.resultado) {
      setDoc(row.documento);
      return;
    }
    setSearchedDoc(row.documento);
    setResult(row.resultado);
  };

  const removeHistory = async (id: string) => {
    setHistory((h) => h.filter((r) => r.id !== id));
    await supabase.from("pesquisas_nv").delete().eq("id", id);
  };

  const copy = (v?: string) => {
    if (!v) return;
    navigator.clipboard.writeText(v).then(() => toast.success("Copiado"));
  };

  return (
    <AppShell>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Pesquisas</h1>
          <p className="text-sm text-muted-foreground">
            Consulta cadastral por CPF/CNPJ via Nova Vida (NVCHECK).
          </p>
        </div>

        <Card className="p-4">
          <form onSubmit={submit} className="flex gap-2">
            <div className="relative flex-1 max-w-md">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={doc}
                onChange={(e) => setDoc(e.target.value)}
                placeholder="Digite o CPF ou CNPJ…"
                inputMode="numeric"
                className="pl-9"
                maxLength={18}
              />
            </div>
            <Button type="submit" disabled={busy}>
              {busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Search className="mr-2 h-4 w-4" />}
              Consultar
            </Button>
          </form>
        </Card>

        {busy && !result && (
          <Card className="p-10 text-center text-sm text-muted-foreground">
            <Loader2 className="mx-auto mb-2 h-6 w-6 animate-spin" />
            Consultando Nova Vida…
          </Card>
        )}

        {result && <ResultView c={result} documento={searchedDoc} onCopy={copy} />}

        <HistoryPanel rows={history} onOpen={openFromHistory} onRemove={removeHistory} />
      </div>
    </AppShell>
  );
}

function HistoryPanel({
  rows, onOpen, onRemove,
}: {
  rows: HistoryRow[];
  onOpen: (row: HistoryRow) => void;
  onRemove: (id: string) => void;
}) {
  const fmtDoc = (d: string, tipo: string) => (tipo === "PJ" ? d : formatCpf(d));
  const fmtDate = (iso: string) => {
    const dt = new Date(iso);
    return dt.toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" });
  };
  return (
    <Card className="p-5">
      <div className="mb-3 flex items-center gap-2">
        <div className="flex h-7 w-7 items-center justify-center rounded-md bg-primary/10 text-primary">
          <History className="h-4 w-4" />
        </div>
        <h3 className="text-sm font-semibold">Histórico de pesquisas</h3>
        <span className="text-xs text-muted-foreground">({rows.length})</span>
      </div>
      {rows.length === 0 ? (
        <p className="text-sm italic text-muted-foreground">Nenhuma pesquisa realizada ainda.</p>
      ) : (
        <div className="space-y-2">
          {rows.map((row) => (
            <div
              key={row.id}
              className="flex items-center justify-between gap-3 rounded-md border bg-muted/30 p-2.5 text-sm"
            >
              <button
                type="button"
                onClick={() => onOpen(row)}
                className="flex min-w-0 flex-1 items-center gap-3 text-left"
              >
                <Badge variant="outline" className="shrink-0">{row.tipo}</Badge>
                <div className="min-w-0">
                  <p className="truncate font-medium">{row.nome || "—"}</p>
                  <p className="truncate text-xs text-muted-foreground">
                    <span className="font-mono">{fmtDoc(row.documento, row.tipo)}</span>
                    <span className="mx-1.5 inline-flex items-center">
                      <Clock className="mr-1 h-3 w-3" /> {fmtDate(row.created_at)}
                    </span>
                  </p>
                </div>
              </button>
              <Button
                size="sm"
                variant="ghost"
                className="shrink-0 text-muted-foreground hover:text-destructive"
                onClick={() => onRemove(row.id)}
                aria-label="Remover do histórico"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            </div>
          ))}
        </div>
      )}
    </Card>
  );
}

function VinculoBadge({ vinculo }: { vinculo?: string }) {
  if (!vinculo) return null;
  const v = vinculo.toUpperCase();
  const isAtivo = v.includes("ATIVO") || v === "ATIVO" || v === "EMPREGADO" || v === "TRABALHANDO";
  const isInativo = v.includes("INATIVO") || v === "INATIVO" || v === "DESLIGADO" || v === "DEMITIDO";
  if (isAtivo) {
    return (
      <Badge variant="outline" className="border-emerald-400/40 bg-emerald-400/10 text-emerald-600">
        <span className="mr-1 inline-block h-1.5 w-1.5 rounded-full bg-emerald-500" />
        Ativo
      </Badge>
    );
  }
  if (isInativo) {
    return (
      <Badge variant="outline" className="border-amber-400/40 bg-amber-400/10 text-amber-600">
        <span className="mr-1 inline-block h-1.5 w-1.5 rounded-full bg-amber-500" />
        Inativo
      </Badge>
    );
  }
  return (
    <Badge variant="outline" className="border-muted-foreground/30 bg-muted/40 text-muted-foreground">
      {vinculo}
    </Badge>
  );
}

function ResultView({ c, documento, onCopy }: { c: Consulta; documento: string; onCopy: (v?: string) => void }) {
  if (c.erro) {
    return (
      <Card className="p-6 border-destructive/40 bg-destructive/5">
        <div className="flex items-start gap-3">
          <AlertTriangle className="mt-0.5 h-5 w-5 text-destructive" />
          <div>
            <p className="font-semibold text-destructive">Sem retorno</p>
            <p className="text-sm text-muted-foreground">{c.erro}</p>
          </div>
        </div>
      </Card>
    );
  }

  const cad = c.CADASTRAIS ?? {};
  const isPJ = !!cad.CNPJ;
  const nome = (cad.NOME as string) || (cad.RAZAO as string) || "—";
  const obito = flagYes(c.OBITO?.FLOBITO);
  const pep = flagYes(c.PEP?.FLPEP);

  // "Dados cadastrais completos": exibe TODOS os demais campos retornados em
  // CADASTRAIS que ainda não aparecem em outras seções, garantindo resposta completa.
  const shownCadKeys = new Set([
    "NOME", "RAZAO", "CNPJ", "CPF", "NASC", "IDADE", "SCORE", "RENDA", "RENDAPRESUMIDA",
    "SEXO", "ESTADOCIVIL", "NACIONALIDADE", "RG", "ORGAOEMISSOR", "POSSIVELPROFISSAO",
    "POSSIVELESCOLARIDADE", "CLASSEECONOMICA", "PERSONADEMOGRAFICA", "FONTE_DE_RENDA",
    "PERSONACREDITO", "MENSAGEMSCORE", "AUXILIOBRASIL", "DIVIDAATIVADAUNIAO_FLAG_DAU",
  ]);
  const outrosCad = Object.entries(cad).filter(
    ([k, v]) => !shownCadKeys.has(k) && v != null && String(v).trim() !== "",
  );
  const humanize = (k: string) =>
    k.replace(/_/g, " ").replace(/\b\w/g, (m) => m.toUpperCase());

  return (
    <div className="space-y-6">
      {/* Header */}
      <Card className="p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="flex items-start gap-4">
            <div className="flex h-14 w-14 items-center justify-center rounded-full bg-primary/10 text-primary">
              {isPJ ? <Building2 className="h-7 w-7" /> : <User className="h-7 w-7" />}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-xl font-bold">{nome}</h2>
                <Badge variant="outline">{isPJ ? "PJ" : "PF"}</Badge>
                {obito && (
                  <Badge variant="outline" className="border-destructive/40 bg-destructive/10 text-destructive">
                    <Skull className="mr-1 h-3 w-3" /> Óbito
                  </Badge>
                )}
                {pep && (
                  <Badge variant="outline" className="border-warning/40 bg-warning/10 text-warning-foreground">
                    <Shield className="mr-1 h-3 w-3" /> PEP
                  </Badge>
                )}
              </div>
              <p className="text-sm text-muted-foreground">
                {isPJ ? cad.CNPJ : formatCpf(documento)}
                {cad.NASC && ` · Nasc. ${cad.NASC}`}
                {cad.IDADE && ` · ${cad.IDADE} anos`}
              </p>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            {cad.SCORE && (
              <StatBadge label="Score" value={String(cad.SCORE)} accent />
            )}
            {c.PERFILCONSUMO?.PROPENSAO_PAGAMENTO && (
              <StatBadge label="Propensão Pgto" value={String(c.PERFILCONSUMO.PROPENSAO_PAGAMENTO)} />
            )}
            {cad.RENDA && <StatBadge label="Renda" value={String(cad.RENDA)} />}
          </div>
        </div>
      </Card>

      <div className="grid gap-4 md:grid-cols-2">
        {/* Cadastrais */}
        <Section icon={<User className="h-4 w-4" />} title="Dados cadastrais">
          <KV label="Sexo" value={cad.SEXO} />
          <KV label="Estado civil" value={cad.ESTADOCIVIL} />
          <KV label="Nacionalidade" value={cad.NACIONALIDADE} />
          <KV label="RG" value={cad.RG && `${cad.RG} ${cad.ORGAOEMISSOR ?? ""}`.trim()} />
          <KV label="Profissão (possível)" value={cad.POSSIVELPROFISSAO} />
          <KV label="Escolaridade (possível)" value={cad.POSSIVELESCOLARIDADE} />
          <KV label="Classe econômica" value={cad.CLASSEECONOMICA} />
          <KV label="Persona demográfica" value={cad.PERSONADEMOGRAFICA} />
          <KV label="Fonte de renda" value={cad.FONTE_DE_RENDA} />
          <KV label="Persona crédito" value={cad.PERSONACREDITO} />
          <KV label="Mensagem score" value={cad.MENSAGEMSCORE} />
          {cad.AUXILIOBRASIL && <KV label="Auxílio Brasil" value={cad.AUXILIOBRASIL} />}
          {cad.DIVIDAATIVADAUNIAO_FLAG_DAU && (
            <KV label="Dívida ativa União" value={cad.DIVIDAATIVADAUNIAO_FLAG_DAU} />
          )}
        </Section>

        {/* Situação cadastral + Perfil */}
        <Section icon={<TrendingUp className="h-4 w-4" />} title="Situação e perfil">
          <KV label="Situação cadastral" value={c.SITUACAOCADASTRAL?.DESCRICAO} />
          <KV label="Consumo" value={c.PERFILCONSUMO?.CONSUMO} />
          <KV label="Persona digital" value={c.PERFILCONSUMO?.PERSONADIGITAL} />
          <KV label="Consultas 6m" value={c.PERFILCONSUMO?.CONSULTADOS_6MESES} />
          <KV label="Consultas 12m" value={c.PERFILCONSUMO?.CONSULTADOS_12MESES} />
          <KV label="Possível aposentado" value={c.PERFILCONSUMO?.POSSIVEL_APOSENTADO} />
          {cad.RENDAPRESUMIDA && <KV label="Renda presumida" value={String(cad.RENDAPRESUMIDA)} />}
        </Section>

        {/* Dados cadastrais completos — todos os demais campos retornados */}
        {outrosCad.length > 0 && (
          <Section icon={<User className="h-4 w-4" />} title="Dados cadastrais completos" wide>
            <div className="grid gap-x-6 sm:grid-cols-2">
              {outrosCad.map(([k, v]) => (
                <KV key={k} label={humanize(k)} value={String(v)} />
              ))}
            </div>
          </Section>
        )}

        {/* Endereços */}
        <Section icon={<MapPin className="h-4 w-4" />} title={`Endereços (${c.ENDERECOS?.length ?? 0})`} wide>
          {(c.ENDERECOS ?? []).length === 0 && <Empty />}
          <div className="space-y-2">
            {(c.ENDERECOS ?? []).map((e, i) => (
              <div key={i} className="rounded-md border bg-muted/30 p-3 text-sm">
                <p className="font-medium">
                  {[e.TIPO, e.TITULO, e.LOGRADOURO].filter(Boolean).join(" ")}{e.NUMERO ? `, ${e.NUMERO}` : ""}
                  {e.COMPLEMENTO ? ` — ${e.COMPLEMENTO}` : ""}
                </p>
                <p className="text-xs text-muted-foreground">
                  {[e.BAIRRO, e.CIDADE, e.UF].filter(Boolean).join(" · ")}
                  {e.CEP ? ` · CEP ${e.CEP}` : ""}
                </p>
                {flagYes(e.AREARISCO) && (
                  <Badge variant="outline" className="mt-1 border-destructive/40 bg-destructive/10 text-destructive">
                    Área de risco
                  </Badge>
                )}
              </div>
            ))}
          </div>
        </Section>

        {/* Telefones */}
        <Section icon={<Phone className="h-4 w-4" />} title={`Telefones (${c.TELEFONES?.length ?? 0})`}>
          {(c.TELEFONES ?? []).length === 0 && <Empty />}
          <div className="space-y-2">
            {(c.TELEFONES ?? []).map((t, i) => {
              const full = `(${t.DDD ?? ""}) ${t.TELEFONE ?? ""}`.trim();
              return (
                <div key={i} className="flex items-center justify-between rounded-md border bg-muted/30 p-2.5 text-sm">
                  <div>
                    <p className="font-mono">{full}</p>
                    <p className="text-xs text-muted-foreground">
                      {[t.TIPO_TELEFONE, t.OPERADORA].filter(Boolean).join(" · ")}
                      {flagYes(t.PROCON) && " · PROCON"}
                      {flagYes(t.FLHOT) && " · HOT"}
                    </p>
                  </div>
                  <Button size="sm" variant="ghost" onClick={() => navigator.clipboard.writeText(full)}>
                    <Copy className="h-3.5 w-3.5" />
                  </Button>
                </div>
              );
            })}
          </div>
        </Section>

        {/* E-mails */}
        <Section icon={<Mail className="h-4 w-4" />} title={`E-mails (${c.EMAILS?.length ?? 0})`}>
          {(c.EMAILS ?? []).length === 0 && <Empty />}
          <div className="space-y-2">
            {(c.EMAILS ?? []).map((e, i) => (
              <div key={i} className="flex items-center justify-between rounded-md border bg-muted/30 p-2.5 text-sm">
                <span className="truncate">{e.EMAIL}</span>
                <Button size="sm" variant="ghost" onClick={() => e.EMAIL && navigator.clipboard.writeText(e.EMAIL)}>
                  <Copy className="h-3.5 w-3.5" />
                </Button>
              </div>
            ))}
          </div>
        </Section>

        {/* Pessoas ligadas */}
        {(c.PESSOASLIGADAS?.length ?? 0) > 0 && (
          <Section icon={<Users className="h-4 w-4" />} title={`Pessoas ligadas (${c.PESSOASLIGADAS!.length})`}>
            <div className="space-y-2">
              {c.PESSOASLIGADAS!.map((p, i) => (
                <div key={i} className="rounded-md border bg-muted/30 p-2.5 text-sm">
                  <div className="flex items-center gap-2">
                    <p className="font-medium">{p.NOME}</p>
                    <VinculoBadge vinculo={p.VINCULO} />
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {p.CPF ? `CPF ${formatCpf(p.CPF)}` : ""}{p.NASC ? ` · ${p.NASC}` : ""}
                  </p>
                </div>
              ))}
            </div>
          </Section>
        )}

        {/* Sociedades */}
        {(c.SOCIEDADES?.length ?? 0) > 0 && (
          <Section icon={<Briefcase className="h-4 w-4" />} title={`Sociedades (${c.SOCIEDADES!.length})`} wide>
            <div className="space-y-2">
              {c.SOCIEDADES!.map((s, i) => (
                <div key={i} className="rounded-md border bg-muted/30 p-2.5 text-sm">
                  <p className="font-medium">{s.RAZAO}</p>
                  <p className="text-xs text-muted-foreground">
                    CNPJ {s.CNPJ}
                    {s.PARTICIPACAO ? ` · ${s.PARTICIPACAO}%` : ""}
                    {s.STATUS_RF ? ` · ${s.STATUS_RF}` : ""}
                  </p>
                  {s.DESCRICAO_CNAE && (
                    <p className="text-xs text-muted-foreground">{s.CNAE} — {s.DESCRICAO_CNAE}</p>
                  )}
                </div>
              ))}
            </div>
          </Section>
        )}

        {/* PEP relacionados */}
        {(c.PEPRELACIONADOS?.length ?? 0) > 0 && (
          <Section icon={<Shield className="h-4 w-4" />} title={`PEP relacionados (${c.PEPRELACIONADOS!.length})`}>
            <div className="space-y-2">
              {c.PEPRELACIONADOS!.map((p, i) => (
                <div key={i} className="rounded-md border bg-muted/30 p-2.5 text-sm">
                  <div className="flex items-center gap-2">
                    <p className="font-medium">{p.NOME}</p>
                    <VinculoBadge vinculo={p.VINCULO} />
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {p.CPF ? `CPF ${formatCpf(p.CPF)}` : ""}
                  </p>
                </div>
              ))}
            </div>
          </Section>
        )}

        {/* Vinculos empregaticios */}
        {(c.VINCULOSEMPREGATICIOS?.length ?? 0) > 0 && (
          <Section icon={<HardHat className="h-4 w-4" />} title={`Vínculos empregatícios (${c.VINCULOSEMPREGATICIOS!.length})`} wide>
            <div className="space-y-2">
              {c.VINCULOSEMPREGATICIOS!.map((v, i) => (
                <div key={i} className="rounded-md border bg-muted/30 p-3 text-sm">
                  <div className="flex items-center justify-between">
                    <p className="font-medium">{v.RAZAO}</p>
                    <VinculoBadge vinculo={v.VINCULO} />
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {v.CNPJ ? `CNPJ ${v.CNPJ}` : ""}
                    {v.CARGO ? ` · ${v.CARGO}` : ""}
                    {v.ADMISSAO ? ` · Admissão ${v.ADMISSAO}` : ""}
                  </p>
                  {(v.SALARIO || v.UF || v.CIDADE) && (
                    <p className="text-xs text-muted-foreground">
                      {v.SALARIO ? `Salário ${v.SALARIO}` : ""}
                      {v.UF ? ` · ${v.UF}${v.CIDADE ? `/${v.CIDADE}` : ""}` : ""}
                    </p>
                  )}
                </div>
              ))}
            </div>
          </Section>
        )}

        {/* Contatos ruins */}
        {(c.CONTATOSRUINS?.length ?? 0) > 0 && (
          <Section icon={<AlertTriangle className="h-4 w-4" />} title={`Contatos ruins (${c.CONTATOSRUINS!.length})`}>
            <div className="flex flex-wrap gap-2">
              {c.CONTATOSRUINS!.map((t, i) => (
                <Badge key={i} variant="outline" className="border-destructive/30 bg-destructive/10 text-destructive">
                  ({t.DDD}) {t.TELEFONE} {t.TIPO && `· ${t.TIPO}`}
                </Badge>
              ))}
            </div>
          </Section>
        )}
      </div>
    </div>
  );
}

function Section({
  icon, title, children, wide,
}: { icon: React.ReactNode; title: string; children: React.ReactNode; wide?: boolean }) {
  return (
    <Card className={`p-5 ${wide ? "md:col-span-2" : ""}`}>
      <div className="mb-3 flex items-center gap-2">
        <div className="flex h-7 w-7 items-center justify-center rounded-md bg-primary/10 text-primary">
          {icon}
        </div>
        <h3 className="text-sm font-semibold">{title}</h3>
      </div>
      {children}
    </Card>
  );
}

function KV({ label, value }: { label: string; value?: string | number | null }) {
  return (
    <div className="flex items-baseline justify-between gap-3 border-b border-border/40 py-1.5 text-sm last:border-0">
      <span className="text-xs uppercase tracking-wide text-muted-foreground">{label}</span>
      <span className="text-right font-medium">{blank(value)}</span>
    </div>
  );
}

function StatBadge({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <div
      className={`rounded-lg border px-3 py-2 text-right ${
        accent ? "border-primary/30 bg-primary/10" : "bg-muted/40"
      }`}
    >
      <p className="text-[10px] uppercase tracking-widest text-muted-foreground">{label}</p>
      <p className={`text-lg font-bold ${accent ? "text-primary" : ""}`}>{value}</p>
    </div>
  );
}

function Empty() {
  return <p className="text-sm text-muted-foreground italic">Nenhum registro retornado.</p>;
}
