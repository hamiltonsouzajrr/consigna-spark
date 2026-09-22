import { useMemo, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { RhStatCard } from "@/components/rh/RhStatCard";
import {
  FileSpreadsheet,
  Upload,
  AlertTriangle,
  CheckCircle2,
  Phone,
  PiggyBank,
  ChevronDown,
  Pencil,
  Trash2,
  RotateCcw,
  Eye,
} from "lucide-react";
import { brl } from "@/lib/rh/mock";
import { lerEsteira, casarConsultora, type EsteiraLinha } from "@/lib/prospeccao/esteira-parse";
import { EditarContratoDialog } from "./EditarContratoDialog";
import {
  esteiraConsultoras,
  esteiraImportar,
  esteiraListar,
  esteiraMetricas,
  esteiraLotes,
  esteiraAtualizarLote,
  esteiraRemoverContrato,
  CAMPOS_VISIVEIS_PADRAO,
  type CamposVisiveis,
  type EsteiraContrato,
} from "@/lib/prospeccao/esteira.functions";

const CAMPOS_LABEL: { key: keyof CamposVisiveis; label: string }[] = [
  { key: "status", label: "Status da venda" },
  { key: "banco", label: "Banco" },
  { key: "data_prazo", label: "Data da venda e prazo" },
  { key: "valor_bruto", label: "Valor bruto" },
  { key: "producao", label: "Produção" },
  { key: "digitador", label: "Digitador" },
  { key: "observacao", label: "Observação da planilha" },
];

function CamposToggles({
  campos,
  onChange,
  idPrefix,
}: {
  campos: CamposVisiveis;
  onChange: (c: CamposVisiveis) => void;
  idPrefix: string;
}) {
  return (
    <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
      {CAMPOS_LABEL.map((c) => (
        <div key={c.key} className="flex items-center gap-2 rounded-md border p-2">
          <Switch
            id={`${idPrefix}-${c.key}`}
            checked={campos[c.key]}
            onCheckedChange={(v) => onChange({ ...campos, [c.key]: v })}
          />
          <Label htmlFor={`${idPrefix}-${c.key}`} className="text-xs">
            {c.label}
          </Label>
        </div>
      ))}
    </div>
  );
}

const RESULTADO_LABEL: Record<string, string> = {
  amortizou: "Amortizou",
  falei: "Falei com o cliente",
  nao_atendeu: "Não atendeu",
  nao_quis: "Não quis",
};

function hojeISO(): string {
  return new Date(Date.now() - 3 * 60 * 60 * 1000).toISOString().slice(0, 10);
}

function ordenarContratos(lista: EsteiraContrato[]): EsteiraContrato[] {
  const hoje = hojeISO();
  const peso = (c: EsteiraContrato) => {
    if (!c.acompanhamento_ativo || !c.proximo_contato_em) return 3;
    if (c.proximo_contato_em < hoje) return 0;
    if (c.proximo_contato_em === hoje) return 1;
    return 2;
  };
  return [...lista].sort((a, b) => peso(a) - peso(b) || (a.proximo_contato_em ?? "9999").localeCompare(b.proximo_contato_em ?? "9999"));
}

function ConsultoraDetalhe({
  consultantId,
  contas,
}: {
  consultantId: string | null;
  contas: { user_id: string; nome: string }[];
}) {
  const qc = useQueryClient();
  const listar = useServerFn(esteiraListar);
  const remover = useServerFn(esteiraRemoverContrato);
  const [verRemovidos, setVerRemovidos] = useState(false);
  const [editando, setEditando] = useState<EsteiraContrato | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  const q = useQuery({
    queryKey: ["esteira", "detalhe", consultantId ?? "sem-responsavel", verRemovidos],
    queryFn: () =>
      listar({
        data: {
          ...(consultantId ? { consultantId } : { semResponsavel: true }),
          somenteAtivos: false,
          somenteRemovidos: verRemovidos,
          limit: 500,
        },
      }),
    staleTime: 60_000,
  });
  const hoje = hojeISO();

  const alternar = async (c: EsteiraContrato, removerAgora: boolean) => {
    if (removerAgora && !window.confirm(`Remover ${c.nome} da carteira da consultora?`)) return;
    setBusy(c.id);
    try {
      await remover({ data: { contratoId: c.id, remover: removerAgora } });
      toast.success(removerAgora ? "Cliente removido da carteira" : "Cliente devolvido à carteira");
      await qc.invalidateQueries({ queryKey: ["esteira"] });
    } catch (e: any) {
      toast.error("Não foi possível concluir", { description: e?.message });
    } finally {
      setBusy(null);
    }
  };

  const cabecalho = (
    <div className="flex items-center justify-between gap-2 px-1 pb-2">
      <p className="text-xs text-muted-foreground">
        {verRemovidos ? "Clientes removidos da carteira" : "Clientes ativos na carteira"}
      </p>
      <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={() => setVerRemovidos((v) => !v)}>
        <Eye className="mr-1 h-3.5 w-3.5" /> {verRemovidos ? "Ver ativos" : "Ver removidos"}
      </Button>
    </div>
  );

  if (q.isLoading) return <p className="p-3 text-sm text-muted-foreground">Carregando contratos…</p>;
  if (q.isError) return <p className="p-3 text-sm text-rose-600">Não foi possível carregar os contratos.</p>;
  const lista = ordenarContratos(q.data ?? []);

  return (
    <div className="space-y-1 p-2">
      {cabecalho}
      <EditarContratoDialog contrato={editando} contas={contas} onClose={() => setEditando(null)} />
      {!lista.length && (
        <p className="p-1 text-sm text-muted-foreground">
          {verRemovidos ? "Nenhum cliente removido." : "Nenhum contrato nesta carteira."}
        </p>
      )}
      {lista.map((c) => {
        const atrasado = c.acompanhamento_ativo && c.proximo_contato_em && c.proximo_contato_em < hoje;
        const ehHoje = c.acompanhamento_ativo && c.proximo_contato_em === hoje;
        return (
          <div
            key={c.id}
            className={`flex flex-wrap items-center gap-2 rounded-md border p-2 text-sm ${
              atrasado ? "border-rose-200 bg-rose-50 dark:bg-rose-500/10" : ehHoje ? "border-amber-200 bg-amber-50 dark:bg-amber-500/10" : ""
            }`}
          >
            <div className="min-w-[180px] flex-1">
              <p className="truncate font-medium">{c.nome}</p>
              <p className="truncate text-xs text-muted-foreground">
                {c.cpf} · {c.banco || "—"} · venda {c.data_venda}
                {c.prazo ? ` · ${c.prazo}x` : ""}
              </p>
            </div>
            <span className="w-24 text-right tabular-nums">{c.valor_bruto != null ? brl(c.valor_bruto) : "—"}</span>
            <Badge variant="outline" className={atrasado ? "border-rose-300 text-rose-700" : ehHoje ? "border-amber-300 text-amber-700" : ""}>
              {c.acompanhamento_ativo && c.proximo_contato_em
                ? atrasado
                  ? `Atrasada (${c.proximo_contato_em})`
                  : ehHoje
                    ? "Ligar hoje"
                    : `Próxima: ${c.proximo_contato_em}`
                : "Encerrado"}
            </Badge>
            <span className="text-xs text-muted-foreground">
              {c.ultimo_contato_em
                ? `Última: ${c.ultimo_contato_em.slice(0, 10)}${c.ultimo_resultado ? ` · ${RESULTADO_LABEL[c.ultimo_resultado] ?? c.ultimo_resultado}` : ""}`
                : "Nunca contatado"}
            </span>
            <div className="flex shrink-0 items-center gap-1">
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8"
                title="Editar cliente"
                onClick={() => setEditando(c)}
              >
                <Pencil className="h-4 w-4" />
              </Button>
              {verRemovidos ? (
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 text-emerald-600"
                  title="Devolver à carteira"
                  disabled={busy === c.id}
                  onClick={() => alternar(c, false)}
                >
                  <RotateCcw className="h-4 w-4" />
                </Button>
              ) : (
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 text-rose-600"
                  title="Remover da carteira"
                  disabled={busy === c.id}
                  onClick={() => alternar(c, true)}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

const SEM_DONO = "__sem__";

export function EsteiraTab() {
  const qc = useQueryClient();
  const inputRef = useRef<HTMLInputElement>(null);
  const listarConsultoras = useServerFn(esteiraConsultoras);
  const importar = useServerFn(esteiraImportar);
  const metricas = useServerFn(esteiraMetricas);

  const [linhas, setLinhas] = useState<EsteiraLinha[]>([]);
  const [arquivo, setArquivo] = useState("");
  const [salvando, setSalvando] = useState(false);
  const [aberta, setAberta] = useState<string | null>(null);
  const [campos, setCampos] = useState<CamposVisiveis>(CAMPOS_VISIVEIS_PADRAO);


  const consultorasQ = useQuery({ queryKey: ["esteira", "consultoras"], queryFn: () => listarConsultoras() });
  const metricasQ = useQuery({ queryKey: ["esteira", "metricas"], queryFn: () => metricas(), refetchInterval: 60_000 });
  const contas = consultorasQ.data ?? [];

  const validas = useMemo(() => linhas.filter((l) => l.erros.length === 0), [linhas]);
  const semResponsavel = useMemo(() => validas.filter((l) => !l.consultant_id), [validas]);

  const onFile = async (file: File) => {
    setArquivo(file.name);
    try {
      const lidas = lerEsteira(await file.arrayBuffer());
      if (!lidas.length) {
        toast.error("Não encontrei contratos na planilha", { description: "Confira se há as colunas CPF e NOME." });
        return;
      }
      setLinhas(lidas.map((l) => ({ ...l, consultant_id: casarConsultora(l.consultora, contas) })));
      toast.success(`${lidas.length} contrato(s) lido(s)`);
    } catch {
      toast.error("Não foi possível ler a planilha");
    }
  };

  const setResponsavel = (i: number, userId: string | null) =>
    setLinhas((prev) => prev.map((l, idx) => (idx === i ? { ...l, consultant_id: userId } : l)));

  const aplicarATodas = (nomePlanilha: string, userId: string | null) =>
    setLinhas((prev) => prev.map((l) => (l.consultora === nomePlanilha ? { ...l, consultant_id: userId } : l)));

  const onImportar = async () => {
    if (!validas.length) return;
    setSalvando(true);
    try {
      const r = await importar({
        data: {
          lote: arquivo || undefined,
          campos,
          items: validas.map(({ linha, erros, ...rest }) => rest),
        },
      });
      toast.success(`${r.salvos} contrato(s) na esteira`, {
        description: [
          r.duplicados ? `${r.duplicados} linha(s) repetida(s) na planilha foram ignoradas` : null,
          r.semResponsavel ? `${r.semResponsavel} sem responsável definido` : "Lembretes de amortização criados",
        ]
          .filter(Boolean)
          .join(" · "),
      });

      setLinhas([]);
      setArquivo("");
      qc.invalidateQueries({ queryKey: ["esteira"] });
    } catch (e: any) {
      toast.error("Falha ao importar", { description: e.message });
    } finally {
      setSalvando(false);
    }
  };

  const m = metricasQ.data;

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <RhStatCard label="Contratos na esteira" value={m?.total ?? 0} icon={FileSpreadsheet} />
        <RhStatCard label="Ligações de hoje" value={m?.vencendoHoje ?? 0} icon={Phone} tone="sky" />
        <RhStatCard label="Atrasadas" value={m?.atrasados ?? 0} icon={AlertTriangle} tone="rose" />
        <RhStatCard label="Amortizações no mês" value={m?.amortizacoesMes ?? 0} icon={PiggyBank} tone="emerald" />
      </div>

      <Card className="space-y-4 p-4">
        <div>
          <h3 className="font-semibold">Subir esteira de produção</h3>
          <p className="text-sm text-muted-foreground">
            Planilha com STATUS, DATA, CPF, NOME, BANCO, SEGURO, PRAZO, VALOR BRUTO, PRODUÇÃO, REPASSE, DIGITADOR e
            CONSULTORA. Cada contrato vira um acompanhamento mensal de amortização no mesmo dia do mês da venda.
          </p>
        </div>

        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          className="flex w-full flex-col items-center justify-center gap-2 rounded-xl border border-dashed py-8 text-sm text-muted-foreground transition-colors hover:border-primary hover:text-foreground"
        >
          <FileSpreadsheet className="h-7 w-7" />
          {arquivo ? <span className="font-medium text-foreground">{arquivo}</span> : <span>Clique para selecionar a planilha</span>}
        </button>
        <input
          ref={inputRef}
          type="file"
          accept=".xlsx,.xls,.csv"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) onFile(f);
            e.target.value = "";
          }}
        />

        {linhas.length > 0 && (
          <>
            <div className="flex flex-wrap gap-2 text-xs">
              <Badge variant="secondary" className="border-0 bg-emerald-100 text-emerald-700">
                <CheckCircle2 className="mr-1 h-3 w-3" /> {validas.length} pronto(s)
              </Badge>
              {linhas.length - validas.length > 0 && (
                <Badge variant="secondary" className="border-0 bg-rose-100 text-rose-700">
                  <AlertTriangle className="mr-1 h-3 w-3" /> {linhas.length - validas.length} com erro
                </Badge>
              )}
              {semResponsavel.length > 0 && (
                <Badge variant="secondary" className="border-0 bg-amber-100 text-amber-800">
                  {semResponsavel.length} sem consultora definida
                </Badge>
              )}
            </div>

            <div className="max-h-96 space-y-1 overflow-y-auto rounded-lg border p-2">
              {linhas.map((l, i) => (
                <div
                  key={i}
                  className={`flex flex-wrap items-center gap-2 rounded-md p-2 text-sm ${l.erros.length ? "bg-rose-50 dark:bg-rose-500/10" : ""}`}
                >
                  <div className="min-w-[180px] flex-1">
                    <p className="truncate font-medium">{l.nome || "—"}</p>
                    <p className="truncate text-xs text-muted-foreground">
                      {l.cpf || "sem CPF"} · {l.data_venda || "sem data"} · {l.banco ?? "—"} · {l.prazo ? `${l.prazo}x` : "—"}
                    </p>
                  </div>
                  <span className="w-24 text-right tabular-nums">{l.valor_bruto != null ? brl(l.valor_bruto) : "—"}</span>
                  <Select
                    value={l.consultant_id ?? SEM_DONO}
                    onValueChange={(v) => setResponsavel(i, v === SEM_DONO ? null : v)}
                  >
                    <SelectTrigger className="h-8 w-[210px]">
                      <SelectValue placeholder="Consultora" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value={SEM_DONO}>Sem responsável</SelectItem>
                      {contas.map((c) => (
                        <SelectItem key={c.user_id} value={c.user_id}>
                          {c.nome}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {l.consultora && (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-8 text-xs"
                      onClick={() => aplicarATodas(l.consultora!, l.consultant_id)}
                      title={`Aplicar a todas as linhas de ${l.consultora}`}
                    >
                      {l.consultora}
                    </Button>
                  )}
                  {l.erros.length > 0 && <span className="text-xs text-rose-600">{l.erros.join(", ")}</span>}
                </div>
              ))}
            </div>

            <div className="space-y-2 rounded-lg border p-3">
              <div>
                <h4 className="text-sm font-semibold">O que as consultoras vão ver</h4>
                <p className="text-xs text-muted-foreground">
                  Nome, CPF, telefone, dia da ligação e margem aparecem sempre. O repasse nunca aparece para a
                  consultora.
                </p>
              </div>
              <CamposToggles campos={campos} onChange={setCampos} idPrefix="novo" />
            </div>

            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">Nome do lote</Label>
                <Input value={arquivo} onChange={(e) => setArquivo(e.target.value)} className="h-8 w-[260px]" />
              </div>
              <Button onClick={onImportar} disabled={salvando || !validas.length}>
                <Upload className="mr-2 h-4 w-4" />
                {salvando ? "Importando…" : `Importar ${validas.length} contrato(s)`}
              </Button>
            </div>
          </>
        )}
      </Card>

      <LotesCard />

      {m && m.porConsultora.length > 0 && (
        <Card className="p-4">
          <h3 className="mb-3 font-semibold">Acompanhamento por consultora</h3>
          <p className="mb-3 text-xs text-muted-foreground">Toque na consultora para ver os contratos dela.</p>
          <div className="space-y-1">
            {m.porConsultora.map((c) => {
              const chave = c.consultant_id ?? "sem-responsavel";
              const estaAberta = aberta === chave;
              return (
                <div key={c.nome} className="overflow-hidden rounded-md border">
                  <button
                    type="button"
                    onClick={() => setAberta(estaAberta ? null : chave)}
                    className="flex w-full items-center gap-3 p-2 text-left text-sm transition-colors hover:bg-muted/50"
                  >
                    <ChevronDown className={`h-4 w-4 shrink-0 transition-transform ${estaAberta ? "" : "-rotate-90"}`} />
                    <span className="min-w-0 flex-1 truncate font-medium">{c.nome}</span>
                    <Badge variant="outline">{c.total} contratos</Badge>
                    <Badge variant="outline" className={c.pendentes ? "border-amber-300 text-amber-700" : ""}>
                      {c.pendentes} a ligar
                    </Badge>
                    <Badge variant="outline">{c.contatos_mes} ligações no mês</Badge>
                  </button>
                  {estaAberta && <ConsultoraDetalhe consultantId={c.consultant_id} contas={contas} />}
                </div>
              );
            })}
          </div>
        </Card>
      )}
    </div>
  );
}
