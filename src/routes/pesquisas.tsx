import { createFileRoute, Navigate } from "@tanstack/react-router";
import { useState, useEffect, useCallback } from "react";
import { AppShell } from "@/components/AppShell";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/integrations/supabase/client";
import type { Json } from "@/integrations/supabase/types";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import {
  Search, Loader2, User, MapPin, Phone, Mail, Building2, AlertTriangle,
  Skull, Shield, Users, Briefcase, TrendingUp, Copy, HardHat, History, Trash2, Clock,
  Info,
} from "lucide-react";
import { formatCpf } from "@/lib/cpf";

const FINALIDADES = [
  "Análise de crédito",
  "Prevenção à fraude",
  "Cobrança / recuperação",
  "Prospecção comercial",
  "Cadastro / onboarding",
  "Confirmação cadastral",
  "Outra",
] as const;

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

// Calcula a idade (anos completos) a partir de uma data ISO (YYYY-MM-DD).
function calcIdade(iso: string): number | null {
  if (!iso) return null;
  const nasc = new Date(iso + "T00:00:00");
  if (Number.isNaN(nasc.getTime())) return null;
  const hoje = new Date();
  let idade = hoje.getFullYear() - nasc.getFullYear();
  const m = hoje.getMonth() - nasc.getMonth();
  if (m < 0 || (m === 0 && hoje.getDate() < nasc.getDate())) idade--;
  return idade >= 0 && idade <= 130 ? idade : null;
}

type SearchTipo = "cpf" | "cnpj" | "email" | "telefone" | "nome" | null;

// Detecta automaticamente o tipo do termo digitado na barra de busca única.
function detectTipo(value: string): SearchTipo {
  const v = value.trim();
  if (!v) return null;
  if (v.includes("@")) return "email";
  if (/[a-zA-ZÀ-ÿ]/.test(v)) return "nome";
  const digits = v.replace(/\D/g, "");
  if (digits.length === 14) return "cnpj";
  if (digits.length === 11) return "cpf";
  if (digits.length === 10) return "telefone";
  return null; // dígitos incompletos
}

// Máscara para a barra única: formata CPF/CNPJ quando só há dígitos; mantém o texto cru caso contrário.
function maskQuery(value: string): string {
  if (value.includes("@") || /[a-zA-ZÀ-ÿ]/.test(value)) return value;
  const raw = value.replace(/\D/g, "");
  if (raw.length > 11) {
    return raw
      .replace(/^(\d{2})(\d)/, "$1.$2")
      .replace(/^(\d{2})\.(\d{3})(\d)/, "$1.$2.$3")
      .replace(/\.(\d{3})(\d)/, ".$1/$2")
      .replace(/(\d{4})(\d)/, "$1-$2")
      .slice(0, 18);
  }
  return raw
    .replace(/^(\d{3})(\d)/, "$1.$2")
    .replace(/^(\d{3})\.(\d{3})(\d)/, "$1.$2.$3")
    .replace(/\.(\d{3})(\d{1,2})$/, ".$1-$2");
}

const TIPO_LABEL: Record<Exclude<SearchTipo, null>, string> = {
  cpf: "CPF",
  cnpj: "CNPJ",
  email: "E-mail",
  telefone: "Telefone",
  nome: "Nome",
};

type HistoryRow = {
  id: string;
  documento: string;
  tipo: string;
  nome: string | null;
  celular: string | null;
  email: string | null;
  data_nascimento: string | null;
  finalidade: string | null;
  resultado: Consulta | null;
  created_at: string;
};

function PesquisasPage() {
  const { user, loading } = useAuth();
  const [query, setQuery] = useState("");
  const [dataNasc, setDataNasc] = useState("");
  const [email, setEmail] = useState("");
  const [finalidade, setFinalidade] = useState("");
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<Consulta | null>(null);
  const [searchedDoc, setSearchedDoc] = useState<string>("");
  const [history, setHistory] = useState<HistoryRow[]>([]);
  const [showLoteModal, setShowLoteModal] = useState(false);

  const tipoDetectado = detectTipo(query);

  const loadHistory = useCallback(async () => {
    const { data, error } = await supabase
      .from("pesquisas_nv")
      .select("id, documento, tipo, nome, celular, email, data_nascimento, finalidade, resultado, created_at")
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
    const tipo = detectTipo(query);
    if (!tipo) {
      toast.error("Digite um CPF, CNPJ, nome, e-mail ou telefone para buscar");
      return;
    }
    if (tipo !== "cpf" && tipo !== "cnpj") {
      toast.error(
        `A consulta Nova Vida exige um CPF ou CNPJ. Informe o documento para buscar (${TIPO_LABEL[tipo]} não é aceito).`,
      );
      return;
    }
    if (!finalidade.trim()) {
      toast.error("Selecione a finalidade da consulta");
      return;
    }
    const emailTrim = email.trim();
    if (emailTrim && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailTrim)) {
      toast.error("E-mail inválido");
      return;
    }
    const clean = query.replace(/\D/g, "");

    setBusy(true);
    setResult(null);
    try {
      const { data, error } = await supabase.functions.invoke("pesquisa-nvcheck", {
        body: {
          cpf: clean,
          documento: clean,
          finalidade: finalidade.trim(),
        },
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

      // Salva no histórico de pesquisas (com finalidade — auditoria/LGPD)
      const cad = consulta.CADASTRAIS ?? {};
      const nomeResp = (cad.NOME as string) || (cad.RAZAO as string) || null;
      const tipoDoc = cad.CNPJ ? "PJ" : "PF";
      const { error: insErr } = await supabase.from("pesquisas_nv").insert({
        user_id: user.id,
        documento: clean,
        tipo: tipoDoc,
        nome: nomeResp,
        celular: null,
        email: emailTrim || null,
        data_nascimento: dataNasc || null,
        finalidade: finalidade.trim(),
        resultado: consulta as unknown as Json,
      });

      // Registro canônico de auditoria de cada pesquisa
      await supabase.from("pesquisas").insert({
        user_id: user.id,
        tipo_busca: TIPO_LABEL[tipo],
        termo_busca: clean,
        finalidade: finalidade.trim(),
        resultado_json: consulta as unknown as Json,
      });

      if (!insErr) loadHistory();
    } finally {
      setBusy(false);
    }
  };

  const openFromHistory = (row: HistoryRow) => {
    if (!row.resultado) {
      setQuery(maskQuery(row.documento));
      setDataNasc(row.data_nascimento ?? "");
      setEmail(row.email ?? "");
      setFinalidade(row.finalidade ?? "");
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
      <div className="space-y-6 bg-white text-slate-900 -mx-4 -my-4 md:-mx-8 md:-my-8 min-h-screen p-4 md:p-8">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">Pesquisas</h1>
          <p className="text-sm text-slate-500">
            Consulta cadastral por CPF/CNPJ via Nova Vida (NVCHECK).
          </p>
        </div>

        <Card className="p-5 bg-white border-slate-200 shadow-sm">
          <form onSubmit={submit} className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="f-busca">
                Buscar <span className="text-destructive">*</span>
              </Label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <Input
                  id="f-busca"
                  value={query}
                  onChange={(e) => setQuery(maskQuery(e.target.value))}
                  placeholder="CPF, CNPJ, nome, e-mail ou telefone…"
                  className="pl-9 pr-24"
                  autoComplete="off"
                />
                {tipoDetectado && (
                  <Badge
                    variant="secondary"
                    className="absolute right-2 top-1/2 -translate-y-1/2 gap-1"
                  >
                    {tipoDetectado === "email" ? (
                      <Mail className="h-3 w-3" />
                    ) : tipoDetectado === "telefone" ? (
                      <Phone className="h-3 w-3" />
                    ) : tipoDetectado === "cnpj" ? (
                      <Building2 className="h-3 w-3" />
                    ) : (
                      <User className="h-3 w-3" />
                    )}
                    {TIPO_LABEL[tipoDetectado]}
                  </Badge>
                )}
              </div>
              <p className="text-xs text-slate-500">
                A consulta Nova Vida é feita por CPF ou CNPJ. O tipo do termo é detectado automaticamente.
              </p>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="f-nasc" className="flex items-center gap-2">
                  Data de nascimento
                  {calcIdade(dataNasc) != null && (
                    <Badge variant="secondary" className="font-normal">
                      {calcIdade(dataNasc)} anos
                    </Badge>
                  )}
                </Label>
                <Input
                  id="f-nasc"
                  type="date"
                  value={dataNasc}
                  onChange={(e) => setDataNasc(e.target.value)}
                  max={new Date().toISOString().slice(0, 10)}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="f-email">E-mail</Label>
                <Input
                  id="f-email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="email@exemplo.com (opcional)"
                  maxLength={255}
                />
              </div>
            </div>
            <p className="text-xs text-slate-500">
              Data de nascimento e e-mail são opcionais — registrados no histórico para confirmação cadastral.
            </p>



            <div className="space-y-1.5">
              <Label htmlFor="f-finalidade">
                Finalidade <span className="text-destructive">*</span>
              </Label>
              <Select value={finalidade} onValueChange={setFinalidade}>
                <SelectTrigger id="f-finalidade">
                  <SelectValue placeholder="Selecione o motivo da consulta…" />
                </SelectTrigger>
                <SelectContent>
                  {FINALIDADES.map((f) => (
                    <SelectItem key={f} value={f}>{f}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="flex items-center justify-between gap-3">
              <p className="text-xs text-slate-500">
                A finalidade fica registrada no histórico (auditoria/LGPD).
              </p>
              <Button type="submit" disabled={busy} className="bg-blue-600 text-white hover:bg-blue-700 border-0 shadow-sm">
                {busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Search className="mr-2 h-4 w-4" />}
                Consultar
              </Button>
            </div>
          </form>
        </Card>



        {busy && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-white/80 backdrop-blur-sm">
            <Card className="p-8 text-center shadow-2xl bg-white border-slate-200">
              <div className="relative mx-auto mb-4 h-12 w-12">
                <Loader2 className="h-12 w-12 animate-spin text-blue-600" />
              </div>
              <p className="text-base font-medium text-slate-900">Consultando Nova Vida…</p>
              <p className="mt-1 text-sm text-slate-500">Isso pode levar alguns segundos</p>
            </Card>
          </div>
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
    <Card className="p-5 bg-white border-slate-200 shadow-sm">
      <div className="mb-3 flex items-center gap-2">
        <div className="flex h-7 w-7 items-center justify-center rounded-md bg-primary/10 text-primary">
          <History className="h-4 w-4" />
        </div>
        <h3 className="text-sm font-semibold">Histórico de pesquisas</h3>
        <span className="text-xs text-slate-500">({rows.length})</span>
      </div>
      {rows.length === 0 ? (
        <p className="text-sm italic text-slate-500">Nenhuma pesquisa realizada ainda.</p>
      ) : (
        <div className="space-y-2">
          {rows.map((row) => (
            <div
              key={row.id}
              className="flex items-center justify-between gap-3 rounded-md border border-slate-200 bg-slate-50 p-2.5 text-sm"
            >
              <button
                type="button"
                onClick={() => onOpen(row)}
                className="flex min-w-0 flex-1 items-center gap-3 text-left"
              >
                <Badge variant="outline" className="shrink-0">{row.tipo}</Badge>
                <div className="min-w-0">
                  <p className="truncate font-medium">{row.nome || "—"}</p>
                  <p className="truncate text-xs text-slate-500">
                    <span className="font-mono">{fmtDoc(row.documento, row.tipo)}</span>
                    <span className="mx-1.5 inline-flex items-center">
                      <Clock className="mr-1 h-3 w-3" /> {fmtDate(row.created_at)}
                    </span>
                  </p>
                  {row.finalidade && (
                    <Badge variant="secondary" className="mt-1 text-[10px] font-normal">
                      {row.finalidade}
                    </Badge>
                  )}
                </div>
              </button>
              <Button
                size="sm"
                variant="ghost"
                className="shrink-0 text-slate-400 hover:text-red-600"
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
    <Badge variant="outline" className="border-slate-300 bg-slate-100 text-slate-600">
      {vinculo}
    </Badge>
  );
}

function ResultView({ c, documento, onCopy }: { c: Consulta; documento: string; onCopy: (v?: string) => void }) {
  if (c.erro) {
    return (
      <Card className="p-6 border-red-200 bg-red-50">
        <div className="flex items-start gap-3">
          <AlertTriangle className="mt-0.5 h-5 w-5 text-destructive" />
          <div>
            <p className="font-semibold text-destructive">Sem retorno</p>
            <p className="text-sm text-slate-500">{c.erro}</p>
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
    "CIDADE", "UF",
  ]);
  const outrosCad = Object.entries(cad).filter(
    ([k, v]) => !shownCadKeys.has(k) && v != null && String(v).trim() !== "",
  );
  const humanize = (k: string) =>
    k.replace(/_/g, " ").replace(/\b\w/g, (m) => m.toUpperCase());

  // Perfil de consumo: demais campos não exibidos na seção "Situação e perfil".
  const shownPerfilKeys = new Set([
    "PROPENSAO_PAGAMENTO", "CONSUMO", "PERSONADIGITAL",
    "CONSULTADOS_6MESES", "CONSULTADOS_12MESES", "POSSIVEL_APOSENTADO",
  ]);
  const perfil = c.PERFILCONSUMO ?? {};
  const outrosPerfil = Object.entries(perfil).filter(
    ([k, v]) => !shownPerfilKeys.has(k) && v != null && String(v).trim() !== "",
  );

  // Catch-all: qualquer outra seção retornada que ainda não tem exibição própria.
  const handledTopKeys = new Set([
    "CADASTRAIS", "ENDERECOS", "TELEFONES", "EMAILS", "SITUACAOCADASTRAL",
    "PERFILCONSUMO", "CONTATOSRUINS", "OBITO", "PESSOASLIGADAS", "SOCIEDADES",
    "PEP", "PEPRELACIONADOS", "VINCULOSEMPREGATICIOS", "erro",
  ]);
  const extras = Object.entries(c as Record<string, unknown>).filter(
    ([k, v]) =>
      !handledTopKeys.has(k) &&
      v != null &&
      (Array.isArray(v) ? v.length > 0 : String(v).trim() !== ""),
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <Card className="p-6 bg-white border-slate-200 shadow-sm">
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
              <p className="text-sm text-slate-500">
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
          <KV label="Cidade / UF" value={[cad.CIDADE, cad.UF].filter(Boolean).join(" / ")} />
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

        {/* Perfil de consumo completo — demais campos retornados */}
        {outrosPerfil.length > 0 && (
          <Section icon={<TrendingUp className="h-4 w-4" />} title="Perfil de consumo completo" wide>
            <div className="grid gap-x-6 sm:grid-cols-2">
              {outrosPerfil.map(([k, v]) => (
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
              <div key={i} className="rounded-md border border-slate-200 bg-slate-50 p-3 text-sm">
                <p className="font-medium">
                  {[e.TIPO, e.TITULO, e.LOGRADOURO].filter(Boolean).join(" ")}{e.NUMERO ? `, ${e.NUMERO}` : ""}
                  {e.COMPLEMENTO ? ` — ${e.COMPLEMENTO}` : ""}
                </p>
                <p className="text-xs text-slate-500">
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
                <div key={i} className="flex items-center justify-between rounded-md border border-slate-200 bg-slate-50 p-2.5 text-sm">
                  <div>
                    <p className="font-mono">{full}</p>
                    <p className="text-xs text-slate-500">
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
              <div key={i} className="flex items-center justify-between rounded-md border border-slate-200 bg-slate-50 p-2.5 text-sm">
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
                <div key={i} className="rounded-md border border-slate-200 bg-slate-50 p-2.5 text-sm">
                  <div className="flex items-center gap-2">
                    <p className="font-medium">{p.NOME}</p>
                    <VinculoBadge vinculo={p.VINCULO} />
                  </div>
                  <p className="text-xs text-slate-500">
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
                <div key={i} className="rounded-md border border-slate-200 bg-slate-50 p-2.5 text-sm">
                  <p className="font-medium">{s.RAZAO}</p>
                  <p className="text-xs text-slate-500">
                    CNPJ {s.CNPJ}
                    {s.PARTICIPACAO ? ` · ${s.PARTICIPACAO}%` : ""}
                    {s.STATUS_RF ? ` · ${s.STATUS_RF}` : ""}
                  </p>
                  {s.DESCRICAO_CNAE && (
                    <p className="text-xs text-slate-500">{s.CNAE} — {s.DESCRICAO_CNAE}</p>
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
                <div key={i} className="rounded-md border border-slate-200 bg-slate-50 p-2.5 text-sm">
                  <div className="flex items-center gap-2">
                    <p className="font-medium">{p.NOME}</p>
                    <VinculoBadge vinculo={p.VINCULO} />
                  </div>
                  <p className="text-xs text-slate-500">
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
                <div key={i} className="rounded-md border border-slate-200 bg-slate-50 p-3 text-sm">
                  <div className="flex items-center justify-between">
                    <p className="font-medium">{v.RAZAO}</p>
                    <VinculoBadge vinculo={v.VINCULO} />
                  </div>
                  <p className="text-xs text-slate-500">
                    {v.CNPJ ? `CNPJ ${v.CNPJ}` : ""}
                    {v.CARGO ? ` · ${v.CARGO}` : ""}
                    {v.ADMISSAO ? ` · Admissão ${v.ADMISSAO}` : ""}
                  </p>
                  {(v.SALARIO || v.UF || v.CIDADE) && (
                    <p className="text-xs text-slate-500">
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

        {/* Outras informações — qualquer outra seção retornada sem exibição própria */}
        {extras.map(([k, v]) => (
          <Section key={k} icon={<User className="h-4 w-4" />} title={humanize(k)} wide>
            {Array.isArray(v) ? (
              <div className="space-y-2">
                {(v as Record<string, unknown>[]).map((item, i) => (
                  <div key={i} className="rounded-md border border-slate-200 bg-slate-50 p-2.5 text-sm">
                    {item && typeof item === "object" ? (
                      <div className="grid gap-x-6 sm:grid-cols-2">
                        {Object.entries(item).map(([ik, iv]) =>
                          iv != null && String(iv).trim() !== "" ? (
                            <KV key={ik} label={humanize(ik)} value={String(iv)} />
                          ) : null,
                        )}
                      </div>
                    ) : (
                      <span>{String(item)}</span>
                    )}
                  </div>
                ))}
              </div>
            ) : typeof v === "object" ? (
              <div className="grid gap-x-6 sm:grid-cols-2">
                {Object.entries(v as Record<string, unknown>).map(([ik, iv]) =>
                  iv != null && String(iv).trim() !== "" ? (
                    <KV key={ik} label={humanize(ik)} value={String(iv)} />
                  ) : null,
                )}
              </div>
            ) : (
              <p className="text-sm">{String(v)}</p>
            )}
          </Section>
        ))}
      </div>
    </div>
  );
}

function Section({
  icon, title, children, wide,
}: { icon: React.ReactNode; title: string; children: React.ReactNode; wide?: boolean }) {
  return (
    <Card className={`p-5 bg-white border-slate-200 shadow-sm ${wide ? "md:col-span-2" : ""}`}>
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
    <div className="flex items-baseline justify-between gap-3 border-b border-slate-200 py-1.5 text-sm last:border-0">
      <span className="text-xs uppercase tracking-wide text-slate-500">{label}</span>
      <span className="text-right font-medium text-slate-900">{blank(value)}</span>
    </div>
  );
}

function StatBadge({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <div
      className={`rounded-lg border px-3 py-2 text-right ${
        accent ? "border-blue-200 bg-blue-50" : "bg-slate-100 border-slate-200"
      }`}
    >
      <p className="text-[10px] uppercase tracking-widest text-slate-500">{label}</p>
      <p className={`text-lg font-bold ${accent ? "text-blue-600" : "text-slate-900"}`}>{value}</p>
    </div>
  );
}

function Empty() {
  return <p className="text-sm text-slate-500 italic">Nenhum registro retornado.</p>;
}
