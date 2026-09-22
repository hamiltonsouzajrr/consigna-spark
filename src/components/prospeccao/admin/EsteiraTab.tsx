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
import { RhStatCard } from "@/components/rh/RhStatCard";
import { FileSpreadsheet, Upload, AlertTriangle, CheckCircle2, Phone, PiggyBank } from "lucide-react";
import { brl } from "@/lib/rh/mock";
import { lerEsteira, casarConsultora, type EsteiraLinha } from "@/lib/prospeccao/esteira-parse";
import { esteiraConsultoras, esteiraImportar, esteiraMetricas } from "@/lib/prospeccao/esteira.functions";

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
          items: validas.map(({ linha, erros, ...rest }) => rest),
        },
      });
      toast.success(`${r.salvos} contrato(s) na esteira`, {
        description: r.semResponsavel ? `${r.semResponsavel} sem responsável definido` : "Lembretes de amortização criados",
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

      {m && m.porConsultora.length > 0 && (
        <Card className="p-4">
          <h3 className="mb-3 font-semibold">Acompanhamento por consultora</h3>
          <div className="space-y-1">
            {m.porConsultora.map((c) => (
              <div key={c.nome} className="flex items-center gap-3 rounded-md border p-2 text-sm">
                <span className="min-w-0 flex-1 truncate">{c.nome}</span>
                <Badge variant="outline">{c.total} contratos</Badge>
                <Badge variant="outline" className={c.pendentes ? "border-amber-300 text-amber-700" : ""}>
                  {c.pendentes} a ligar
                </Badge>
                <Badge variant="outline">{c.contatos_mes} ligações no mês</Badge>
              </div>
            ))}
          </div>
        </Card>
      )}
    </div>
  );
}
