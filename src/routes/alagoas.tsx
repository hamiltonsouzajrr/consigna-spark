import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { AppShell } from "@/components/AppShell";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";

export const Route = createFileRoute("/alagoas")({
  head: () => ({
    meta: [
      { title: "Governo de Alagoas — Simulação" },
      { name: "description", content: "Simulação de produtos consignados — Governo de Alagoas." },
    ],
  }),
  component: AlagoasPage,
});

type Produto = {
  nome: string;
  tipo: "principal" | "cartao_credito" | "cartao_beneficio";
  prazo?: string;
  // Para empréstimo: valor = margem / coef
  // Para cartão: valor = margem * multiplicador
  coeficiente?: number;
  multiplicador?: number;
  obs?: string;
};

const PRODUTOS: Produto[] = [
  { nome: "Banco PAN — Tabela Flex 4", tipo: "principal", prazo: "144x", coeficiente: 0.02226 },
  { nome: "Banco Digio — Tabela Flex 4", tipo: "principal", prazo: "120x", coeficiente: 0.02166 },
  { nome: "Banese", tipo: "principal", prazo: "120x", coeficiente: 0.02672 },
  { nome: "Banese", tipo: "principal", prazo: "90x", coeficiente: 0.02812 },
  { nome: "Caixa Econômica", tipo: "principal", obs: "Aguardando planilha de cálculo" },
  { nome: "KardBank", tipo: "cartao_credito", multiplicador: 22 },
  { nome: "Nossa Gente", tipo: "cartao_credito", multiplicador: 21.5 },
  { nome: "Amigoz", tipo: "cartao_beneficio", multiplicador: 21 },
  { nome: "Aki Capital", tipo: "cartao_beneficio", multiplicador: 21 },
];

const brl = (n: number) =>
  n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

function ProdutoCard({ p }: { p: Produto }) {
  const [margem, setMargem] = useState<string>("");
  const m = parseFloat(margem.replace(",", ".")) || 0;

  const valor = useMemo(() => {
    if (!m) return 0;
    if (p.coeficiente) return m / p.coeficiente;
    if (p.multiplicador) return m * p.multiplicador;
    return 0;
  }, [m, p]);

  const parcela = p.coeficiente && valor ? valor * p.coeficiente : null;

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-2">
          <CardTitle className="text-base">{p.nome}</CardTitle>
          {p.prazo && <Badge variant="secondary">{p.prazo}</Badge>}
        </div>
        <CardDescription className="text-xs">
          {p.coeficiente
            ? `Coeficiente: ${p.coeficiente}`
            : p.multiplicador
            ? `Multiplicador: ${p.multiplicador}x`
            : p.obs ?? ""}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="space-y-1.5">
          <Label className="text-xs">Margem disponível (R$)</Label>
          <Input
            type="number"
            inputMode="decimal"
            placeholder="0,00"
            value={margem}
            onChange={(e) => setMargem(e.target.value)}
            disabled={!p.coeficiente && !p.multiplicador}
          />
        </div>
        <div className="rounded-md border bg-muted/40 p-3">
          <p className="text-xs text-muted-foreground">Valor liberado</p>
          <p className="text-xl font-semibold">{brl(valor)}</p>
          {parcela !== null && (
            <p className="text-xs text-muted-foreground mt-1">
              Parcela estimada: {brl(parcela)}
            </p>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

function AlagoasPage() {
  const principais = PRODUTOS.filter((p) => p.tipo === "principal");
  const credito = PRODUTOS.filter((p) => p.tipo === "cartao_credito");
  const beneficio = PRODUTOS.filter((p) => p.tipo === "cartao_beneficio");

  return (
    <AppShell>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Governo de Alagoas — Simulação</h1>
          <p className="text-sm text-muted-foreground">
            Calculadora de produtos consignados por margem.
          </p>
        </div>

        <Tabs defaultValue="principal">
          <TabsList>
            <TabsTrigger value="principal">Margem Principal</TabsTrigger>
            <TabsTrigger value="credito">Cartão de Crédito</TabsTrigger>
            <TabsTrigger value="beneficio">Cartão Benefício</TabsTrigger>
          </TabsList>

          <TabsContent value="principal" className="mt-4">
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {principais.map((p, i) => <ProdutoCard key={i} p={p} />)}
            </div>
          </TabsContent>

          <TabsContent value="credito" className="mt-4">
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {credito.map((p, i) => <ProdutoCard key={i} p={p} />)}
            </div>
          </TabsContent>

          <TabsContent value="beneficio" className="mt-4">
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {beneficio.map((p, i) => <ProdutoCard key={i} p={p} />)}
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </AppShell>
  );
}
