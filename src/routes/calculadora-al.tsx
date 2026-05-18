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
  ORGAOS_AL, simularReajuste, brl, gerarTextoWhatsapp, registrarLog,
  type OrgaoAL,
} from "@/lib/al";

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
  { label: "Empréstimo Consignado", pct: 0.30 },
  { label: "Cartão de Crédito Consignado", pct: 0.10 },
  { label: "Cartão Benefício", pct: 0.10 },
  { label: "Margem Adicional", pct: 0.15 },
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

function SimulacaoReajusteAL() {
  const [subsidio, setSubsidio] = useState("");
  const [reajuste, setReajuste] = useState("6");
  const [orgao, setOrgao] = useState<OrgaoAL>("estado_al");

  const sub = num(subsidio);
  const pct = num(reajuste) / 100;

  const sim = useMemo(() => simularReajuste(sub, pct, orgao), [sub, pct, orgao]);

  const copiar = async () => {
    if (!sim) return;
    try {
      await navigator.clipboard.writeText(gerarTextoWhatsapp(sim));
      toast.success("Simulação copiada", { description: "Texto pronto para enviar no WhatsApp." });
    } catch {
      toast.error("Não foi possível copiar");
    }
  };

  const limpar = () => { setSubsidio(""); setReajuste("6"); setOrgao("estado_al"); };

  const faixaAlta = sub > 25000;
  const altaMargem = sim && (sim.margens.principal + sim.margens.cartaoBeneficio + sim.margens.cartaoConsignado) > 300;

  return (
    <div className="space-y-6">
      {/* Entrada */}
      <Card className="rounded-3xl border-border/60 bg-gradient-to-br from-background to-muted/30 shadow-xl">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="h-5 w-5 text-primary" />
            Dados do Servidor
          </CardTitle>
          <CardDescription>Cálculo em tempo real. Sem reload.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-3">
          <div>
            <Label htmlFor="r-sub">Subsídio atual (R$) *</Label>
            <Input id="r-sub" type="number" step="0.01" inputMode="decimal"
              placeholder="10.000,00" value={subsidio}
              onChange={(e) => setSubsidio(e.target.value)}
              className="mt-1 h-11 text-base" />
            {sub > 0 && <p className="mt-1 text-xs text-muted-foreground">{brl(sub)}</p>}
          </div>
          <div>
            <Label htmlFor="r-pct">Percentual de reajuste (%)</Label>
            <Input id="r-pct" type="number" step="0.01" inputMode="decimal"
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
          </div>
        </CardContent>
      </Card>

      {!sim ? (
        <Alert>
          <Sparkles className="h-4 w-4" />
          <AlertTitle>Aguardando dados</AlertTitle>
          <AlertDescription>
            Informe o subsídio atual e o percentual de reajuste para iniciar a simulação.
          </AlertDescription>
        </Alert>
      ) : (
        <>
          {/* Badges de alerta */}
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
          </div>

          {/* Cards de resumo */}
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <StatCard icon={Wallet} label="Novo subsídio" value={brl(sim.novoSubsidio)} />
            <StatCard icon={TrendingUp} label="Aumento bruto" value={brl(sim.bruto)} />
            <StatCard icon={Banknote} label="Aumento líquido" value={brl(sim.liquido)} accent big />
            <StatCard icon={Sparkles} label="Crédito estimado" value={brl(sim.credito.total)} accent />
          </div>

          {/* Detalhes — descontos */}
          <div className="grid gap-4 md:grid-cols-2">
            <Card className="rounded-3xl">
              <CardHeader className="pb-2">
                <CardTitle className="text-base">Descontos sobre o aumento</CardTitle>
                <CardDescription>Previdência progressiva incremental.</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  <div className="flex items-center justify-between rounded-xl bg-muted/40 p-3">
                    <span className="text-sm">AL Previdência (progressiva)</span>
                    <span className="font-semibold tabular-nums">{brl(sim.descPrevidencia)}</span>
                  </div>
                  <div className="flex items-center justify-between rounded-xl bg-muted/40 p-3">
                    <span className="text-sm">
                      Imposto de Renda{" "}
                      <span className="text-xs text-muted-foreground">
                        ({sim.aliquotaIRPct === 0 ? "isento" : `${(sim.aliquotaIRPct * 100).toFixed(1)}%`})
                      </span>
                    </span>
                    <span className="font-semibold tabular-nums">{brl(sim.descIR)}</span>
                  </div>
                  <div className="flex items-center justify-between rounded-xl border border-primary/30 bg-primary/10 p-3">
                    <span className="text-sm font-medium text-primary">Aumento líquido</span>
                    <span className="font-bold tabular-nums text-primary">{brl(sim.liquido)}</span>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="rounded-3xl">
              <CardHeader className="pb-2">
                <CardTitle className="text-base">Nova margem liberada</CardTitle>
                <CardDescription>Coeficientes AL aplicados ao líquido.</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  <MargemRow icon={Wallet} label="Margem principal" pct="40%"
                    margem={sim.margens.principal} credito={sim.credito.principal} />
                  <MargemRow icon={Gift} label="Cartão benefício" pct="15%"
                    margem={sim.margens.cartaoBeneficio} credito={sim.credito.cartaoBeneficio} />
                  <MargemRow icon={CreditCard} label="Cartão consignado" pct="10%"
                    margem={sim.margens.cartaoConsignado} credito={sim.credito.cartaoConsignado} />
                </div>
              </CardContent>
            </Card>
          </div>

          {sim.liquido > 0 && (
            <Alert className="border-primary/30 bg-primary/5">
              <Sparkles className="h-4 w-4 text-primary" />
              <AlertTitle>Oportunidade detectada</AlertTitle>
              <AlertDescription>
                Servidor terá provável liberação de margem após reajuste salarial — estimativa total de até{" "}
                <strong className="text-primary">{brl(sim.credito.total)}</strong> em crédito.
              </AlertDescription>
            </Alert>
          )}

          <div className="flex flex-wrap items-center justify-end gap-2">
            <Button variant="ghost" onClick={limpar}>
              <RefreshCw className="h-4 w-4" /> Limpar
            </Button>
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
  icon: Icon, label, pct, margem, credito,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string; pct: string; margem: number; credito: number;
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
        <p className="text-xs text-muted-foreground tabular-nums">≈ {brl(credito)}</p>
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
            <SimulacaoReajusteAL />
          </TabsContent>
        </Tabs>
      </div>
    </AppShell>
  );
}
