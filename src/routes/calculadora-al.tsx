import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { AppShell } from "@/components/AppShell";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Alert, AlertTitle, AlertDescription } from "@/components/ui/alert";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Calculator, RefreshCw, AlertTriangle } from "lucide-react";

export const Route = createFileRoute("/calculadora-al")({
  head: () => ({
    meta: [
      { title: "Calculadora de Margem — AL" },
      { name: "description", content: "Calculadora manual de margem consignável para servidores de Alagoas." },
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
      </div>
    </AppShell>
  );
}
