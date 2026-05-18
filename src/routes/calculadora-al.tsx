import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { AppShell } from "@/components/AppShell";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Alert, AlertTitle, AlertDescription } from "@/components/ui/alert";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Calculator, RefreshCw, AlertTriangle, TrendingUp, Sparkles } from "lucide-react";

export const Route = createFileRoute("/calculadora-al")({
  head: () => ({
    meta: [
      { title: "Calculadora de Margem Consignável — Alagoas" },
      { name: "description", content: "Calculadora manual de margem consignável para servidores de Alagoas, considerando descontos obrigatórios e judiciais." },
      { property: "og:title", content: "Calculadora de Margem Consignável — Alagoas" },
      { property: "og:description", content: "Calculadora manual de margem consignável para servidores de Alagoas, considerando descontos obrigatórios e judiciais." },
      { property: "og:url", content: "https://consigna-spark.lovable.app/calculadora-al" },
    ],
    links: [{ rel: "canonical", href: "https://consigna-spark.lovable.app/calculadora-al" }],
    scripts: [
      {
        type: "application/ld+json",
        children: JSON.stringify({
          "@context": "https://schema.org",
          "@type": "WebApplication",
          name: "Calculadora de Margem Consignável — Alagoas",
          url: "https://consigna-spark.lovable.app/calculadora-al",
          applicationCategory: "FinanceApplication",
          description: "Cálculo manual de margem consignável para servidores do Governo de Alagoas.",
          offers: { "@type": "Offer", price: "0", priceCurrency: "BRL" },
        }),
      },
    ],
  }),
  component: CalculadoraALPage,
});

const brl = (n: number) =>
  (isFinite(n) ? n : 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

type Descontos = {
  pensao: string;
  fardamento: string;
  judicial: string;
  sindicato: string;
  alprev: string;
  ir: string;
  outro: string;
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

function ManualForm({
  salario, setSalario, descontos, setDescontos, onCalcular,
}: {
  salario: string;
  setSalario: (v: string) => void;
  descontos: Descontos;
  setDescontos: (d: Descontos) => void;
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
            Salário / Subsídio / Base de Vencimento — valor fixo, sem adicionais, gratificações,
            horas extras, plantões ou férias.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Label htmlFor="salario">Salário Base (R$) *</Label>
          <Input
            id="salario"
            type="number"
            step="0.01"
            inputMode="decimal"
            placeholder="0,00"
            value={salario}
            onChange={(e) => setSalario(e.target.value)}
            className="mt-1"
          />
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
                <Input
                  id={d.key}
                  type="number"
                  step="0.01"
                  inputMode="decimal"
                  placeholder="0,00"
                  value={descontos[d.key]}
                  onChange={(e) => setDescontos({ ...descontos, [d.key]: e.target.value })}
                  className="mt-1"
                />
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
            Total de descontos ({brl(totalDesc)}) é maior que o Salário Base ({brl(salarioNum)}).
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
  salario: string;
  setSalario: (v: string) => void;
  descontos: Descontos;
  setDescontos: (d: Descontos) => void;
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
          <CardDescription>Edite os valores abaixo e clique em "Recalcular Margens".</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-3">
          <div>
            <Label>Salário Base (R$)</Label>
            <Input
              type="number" step="0.01" inputMode="decimal"
              value={salario}
              onChange={(e) => setSalario(e.target.value)}
              className="mt-1"
            />
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
        <CardHeader>
          <CardTitle>Descontos Compulsórios</CardTitle>
        </CardHeader>
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
                    <Input
                      type="number" step="0.01" inputMode="decimal"
                      value={descontos[d.key]}
                      onChange={(e) => setDescontos({ ...descontos, [d.key]: e.target.value })}
                      placeholder="0,00"
                      className="h-8"
                    />
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
// Simulação de Aumento Salarial + Liberação de Margem
// ============================================================================

function aliquotaAlprev(subsidio: number): number {
  return subsidio > 25000 ? 0.14 : 0.10;
}

function aliquotaIR(subsidio: number): number {
  if (subsidio <= 2259) return 0;
  if (subsidio <= 2826) return 0.075;
  if (subsidio <= 3751) return 0.15;
  if (subsidio <= 4665) return 0.225;
  return 0.275;
}

function SimulacaoAumento() {
  const [subsidio, setSubsidio] = useState("");
  const [reajuste, setReajuste] = useState("6");
  const [show, setShow] = useState(false);

  const sub = num(subsidio);
  const pct = num(reajuste) / 100;

  const sim = useMemo(() => {
    if (sub <= 0 || pct <= 0) return null;
    const bruto = sub * pct;
    const aAlprev = aliquotaAlprev(sub);
    const aIR = aliquotaIR(sub);
    const descAlprev = bruto * aAlprev;
    const descIR = bruto * aIR;
    const liquido = bruto - descAlprev - descIR;
    const novoSubsidio = sub + bruto;
    const margemPrincipal = liquido * 0.40;
    const cartaoBeneficio = liquido * 0.15;
    const cartaoConsignado = liquido * 0.10;
    return {
      bruto, aAlprev, aIR, descAlprev, descIR, liquido, novoSubsidio,
      margemPrincipal, cartaoBeneficio, cartaoConsignado,
      credMpMin: margemPrincipal * 40,  credMpMax: margemPrincipal * 53,
      credCbMin: cartaoBeneficio * 27,  credCbMax: cartaoBeneficio * 44,
      credCcMin: cartaoConsignado * 22, credCcMax: cartaoConsignado * 40,
    };
  }, [sub, pct]);

  return (
    <Card className="rounded-3xl border-primary/20">
      <CardHeader>
        <div className="flex items-start justify-between gap-4">
          <div>
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="h-5 w-5 text-primary" />
              Simulação de Aumento Salarial
            </CardTitle>
            <CardDescription>
              Estime a nova margem liberada após reajuste, considerando AL Previdência e IR.
            </CardDescription>
          </div>
          {!show && (
            <Button onClick={() => setShow(true)} variant="outline">
              <Sparkles className="h-4 w-4" /> Simular aumento salarial
            </Button>
          )}
        </div>
      </CardHeader>
      {show && (
        <CardContent className="space-y-6">
          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <Label htmlFor="sim-subsidio">Subsídio atual (R$) *</Label>
              <Input
                id="sim-subsidio"
                type="number" step="0.01" inputMode="decimal"
                placeholder="0,00"
                value={subsidio}
                onChange={(e) => setSubsidio(e.target.value)}
                className="mt-1"
              />
            </div>
            <div>
              <Label htmlFor="sim-reajuste">Percentual de reajuste (%)</Label>
              <Input
                id="sim-reajuste"
                type="number" step="0.01" inputMode="decimal"
                placeholder="6"
                value={reajuste}
                onChange={(e) => setReajuste(e.target.value)}
                className="mt-1"
              />
              <p className="mt-1 text-xs text-muted-foreground">Padrão sugerido: 6%</p>
            </div>
          </div>

          {sim ? (
            <>
              <div className="grid gap-3 md:grid-cols-3">
                <div className="rounded-xl bg-muted/40 p-4">
                  <p className="text-xs uppercase tracking-wide text-muted-foreground">Novo subsídio (bruto)</p>
                  <p className="mt-1 text-xl font-semibold">{brl(sim.novoSubsidio)}</p>
                </div>
                <div className="rounded-xl bg-muted/40 p-4">
                  <p className="text-xs uppercase tracking-wide text-muted-foreground">Aumento bruto</p>
                  <p className="mt-1 text-xl font-semibold">{brl(sim.bruto)}</p>
                </div>
                <div className="rounded-xl bg-primary/10 p-4">
                  <p className="text-xs uppercase tracking-wide text-primary">Aumento líquido</p>
                  <p className="mt-1 text-xl font-bold text-primary">{brl(sim.liquido)}</p>
                </div>
              </div>

              <Card className="rounded-2xl">
                <CardHeader className="pb-2">
                  <CardTitle className="text-base">Descontos sobre o aumento</CardTitle>
                </CardHeader>
                <CardContent>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Desconto</TableHead>
                        <TableHead className="w-[100px]">Alíquota</TableHead>
                        <TableHead className="w-[180px] text-right">Valor</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      <TableRow>
                        <TableCell>AL Previdência</TableCell>
                        <TableCell>{(sim.aAlprev * 100).toFixed(1)}%</TableCell>
                        <TableCell className="text-right">{brl(sim.descAlprev)}</TableCell>
                      </TableRow>
                      <TableRow>
                        <TableCell>Imposto de Renda</TableCell>
                        <TableCell>{sim.aIR === 0 ? "Isento" : `${(sim.aIR * 100).toFixed(1)}%`}</TableCell>
                        <TableCell className="text-right">{brl(sim.descIR)}</TableCell>
                      </TableRow>
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>

              <Card className="rounded-2xl">
                <CardHeader className="pb-2">
                  <CardTitle className="text-base">Nova margem aproximada liberada</CardTitle>
                  <CardDescription>Sobre o aumento líquido de {brl(sim.liquido)}</CardDescription>
                </CardHeader>
                <CardContent>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Produto</TableHead>
                        <TableHead className="w-[80px]">%</TableHead>
                        <TableHead className="w-[160px] text-right">Margem (R$)</TableHead>
                        <TableHead className="text-right">Crédito médio estimado</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      <TableRow>
                        <TableCell>Margem principal</TableCell>
                        <TableCell>40%</TableCell>
                        <TableCell className="text-right font-semibold">{brl(sim.margemPrincipal)}</TableCell>
                        <TableCell className="text-right text-muted-foreground">
                          {brl(sim.credMpMin)} – {brl(sim.credMpMax)}
                        </TableCell>
                      </TableRow>
                      <TableRow>
                        <TableCell>Cartão benefício</TableCell>
                        <TableCell>15%</TableCell>
                        <TableCell className="text-right font-semibold">{brl(sim.cartaoBeneficio)}</TableCell>
                        <TableCell className="text-right text-muted-foreground">
                          {brl(sim.credCbMin)} – {brl(sim.credCbMax)}
                        </TableCell>
                      </TableRow>
                      <TableRow>
                        <TableCell>Cartão consignado</TableCell>
                        <TableCell>10%</TableCell>
                        <TableCell className="text-right font-semibold">{brl(sim.cartaoConsignado)}</TableCell>
                        <TableCell className="text-right text-muted-foreground">
                          {brl(sim.credCcMin)} – {brl(sim.credCcMax)}
                        </TableCell>
                      </TableRow>
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>

              {sim.liquido > 0 && (
                <Alert>
                  <Sparkles className="h-4 w-4" />
                  <AlertTitle>Oportunidade detectada</AlertTitle>
                  <AlertDescription>
                    Servidor terá provável liberação de margem após reajuste salarial — estimativa total de até{" "}
                    <strong>{brl(sim.credMpMax + sim.credCbMax + sim.credCcMax)}</strong> em crédito.
                  </AlertDescription>
                </Alert>
              )}

              <div className="flex justify-end">
                <Button variant="ghost" onClick={() => { setSubsidio(""); setReajuste("6"); }}>
                  <RefreshCw className="h-4 w-4" /> Limpar
                </Button>
              </div>
            </>
          ) : (
            <p className="text-sm text-muted-foreground">
              Informe o subsídio atual e o percentual de reajuste para ver a simulação.
            </p>
          )}
        </CardContent>
      )}
    </Card>
  );
}

function CalculadoraALPage() {
  const [salario, setSalario] = useState("");
  const [descontos, setDescontos] = useState<Descontos>(emptyDesc);
  const [showResults, setShowResults] = useState(false);

  return (
    <AppShell>
      <div className="mx-auto max-w-4xl space-y-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight md:text-4xl">
            Calculadora de Margem — AL
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Cálculo 100% manual da margem consignável para servidores de Alagoas. Sem upload, sem OCR.
          </p>
        </div>

        {!showResults ? (
          <ManualForm
            salario={salario}
            setSalario={setSalario}
            descontos={descontos}
            setDescontos={setDescontos}
            onCalcular={() => setShowResults(true)}
          />
        ) : (
          <ResultsDisplay
            salario={salario}
            setSalario={setSalario}
            descontos={descontos}
            setDescontos={setDescontos}
            onNovo={() => {
              setSalario("");
              setDescontos(emptyDesc);
              setShowResults(false);
            }}
          />
        )}

        <SimulacaoAumento />
      </div>
    </AppShell>
  );
}
