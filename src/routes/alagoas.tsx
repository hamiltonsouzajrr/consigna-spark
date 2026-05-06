import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { AppShell } from "@/components/AppShell";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Slider } from "@/components/ui/slider";
import { Sparkles, TrendingUp, CreditCard, Wallet, Building2 } from "lucide-react";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";

export const Route = createFileRoute("/alagoas")({
  head: () => ({
    meta: [
      { title: "Governo de Alagoas — Simulação" },
      { name: "description", content: "Simulação premium de produtos consignados para Governo de Alagoas." },
    ],
  }),
  component: AlagoasPage,
});

type Produto = {
  nome: string;
  tipo: "principal" | "cartao_credito" | "cartao_beneficio";
  prazo?: string;
  coeficiente?: number;
  multiplicador?: number;
  obs?: string;
  highlight?: boolean;
};

const PRODUTOS: Produto[] = [
  { nome: "Banco PAN", tipo: "principal", prazo: "144x", coeficiente: 0.02226 },
  { nome: "Banco Digio", tipo: "principal", prazo: "120x", coeficiente: 0.02166, highlight: true },
  { nome: "Banese", tipo: "principal", prazo: "120x", coeficiente: 0.02672 },
  { nome: "Banese", tipo: "principal", prazo: "90x", coeficiente: 0.02812 },
  { nome: "Caixa Econômica — Estado", tipo: "principal", prazo: "96x", coeficiente: 0.022746 },
  { nome: "Caixa Econômica — Prefeitura Maceió", tipo: "principal", prazo: "96x", coeficiente: 0.023015 },
  { nome: "KardBank", tipo: "cartao_credito", prazo: "96x", multiplicador: 22, highlight: true },
  { nome: "Nossa Gente", tipo: "cartao_credito", prazo: "96x", multiplicador: 21.5 },
  { nome: "Amigoz", tipo: "cartao_beneficio", prazo: "84x", multiplicador: 21, highlight: true },
  { nome: "Aki Capital", tipo: "cartao_beneficio", prazo: "84x", multiplicador: 21 },
];

const brl = (n: number) =>
  n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

function ProdutoCard({ p }: { p: Produto }) {
  const [margem, setMargem] = useState<string>("");
  const [sliderVal, setSliderVal] = useState<number>(0);
  const m = parseFloat(margem.replace(",", ".")) || sliderVal || 0;
  const disabled = !p.coeficiente && !p.multiplicador;

  const valor = useMemo(() => {
    if (!m) return 0;
    if (p.coeficiente) return m / p.coeficiente;
    if (p.multiplicador) return m * p.multiplicador;
    return 0;
  }, [m, p]);

  const parcela = p.coeficiente && valor ? valor * p.coeficiente : null;

  const subtitleIcon = p.tipo === "principal"
    ? TrendingUp
    : p.tipo === "cartao_credito"
    ? CreditCard
    : Wallet;
  const Icon = subtitleIcon;

  return (
    <div
      className={`relative flex flex-col rounded-2xl p-6 transition-all ${
        p.highlight ? "card-premium" : "card-elegant"
      }`}
    >
      {p.highlight && (
        <div className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full border border-primary/40 bg-background px-3 py-0.5 text-[10px] font-semibold uppercase tracking-widest text-primary shadow">
          <Sparkles className="mr-1 inline h-3 w-3" /> Destaque
        </div>
      )}

      <div className="mb-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className={`flex h-9 w-9 items-center justify-center rounded-lg ${p.highlight ? "bg-primary/20 text-primary-glow" : "bg-muted text-muted-foreground"}`}>
            <Icon className="h-4 w-4" />
          </div>
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">
              {p.tipo === "principal" ? "Margem Principal" : p.tipo === "cartao_credito" ? "Cartão Crédito" : "Cartão Benefício"}
            </p>
            <p className="text-base font-semibold">{p.nome}</p>
          </div>
        </div>
        {p.prazo && (
          <span className="rounded-full border border-primary/30 bg-primary/10 px-2.5 py-0.5 text-[11px] font-medium text-primary">
            {p.prazo}
          </span>
        )}
      </div>

      <div className="mb-5 text-center">
        <p className="text-[11px] uppercase tracking-[0.25em] text-muted-foreground">
          {p.tipo === "principal" && valor > 0 ? "Valor liberado aproximadamente" : "Valor liberado"}
        </p>
        <p className={`mt-1 font-bold leading-none tracking-tight ${p.highlight ? "text-gradient text-5xl" : "text-4xl"}`}>
          {brl(valor)}
        </p>
        {parcela !== null && (
          <p className="mt-2 text-xs text-muted-foreground">
            Parcela ≈ <span className="font-medium text-foreground">{brl(parcela)}</span>
          </p>
        )}
        {p.tipo === "principal" && valor > 0 && (
          <p className="mt-2 text-[10px] uppercase tracking-widest text-warning">
            Confirmar com o setor de Digitação
          </p>
        )}
      </div>

      <div className="space-y-3">
        <div>
          <div className="mb-1.5 flex items-center justify-between">
            <Label className="text-xs font-medium">Margem disponível</Label>
            {!disabled && (
              <span className="text-xs text-primary font-semibold">{brl(m)}</span>
            )}
          </div>
          <Input
            type="text"
            inputMode="decimal"
            placeholder={disabled ? "Indisponível" : "R$ 0,00"}
            value={margem}
            onChange={(e) => { setMargem(e.target.value); setSliderVal(0); }}
            disabled={disabled}
            className="h-10 bg-background/40 backdrop-blur"
          />
        </div>

        {!disabled && (
          <Slider
            value={[m]}
            min={0}
            max={5000}
            step={10}
            onValueChange={(v) => { setSliderVal(v[0]); setMargem(String(v[0])); }}
          />
        )}
      </div>

      <div className="mt-5 border-t border-border/60 pt-3 text-[11px] text-muted-foreground">
        {p.coeficiente
          ? <>Coeficiente <span className="font-mono text-foreground">{p.coeficiente.toString().replace(".", ",")}</span></>
          : p.multiplicador
          ? <>Multiplicador <span className="font-mono text-foreground">{p.multiplicador}×</span></>
          : p.obs}
      </div>
    </div>
  );
}

// Tabela de coeficientes Caixa por convenente e prazo
// Calculados via simulação price (taxa 1,75% a.m.) + IOF + seguro prestamista,
// usando prazo de extrato de cada convenente (Estado 47d, Maceió 38d).
const CAIXA_TABELA: Record<string, { label: string; coefs: Record<number, number> }> = {
  estado: {
    label: "Governo de Alagoas (Estado)",
    coefs: { 24: 0.054160, 36: 0.039709, 48: 0.032637, 60: 0.028514, 72: 0.025861, 84: 0.024044, 96: 0.022746, 108: 0.021791, 120: 0.021072, 132: 0.020523, 144: 0.020097 },
  },
  maceio: {
    label: "Prefeitura de Maceió",
    coefs: { 24: 0.054556, 36: 0.040081, 48: 0.032976, 60: 0.028827, 72: 0.026154, 84: 0.024323, 96: 0.023015 },
  },
};

function CaixaPrazos() {
  const [conv, setConv] = useState<keyof typeof CAIXA_TABELA>("estado");
  const [prazo, setPrazo] = useState<number>(96);
  const [margem, setMargem] = useState<string>("");
  const prazos = Object.keys(CAIXA_TABELA[conv].coefs).map(Number);
  const prazoEfetivo = prazos.includes(prazo) ? prazo : prazos[prazos.length - 1];
  const m = parseFloat(margem.replace(",", ".")) || 0;
  const coef = CAIXA_TABELA[conv].coefs[prazoEfetivo];
  const valor = m && coef ? m / coef : 0;
  const parcela = valor * coef;

  return (
    <div className="mx-auto max-w-3xl card-premium p-8">
      <div className="mb-6 flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/20 text-primary-glow">
          <Building2 className="h-5 w-5" />
        </div>
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">Caixa Econômica Federal</p>
          <p className="text-lg font-semibold">Simulador por prazo</p>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <div>
          <Label className="text-xs">Convenente</Label>
          <Select value={conv} onValueChange={(v) => setConv(v as keyof typeof CAIXA_TABELA)}>
            <SelectTrigger className="h-10 bg-background/40 backdrop-blur"><SelectValue /></SelectTrigger>
            <SelectContent>
              {Object.entries(CAIXA_TABELA).map(([k, v]) => (
                <SelectItem key={k} value={k}>{v.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label className="text-xs">Prazo</Label>
          <Select value={String(prazo)} onValueChange={(v) => setPrazo(Number(v))}>
            <SelectTrigger className="h-10 bg-background/40 backdrop-blur"><SelectValue /></SelectTrigger>
            <SelectContent>
              {Object.keys(CAIXA_TABELA[conv].coefs).map((p) => (
                <SelectItem key={p} value={p}>{p}x</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="mt-4">
        <Label className="text-xs">Margem disponível</Label>
        <Input
          type="text"
          inputMode="decimal"
          placeholder="R$ 0,00"
          value={margem}
          onChange={(e) => setMargem(e.target.value)}
          className="h-10 bg-background/40 backdrop-blur"
        />
      </div>

      <div className="mt-6 text-center">
        <p className="text-[11px] uppercase tracking-[0.25em] text-muted-foreground">
          Valor liberado aproximadamente
        </p>
        <p className="mt-1 text-5xl font-bold leading-none tracking-tight text-gradient">{brl(valor)}</p>
        <p className="mt-2 text-xs text-muted-foreground">
          Parcela ≈ <span className="font-medium text-foreground">{brl(parcela)}</span> · Coeficiente {coef.toFixed(6).replace(".", ",")}
        </p>
        <p className="mt-2 text-[10px] uppercase tracking-widest text-warning">
          Confirmar com o setor de Digitação
        </p>
      </div>
    </div>
  );
}

function AlagoasPage() {
  const principais = PRODUTOS.filter((p) => p.tipo === "principal");
  const credito = PRODUTOS.filter((p) => p.tipo === "cartao_credito");
  const beneficio = PRODUTOS.filter((p) => p.tipo === "cartao_beneficio");

  return (
    <AppShell>
      <div className="space-y-8">
        <div className="text-center">
          <p className="mb-2 inline-flex items-center gap-2 rounded-full border border-primary/30 bg-primary/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-widest text-primary">
            <Sparkles className="h-3 w-3" /> Governo de Alagoas
          </p>
          <h1 className="text-4xl font-bold tracking-tight md:text-5xl">
            Simulação <span className="text-gradient">Consignada</span>
          </h1>
          <p className="mx-auto mt-3 max-w-xl text-sm text-muted-foreground">
            Calcule em tempo real o valor liberado por produto. Ajuste a margem disponível e veja a melhor opção.
          </p>
        </div>

        <Tabs defaultValue="principal" className="mx-auto">
          <div className="flex justify-center">
            <TabsList className="h-11 rounded-full bg-muted/60 p-1 backdrop-blur">
              <TabsTrigger value="principal" className="rounded-full px-5">Margem Principal</TabsTrigger>
              <TabsTrigger value="caixa" className="rounded-full px-5">Caixa — Prazos</TabsTrigger>
              <TabsTrigger value="credito" className="rounded-full px-5">Cartão Crédito</TabsTrigger>
              <TabsTrigger value="beneficio" className="rounded-full px-5">Cartão Benefício</TabsTrigger>
            </TabsList>
          </div>

          <TabsContent value="principal" className="mt-8">
            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
              {principais.map((p, i) => <ProdutoCard key={i} p={p} />)}
            </div>
          </TabsContent>
          <TabsContent value="caixa" className="mt-8">
            <CaixaPrazos />
          </TabsContent>
          <TabsContent value="credito" className="mt-8">
            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
              {credito.map((p, i) => <ProdutoCard key={i} p={p} />)}
            </div>
          </TabsContent>
          <TabsContent value="beneficio" className="mt-8">
            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
              {beneficio.map((p, i) => <ProdutoCard key={i} p={p} />)}
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </AppShell>
  );
}
