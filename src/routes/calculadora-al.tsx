import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { AppShell } from "@/components/AppShell";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Alert, AlertTitle, AlertDescription } from "@/components/ui/alert";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Calculator, RefreshCw, AlertTriangle, TrendingUp, Sparkles, Copy, Wallet, CreditCard, Gift, Banknote, Info, ShieldAlert } from "lucide-react";
import {
  ORGAOS_AL, brl, registrarLog,
  type OrgaoAL,
} from "@/lib/al";
import { calcPrevidenciaProgressiva } from "@/lib/al/previdencia";
import { aliquotaIR } from "@/lib/al/imposto";
import { calcMargens } from "@/lib/al/margem";
import { estimarCredito } from "@/lib/al/credito";

export const Route = createFileRoute("/calculadora-al")({
  head: () => ({
    meta: [
      { title: "Calculadora de Margem Consignável — Alagoas" },
      { name: "description", content: "Calculadora manual de margem consignável e simulação de reajuste para servidores de Alagoas." },
      { property: "og:title", content: "Calculadora de Margem Consignável — Alagoas" },
      { property: "og:description", content: "Calculadora manual de margem consignável e simulação de reajuste para servidores de Alagoas." },
      { property: "og:url", content: "https://consigna-spark.lovable.app/calculadora-al" },
    ],
    links: [{ rel: "canonical", href: "https://consigna-spark.lovable.app/calculadora-al" }],
  }),
  component: CalculadoraALPage,
});

type Descontos = {
  pensao: string; fardamento: string; judicial: string;
  sindicato: string; alprev: string; ir: string; outro: string;
};

const DESC_LABELS: { key: keyof Descontos; label: string }[] = [
  { key: "pensao", label: "Pensão Alimentícia" },
  { key: "fardamento", label: "Fardamento" },
  { key: "judicial", label: "Depósito Judicial" },
  { key: "sindicato", label: "Sindicato" },
  { key: "alprev", label: "AL Previdência / ALPREV" },
  { key: "ir", label: "Imposto de Renda (IR / IRRF)" },
  { key: "outro", label: "Outro Desconto Compulsório" },
];

const MARGENS = [
  { label: "Margem Principal", pct: 0.45 },
  { label: "Cartão de Crédito Consignado", pct: 0.10 },
  { label: "Cartão Benefício", pct: 0.10 },
];

const emptyDesc: Descontos = {
  pensao: "", fardamento: "", judicial: "", sindicato: "", alprev: "", ir: "", outro: "",
};

const num = (v: string) => {
  const n = parseFloat(String(v).replace(",", "."));
  return isFinite(n) && n > 0 ? n : 0;
};

// ============================================================================
// Calculadora Manual (original)
// ============================================================================

function ManualForm({
  salario, setSalario, descontos, setDescontos, onCalcular,
}: {
  salario: string; setSalario: (v: string) => void;
  descontos: Descontos; setDescontos: (d: Descontos) => void;
  onCalcular: () => void;
}) {
  const salarioNum = num(salario);
  const totalDesc = DESC_LABELS.reduce((s, d) => s + num(descontos[d.key]), 0);
  const podeCalcular = salarioNum > 0;
  const excede = salarioNum > 0 && totalDesc > salarioNum;

  return (
    <div className="space-y-6">
      <Card className="rounded-3xl">
        <CardHeader>
          <CardTitle>Salário Base</CardTitle>
          <CardDescription>
            Salário / Subsídio / Base de Vencimento — valor fixo, sem adicionais.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Label htmlFor="salario">Salário Base (R$) *</Label>
          <Input id="salario" type="number" step="0.01" inputMode="decimal" placeholder="0,00"
            value={salario} onChange={(e) => setSalario(e.target.value)} className="mt-1" />
        </CardContent>
      </Card>

      <Card className="rounded-3xl">
        <CardHeader>
          <CardTitle>Descontos Compulsórios</CardTitle>
          <CardDescription>Informe apenas os descontos aplicáveis. Vazio = 0.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-2">
            {DESC_LABELS.map((d) => (
              <div key={d.key}>
                <Label htmlFor={d.key}>{d.label} (R$)</Label>
                <Input id={d.key} type="number" step="0.01" inputMode="decimal" placeholder="0,00"
                  value={descontos[d.key]}
                  onChange={(e) => setDescontos({ ...descontos, [d.key]: e.target.value })}
                  className="mt-1" />
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {!podeCalcular && (
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>Salário obrigatório</AlertTitle>
          <AlertDescription>Informe ao menos o Salário Base para calcular.</AlertDescription>
        </Alert>
      )}
      {excede && (
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>Descontos excedem o salário</AlertTitle>
          <AlertDescription>
            Total ({brl(totalDesc)}) maior que Salário Base ({brl(salarioNum)}).
          </AlertDescription>
        </Alert>
      )}

      <div className="flex justify-end">
        <Button size="lg" onClick={onCalcular} disabled={!podeCalcular}>
          <Calculator className="h-4 w-4" /> Calcular Margens
        </Button>
      </div>
    </div>
  );
}

function ResultsDisplay({
  salario, setSalario, descontos, setDescontos, onNovo,
}: {
  salario: string; setSalario: (v: string) => void;
  descontos: Descontos; setDescontos: (d: Descontos) => void;
  onNovo: () => void;
}) {
  const salarioNum = num(salario);
  const totalDesc = useMemo(
    () => DESC_LABELS.reduce((s, d) => s + num(descontos[d.key]), 0),
    [descontos]
  );
  const liquido = Math.max(0, salarioNum - totalDesc);
  const excede = totalDesc > salarioNum;

  return (
    <div className="space-y-6">
      <Card className="rounded-3xl">
        <CardHeader>
          <CardTitle>Dados Gerais</CardTitle>
          <CardDescription>Edite e veja o recálculo em tempo real.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-3">
          <div>
            <Label>Salário Base (R$)</Label>
            <Input type="number" step="0.01" inputMode="decimal"
              value={salario} onChange={(e) => setSalario(e.target.value)} className="mt-1" />
            <p className="mt-1 text-xs text-muted-foreground">{brl(salarioNum)}</p>
          </div>
          <div className="rounded-xl bg-muted/40 p-4">
            <p className="text-xs uppercase tracking-wide text-muted-foreground">Total Descontos</p>
            <p className="mt-1 text-2xl font-semibold">{brl(totalDesc)}</p>
          </div>
          <div className="rounded-xl bg-primary/10 p-4">
            <p className="text-xs uppercase tracking-wide text-primary">Salário Líquido Base</p>
            <p className="mt-1 text-2xl font-bold text-primary">{brl(liquido)}</p>
          </div>
        </CardContent>
      </Card>

      {excede && (
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>Atenção</AlertTitle>
          <AlertDescription>Os descontos excedem o salário base.</AlertDescription>
        </Alert>
      )}

      <Card className="rounded-3xl">
        <CardHeader><CardTitle>Descontos Compulsórios</CardTitle></CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Desconto</TableHead>
                <TableHead className="w-[200px]">Valor</TableHead>
                <TableHead className="w-[200px] text-right">Editar</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {DESC_LABELS.map((d) => (
                <TableRow key={d.key}>
                  <TableCell>{d.label}</TableCell>
                  <TableCell>{brl(num(descontos[d.key]))}</TableCell>
                  <TableCell className="text-right">
                    <Input type="number" step="0.01" inputMode="decimal"
                      value={descontos[d.key]}
                      onChange={(e) => setDescontos({ ...descontos, [d.key]: e.target.value })}
                      placeholder="0,00" className="h-8" />
                  </TableCell>
                </TableRow>
              ))}
              <TableRow>
                <TableCell className="font-semibold">Total</TableCell>
                <TableCell className="font-semibold">{brl(totalDesc)}</TableCell>
                <TableCell />
              </TableRow>
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Card className="rounded-3xl">
        <CardHeader>
          <CardTitle>Margens Consignáveis por Produto</CardTitle>
          <CardDescription>Calculadas sobre o Salário Líquido Base ({brl(liquido)}).</CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Produto</TableHead>
                <TableHead className="w-[100px]">%</TableHead>
                <TableHead className="w-[200px] text-right">Valor (R$)</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {MARGENS.map((m) => (
                <TableRow key={m.label}>
                  <TableCell>{m.label}</TableCell>
                  <TableCell>{(m.pct * 100).toFixed(0)}%</TableCell>
                  <TableCell className="text-right font-semibold">{brl(liquido * m.pct)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <div className="flex justify-between">
        <Button variant="outline" onClick={onNovo}>
          <RefreshCw className="h-4 w-4" /> Novo cálculo
        </Button>
      </div>
    </div>
  );
}

// ============================================================================
// Simulação de Reajuste AL — nova aba
// ============================================================================

function StatCard({
  icon: Icon, label, value, accent = false, big = false,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string; value: string; accent?: boolean; big?: boolean;
}) {
  return (
    <div
      className={[
        "relative overflow-hidden rounded-2xl border p-5 backdrop-blur-md transition-all",
        "shadow-[0_8px_30px_-12px_rgba(0,0,0,0.15)] hover:shadow-[0_12px_40px_-12px_rgba(0,0,0,0.25)]",
        accent
          ? "border-primary/30 bg-gradient-to-br from-primary/10 via-primary/5 to-transparent"
          : "border-border/60 bg-background/60",
      ].join(" ")}
    >
      <div className="flex items-center gap-2">
        <div className={[
          "flex h-9 w-9 items-center justify-center rounded-xl",
          accent ? "bg-primary/15 text-primary" : "bg-muted text-muted-foreground",
        ].join(" ")}>
          <Icon className="h-4 w-4" />
        </div>
        <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</p>
      </div>
      <p className={[
        "mt-3 font-bold tabular-nums",
        big ? "text-3xl md:text-4xl" : "text-2xl",
        accent ? "text-primary" : "text-foreground",
      ].join(" ")}>
        {value}
      </p>
    </div>
  );
}

type SimResult = {
  ok: true;
  salarioAtual: number;
  novoSalario: number;
  bruto: number;
  descPrevidencia: number;
  descIR: number;
  descPensao: number;
  totalDescontos: number;
  pctPrevidencia: number;
  pctIR: number;
  pctTotal: number;
  aliquotaIRPct: number;
  liquidoAumento: number;
  margens: ReturnType<typeof calcMargens>;
  credito: ReturnType<typeof estimarCredito>;
} | { ok: false; reason: string };

function calcularSimulacao(
  salario: number,
  descontos: Descontos,
  pct: number,
  orgao: OrgaoAL,
): SimResult {
  if (salario <= 0) return { ok: false, reason: "Informe o Salário Base na Calculadora Manual." };
  if (pct <= 0) return { ok: false, reason: "Informe um percentual de reajuste maior que zero." };

  const bruto = salario * pct;
  const novoSalario = salario + bruto;

  // Descontos aplicados DIRETAMENTE sobre o aumento bruto, usando as alíquotas
  // efetivas do servidor (mesma lógica do infográfico: % do desconto atual × bruto).

  // AL Previdência: % efetivo do desconto informado sobre o salário; fallback = alíquota
  // marginal progressiva no novo subsídio.
  const alprevInformado = num(descontos.alprev);
  const pctPrevidencia = alprevInformado > 0
    ? alprevInformado / salario
    : (() => {
        const prevNovo = calcPrevidenciaProgressiva(novoSalario) ?? 0;
        const prevAtual = calcPrevidenciaProgressiva(salario) ?? 0;
        return bruto > 0 ? Math.max(0, prevNovo - prevAtual) / bruto : 0;
      })();
  const descPrevidencia = bruto * pctPrevidencia;

  // Pensão: % efetivo da pensão informada sobre o salário aplicado ao aumento bruto.
  const pensaoAtual = num(descontos.pensao);
  const pctPensao = pensaoAtual > 0 ? pensaoAtual / salario : 0;
  const descPensao = bruto * pctPensao;

  // Imposto de Renda: usa alíquota marginal aplicável à nova base tributável
  // (subsídio - previdência - pensão), aplicada sobre o aumento bruto.
  const prevNovoTotal = calcPrevidenciaProgressiva(novoSalario) ?? 0;
  const baseIRNova = Math.max(0, novoSalario - prevNovoTotal - (pensaoAtual + descPensao));
  const irInformado = num(descontos.ir);
  const aliqMarginalIR = aliquotaIR(baseIRNova);
  // Se o usuário informou IR, usa a alíquota efetiva real dele (mais fiel à folha);
  // senão, usa a marginal progressiva.
  const pctIR = irInformado > 0 ? irInformado / salario : aliqMarginalIR;
  const descIR = bruto * pctIR;

  const totalDescontos = descPrevidencia + descIR + descPensao;
  const liquidoAumento = Math.max(0, bruto - totalDescontos);
  const pctTotal = bruto > 0 ? totalDescontos / bruto : 0;

  // Margens calculadas SOBRE O AUMENTO LÍQUIDO (conforme infográfico),
  // representando a NOVA margem liberada pelo reajuste.
  const margens = calcMargens(liquidoAumento, orgao);
  const credito = margens ? estimarCredito(margens) : null;
  if (!margens || !credito) return { ok: false, reason: "Falha ao calcular margens/crédito." };

  return {
    ok: true,
    salarioAtual: salario,
    novoSalario,
    bruto,
    descPrevidencia,
    descIR,
    descPensao,
    totalDescontos,
    pctPrevidencia,
    pctIR,
    pctTotal,
    aliquotaIRPct: aliqMarginalIR,
    liquidoAumento,
    margens,
    credito,
  };
}

function gerarTextoSimulacao(sim: Extract<SimResult, { ok: true }>, pct: number): string {
  const pctTxt = (pct * 100).toFixed(pct * 100 % 1 === 0 ? 0 : 1);
  return (
`Com o reajuste salarial de ${pctTxt}%, o aumento líquido estimado é de ${brl(sim.liquidoAumento)}.

Nova margem liberada aproximada:
• ${brl(sim.margens!.principal)} de margem principal
• ${brl(sim.margens!.cartaoBeneficio)} de cartão benefício
• ${brl(sim.margens!.cartaoConsignado)} de cartão consignado

Estimativa de crédito disponível:
${brl(sim.credito!.total.min)} a ${brl(sim.credito!.total.max)} (média ${brl(sim.credito!.total.medio)}).

* Valores simulados com base em estimativas médias do Estado de Alagoas.`
  );
}

function SimulacaoReajusteAL({
  salario, descontos,
}: {
  salario: string;
  descontos: Descontos;
}) {
  const [reajuste, setReajuste] = useState("6");
  const [orgao, setOrgao] = useState<OrgaoAL>("estado_al");

  const sub = num(salario);
  const pct = num(reajuste) / 100;
  const preenchido = sub > 0;

  const resultado = useMemo(
    () => calcularSimulacao(sub, descontos, pct, orgao),
    [sub, descontos, pct, orgao],
  );

  useMemo(() => {
    if (!preenchido) return;
    registrarLog({
      at: new Date().toISOString(),
      subsidio: sub, percentual: pct, orgao,
      liquido: resultado.ok ? resultado.liquidoAumento : undefined,
      ok: resultado.ok,
    });
  }, [resultado.ok, sub, pct, orgao]); // eslint-disable-line react-hooks/exhaustive-deps

  const copiar = async () => {
    if (!resultado.ok) return;
    try {
      await navigator.clipboard.writeText(gerarTextoSimulacao(resultado, pct));
      toast.success("Simulação copiada", { description: "Texto pronto para enviar no WhatsApp." });
    } catch {
      toast.error("Não foi possível copiar");
    }
  };

  const orgaoMeta = ORGAOS_AL.find((o) => o.value === orgao);
  const faixaAlta = sub > 25000;
  const altaMargem = resultado.ok && (resultado.margens?.total ?? 0) > 300;

  if (!preenchido) {
    return (
      <Alert>
        <Info className="h-4 w-4" />
        <AlertTitle>Preencha a Calculadora Manual primeiro</AlertTitle>
        <AlertDescription>
          A simulação de reajuste usa o <strong>Salário Base</strong> e os <strong>descontos compulsórios</strong>{" "}
          (AL Previdência, Pensão, IR e demais) informados na aba <strong>Calculadora Manual</strong>.
          Volte lá, preencha os dados do servidor e retorne para simular o reajuste.
        </AlertDescription>
      </Alert>
    );
  }

  return (
    <div className="space-y-6">
      {/* Resumo do que veio da Calculadora Manual */}
      <Card className="rounded-3xl border-primary/20 bg-primary/5">
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Info className="h-4 w-4 text-primary" /> Base usada da Calculadora Manual
          </CardTitle>
          <CardDescription>Edite os valores na aba “Calculadora Manual” para atualizar.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-3 sm:grid-cols-2 md:grid-cols-4">
          <div className="rounded-xl bg-background/60 p-3">
            <p className="text-xs uppercase tracking-wide text-muted-foreground">Salário base</p>
            <p className="mt-1 text-lg font-semibold tabular-nums">{brl(sub)}</p>
          </div>
          <div className="rounded-xl bg-background/60 p-3">
            <p className="text-xs uppercase tracking-wide text-muted-foreground">AL Previdência</p>
            <p className="mt-1 text-lg font-semibold tabular-nums">{brl(num(descontos.alprev))}</p>
          </div>
          <div className="rounded-xl bg-background/60 p-3">
            <p className="text-xs uppercase tracking-wide text-muted-foreground">Pensão</p>
            <p className="mt-1 text-lg font-semibold tabular-nums">{brl(num(descontos.pensao))}</p>
          </div>
          <div className="rounded-xl bg-background/60 p-3">
            <p className="text-xs uppercase tracking-wide text-muted-foreground">IR</p>
            <p className="mt-1 text-lg font-semibold tabular-nums">{brl(num(descontos.ir))}</p>
          </div>
        </CardContent>
      </Card>

      {/* Entrada — apenas % e órgão */}
      <Card className="rounded-3xl border-border/60 bg-gradient-to-br from-background to-muted/30 shadow-xl">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="h-5 w-5 text-primary" />
            Parâmetros do Reajuste
          </CardTitle>
          <CardDescription>Cálculo em tempo real — estimativa, não valor exato.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-2">
          <div>
            <Label htmlFor="r-pct">Percentual de reajuste (%)</Label>
            <Input id="r-pct" type="number" step="0.01" min="0" max="100" inputMode="decimal"
              placeholder="6" value={reajuste}
              onChange={(e) => setReajuste(e.target.value)}
              className="mt-1 h-11 text-base" />
            <p className="mt-1 text-xs text-muted-foreground">Padrão: 6%</p>
          </div>
          <div>
            <Label>Tipo de órgão / regime</Label>
            <Select value={orgao} onValueChange={(v) => setOrgao(v as OrgaoAL)}>
              <SelectTrigger className="mt-1 h-11"><SelectValue /></SelectTrigger>
              <SelectContent>
                {ORGAOS_AL.map((o) => (
                  <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            {orgaoMeta?.obs && (
              <p className="mt-1 text-xs text-muted-foreground flex items-start gap-1">
                <Info className="h-3 w-3 mt-0.5 shrink-0" /> {orgaoMeta.obs}
              </p>
            )}
          </div>
        </CardContent>
      </Card>

      {!resultado.ok ? (
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>Não foi possível calcular</AlertTitle>
          <AlertDescription>{resultado.reason}</AlertDescription>
        </Alert>
      ) : (
        <>
          <div className="flex flex-wrap gap-2">
            {faixaAlta && (
              <Badge variant="secondary" className="rounded-full bg-amber-500/15 text-amber-700 dark:text-amber-400 border border-amber-500/30">
                Faixa alta previdenciária
              </Badge>
            )}
            {altaMargem && (
              <Badge className="rounded-full bg-primary/15 text-primary border border-primary/30 hover:bg-primary/20">
                Alta possibilidade de refinanciamento
              </Badge>
            )}
            <Badge variant="outline" className="rounded-full">
              Modo Simulação Inteligente
            </Badge>
          </div>

          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <StatCard icon={Wallet} label="Novo salário" value={brl(resultado.novoSalario)} />
            <StatCard icon={TrendingUp} label="Aumento bruto" value={brl(resultado.bruto)} />
            <StatCard icon={Banknote} label="Aumento líquido" value={brl(resultado.liquidoAumento)} accent big />
            <StatCard icon={Sparkles} label="Crédito estimado (médio)" value={brl(resultado.credito!.total.medio)} accent />
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <Card className="rounded-3xl">
              <CardHeader className="pb-2">
                <CardTitle className="text-base">Descontos compulsórios sobre o aumento bruto</CardTitle>
                <CardDescription>
                  Aplicados diretamente sobre {brl(resultado.bruto)} (aumento bruto).
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  <div className="flex items-center justify-between rounded-xl bg-muted/40 p-3">
                    <span className="text-sm">
                      AL Previdência{" "}
                      <span className="text-xs text-muted-foreground">
                        ({(resultado.pctPrevidencia * 100).toFixed(1)}%)
                      </span>
                    </span>
                    <span className="font-semibold tabular-nums">− {brl(resultado.descPrevidencia)}</span>
                  </div>
                  {resultado.descPensao > 0 && (
                    <div className="flex items-center justify-between rounded-xl bg-muted/40 p-3">
                      <span className="text-sm">Pensão (proporcional)</span>
                      <span className="font-semibold tabular-nums">− {brl(resultado.descPensao)}</span>
                    </div>
                  )}
                  <div className="flex items-center justify-between rounded-xl bg-muted/40 p-3">
                    <span className="text-sm">
                      Imposto de Renda{" "}
                      <span className="text-xs text-muted-foreground">
                        ({resultado.pctIR === 0 ? "isento" : `${(resultado.pctIR * 100).toFixed(1)}%`})
                      </span>
                    </span>
                    <span className="font-semibold tabular-nums">− {brl(resultado.descIR)}</span>
                  </div>
                  <div className="flex items-center justify-between rounded-xl bg-destructive/10 p-3">
                    <span className="text-sm font-medium">
                      Total de descontos ({(resultado.pctTotal * 100).toFixed(1)}%)
                    </span>
                    <span className="font-bold tabular-nums text-destructive">
                      − {brl(resultado.totalDescontos)}
                    </span>
                  </div>
                  <div className="flex items-center justify-between rounded-xl border border-primary/30 bg-primary/10 p-3">
                    <span className="text-sm font-medium text-primary">Aumento líquido disponível</span>
                    <span className="font-bold tabular-nums text-primary">{brl(resultado.liquidoAumento)}</span>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="rounded-3xl">
              <CardHeader className="pb-2">
                <CardTitle className="text-base">Nova margem liberada</CardTitle>
                <CardDescription>
                  Calculada sobre o aumento líquido ({brl(resultado.liquidoAumento)}).
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  <MargemRow icon={Wallet} label="Margem principal" pct="45%"
                    margem={resultado.margens!.principal}
                    creditoMin={resultado.credito!.principal.min}
                    creditoMax={resultado.credito!.principal.max} />
                  <MargemRow icon={Gift} label="Cartão benefício" pct="15%"
                    margem={resultado.margens!.cartaoBeneficio}
                    creditoMin={resultado.credito!.cartaoBeneficio.min}
                    creditoMax={resultado.credito!.cartaoBeneficio.max} />
                  <MargemRow icon={CreditCard} label="Cartão consignado" pct="10%"
                    margem={resultado.margens!.cartaoConsignado}
                    creditoMin={resultado.credito!.cartaoConsignado.min}
                    creditoMax={resultado.credito!.cartaoConsignado.max} />
                </div>
              </CardContent>
            </Card>
          </div>

          {resultado.liquidoAumento > 0 && (
            <Alert className="border-primary/30 bg-primary/5">
              <Sparkles className="h-4 w-4 text-primary" />
              <AlertTitle>Oportunidade detectada</AlertTitle>
              <AlertDescription>
                Servidor terá provável liberação de margem após reajuste — estimativa de{" "}
                <strong className="text-primary">{brl(resultado.credito!.total.min)}</strong> a{" "}
                <strong className="text-primary">{brl(resultado.credito!.total.max)}</strong> em crédito
                (média {brl(resultado.credito!.total.medio)}).
              </AlertDescription>
            </Alert>
          )}

          <Alert className="border-muted bg-muted/30">
            <ShieldAlert className="h-4 w-4" />
            <AlertTitle className="text-sm">Aviso</AlertTitle>
            <AlertDescription className="text-xs">
              Valores simulados com base em estimativas médias do Estado de Alagoas e nos descontos informados.
              Verbas indenizatórias, gratificações variáveis e descontos não informados podem alterar a margem real.
              Os multiplicadores de crédito variam por banco, idade, prazo e taxa.
            </AlertDescription>
          </Alert>

          <div className="flex flex-wrap items-center justify-end gap-2">
            <Button onClick={copiar}>
              <Copy className="h-4 w-4" /> Copiar simulação
            </Button>
          </div>
        </>
      )}
    </div>
  );
}


function MargemRow({
  icon: Icon, label, pct, margem, creditoMin, creditoMax,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string; pct: string; margem: number; creditoMin: number; creditoMax: number;
}) {
  return (
    <div className="flex items-center justify-between rounded-xl bg-muted/40 p-3">
      <div className="flex items-center gap-3">
        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-background text-primary">
          <Icon className="h-4 w-4" />
        </div>
        <div>
          <p className="text-sm font-medium">{label}</p>
          <p className="text-xs text-muted-foreground">{pct} sobre líquido</p>
        </div>
      </div>
      <div className="text-right">
        <p className="font-semibold tabular-nums">{brl(margem)}</p>
        <p className="text-xs text-muted-foreground tabular-nums">
          {brl(creditoMin)} – {brl(creditoMax)}
        </p>
      </div>
    </div>
  );
}

// ============================================================================
// Página principal com Tabs
// ============================================================================

function CalculadoraALPage() {
  const [salario, setSalario] = useState("");
  const [descontos, setDescontos] = useState<Descontos>(emptyDesc);
  const [showResults, setShowResults] = useState(false);

  return (
    <AppShell>
      <div className="mx-auto max-w-5xl space-y-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight md:text-4xl">
            Calculadora de Margem — AL
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Cálculo manual da margem consignável e simulação de reajuste para servidores de Alagoas.
          </p>
        </div>

        <Tabs defaultValue="manual" className="space-y-6">
          <TabsList className="grid w-full grid-cols-2 md:w-auto md:inline-grid">
            <TabsTrigger value="manual">Calculadora Manual</TabsTrigger>
            <TabsTrigger value="reajuste">Simulação Reajuste AL</TabsTrigger>
          </TabsList>

          <TabsContent value="manual" className="space-y-6">
            {!showResults ? (
              <ManualForm
                salario={salario} setSalario={setSalario}
                descontos={descontos} setDescontos={setDescontos}
                onCalcular={() => setShowResults(true)}
              />
            ) : (
              <ResultsDisplay
                salario={salario} setSalario={setSalario}
                descontos={descontos} setDescontos={setDescontos}
                onNovo={() => {
                  setSalario(""); setDescontos(emptyDesc); setShowResults(false);
                }}
              />
            )}
          </TabsContent>

          <TabsContent value="reajuste">
            <SimulacaoReajusteAL salario={salario} descontos={descontos} />
          </TabsContent>
        </Tabs>
      </div>
    </AppShell>
  );
}
