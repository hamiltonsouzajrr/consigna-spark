import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { AppShell } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Calculator, Eraser, AlertTriangle } from "lucide-react";

export const Route = createFileRoute("/_authenticated/simulacao-alagoas")({
  head: () => ({
    meta: [
      { title: "SIMULAÇÃO BANESE | Grupo Positive" },
      { name: "description", content: "Calculadora de Margem Principal Banese: calcule o valor liberado por parcela, idade e prazo." },
    ],
  }),
  component: SimulacaoAlagoasPage,
});

// Tabela completa de coeficientes (prazo -> coeficiente).
// Os coeficientes principais de referência têm precisão de 4 casas.
const COEFICIENTES: Record<number, number> = {
  1: 0.98, 2: 1.93, 3: 2.85, 4: 3.75, 5: 4.62, 6: 5.47, 7: 6.3, 8: 7.1, 9: 7.89,
  10: 8.65, 11: 9.4, 12: 10.2564, 13: 10.93, 14: 11.58, 15: 12.22, 16: 12.85,
  17: 13.46, 18: 14.06, 19: 14.65, 20: 15.22, 21: 15.78, 22: 16.33, 23: 16.87,
  24: 17.9144, 25: 18.35, 26: 18.79, 27: 19.23, 28: 19.67, 29: 20.11, 30: 20.56,
  31: 21.0, 32: 21.44, 33: 21.88, 34: 22.33, 35: 22.77, 36: 23.5987, 37: 24.13,
  38: 24.66, 39: 25.19, 40: 25.72, 41: 26.25, 42: 26.78, 43: 27.31, 44: 27.49,
  45: 27.61, 46: 27.72, 47: 27.78, 48: 27.8347, 49: 28.09, 50: 28.35, 51: 28.61,
  52: 28.87, 53: 29.13, 54: 29.39, 55: 29.65, 56: 29.91, 57: 30.17, 58: 30.43,
  59: 30.69, 60: 30.95, 61: 31.25, 62: 31.55, 63: 31.84, 64: 32.14, 65: 32.44,
  66: 32.74, 67: 33.03, 68: 33.33, 69: 33.63, 70: 33.92, 71: 34.22, 72: 34.52,
  73: 34.82, 74: 35.11, 75: 35.41, 76: 35.71, 77: 36.0, 78: 36.3, 79: 36.6,
  80: 36.9, 81: 37.19, 82: 37.49, 83: 37.79, 84: 38.09, 85: 38.2, 86: 38.31,
  87: 38.42, 88: 38.53, 89: 38.64, 90: 38.75, 91: 38.86, 92: 38.97, 93: 39.08,
  94: 39.19, 95: 39.3, 96: 39.41, 97: 39.52, 98: 39.63, 99: 39.74, 100: 39.86,
  101: 39.97, 102: 40.08, 103: 40.19, 104: 40.3, 105: 40.41, 106: 40.52,
  107: 40.63, 108: 40.74, 109: 40.85, 110: 40.96, 111: 41.07, 112: 41.18,
  113: 41.29, 114: 41.4, 115: 41.51, 116: 41.62, 117: 41.73, 118: 41.83,
  119: 41.94, 120: 42.0415,
};

const COEFICIENTES_PRINCIPAIS = [12, 24, 36, 48, 60, 84, 120];

const brl = (v: number) =>
  v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

const coef4 = (v: number) =>
  v.toLocaleString("pt-BR", { minimumFractionDigits: 4, maximumFractionDigits: 4 });

function parseMoeda(valor: string): number {
  const limpo = valor.replace(/[^\d,]/g, "").replace(",", ".");
  const n = parseFloat(limpo);
  return isNaN(n) ? 0 : n;
}

function formatMoedaInput(valor: string): string {
  const digits = valor.replace(/\D/g, "");
  if (!digits) return "";
  const n = parseInt(digits, 10) / 100;
  return n.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function SimulacaoAlagoasPage() {
  const [idade, setIdade] = useState("");
  const [parcela, setParcela] = useState("");
  const [prazo, setPrazo] = useState("60");
  const [avisoPrazo, setAvisoPrazo] = useState("");

  const idadeNum = idade === "" ? null : parseInt(idade, 10);
  const parcelaNum = parseMoeda(parcela);

  const prazoMaximo = idadeNum !== null && idadeNum > 75 ? 60 : 120;

  const prazosDisponiveis = useMemo(
    () => Array.from({ length: prazoMaximo }, (_, i) => i + 1),
    [prazoMaximo],
  );

  // Ajusta o prazo automaticamente quando excede o máximo para a idade.
  const prazoNum = Math.min(parseInt(prazo, 10) || 1, prazoMaximo);

  const handleIdade = (v: string) => {
    const limpo = v.replace(/\D/g, "").slice(0, 3);
    setIdade(limpo);
    const n = limpo === "" ? null : parseInt(limpo, 10);
    if (n !== null && n > 75 && parseInt(prazo, 10) > 60) {
      setPrazo("60");
      setAvisoPrazo("Clientes acima de 75 anos possuem prazo máximo de 60 parcelas.");
    } else {
      setAvisoPrazo("");
    }
  };

  const erro = useMemo(() => {
    if (idade === "" || parcela === "") return null;
    if (idadeNum !== null && idadeNum < 18) return "A idade mínima permitida é 18 anos.";
    if (parcelaNum <= 0) return "Informe um valor de parcela maior que zero.";
    return null;
  }, [idade, parcela, idadeNum, parcelaNum]);

  const podeCalcular = idade !== "" && parcela !== "" && !erro;

  const resultado = useMemo(() => {
    if (!podeCalcular) return null;
    const coeficiente = COEFICIENTES[prazoNum];
    if (!coeficiente) return null;
    const valorLiberado = Math.round(parcelaNum * coeficiente * 100) / 100;
    return { valorLiberado, coeficiente, prazoEfetivo: prazoNum, idade: idadeNum };
  }, [podeCalcular, prazoNum, parcelaNum, idadeNum]);

  const limpar = () => {
    setIdade("");
    setParcela("");
    setPrazo("60");
    setAvisoPrazo("");
  };

  return (
    <AppShell>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight" style={{ color: "#003B7A" }}>
            SIMULAÇÃO BANESE
          </h1>
          <p className="text-muted-foreground">Calculadoras de crédito consignado.</p>
        </div>

        <Card className="overflow-hidden border-t-4" style={{ borderTopColor: "#00A651" }}>
          <CardHeader style={{ backgroundColor: "#003B7A" }} className="text-white">
            <CardTitle className="flex items-center gap-2">
              <Calculator className="h-5 w-5" />
              Margem Principal Banese
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-5 pt-6">
            <div className="grid gap-4 sm:grid-cols-3">
              <div className="space-y-2">
                <Label htmlFor="idade">Idade</Label>
                <Input
                  id="idade"
                  inputMode="numeric"
                  placeholder="Ex: 40"
                  value={idade}
                  onChange={(e) => handleIdade(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="parcela">Valor da Parcela (R$)</Label>
                <Input
                  id="parcela"
                  inputMode="numeric"
                  placeholder="0,00"
                  value={parcela}
                  onChange={(e) => setParcela(formatMoedaInput(e.target.value))}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="prazo">Prazo</Label>
                <Select value={String(prazoNum)} onValueChange={setPrazo}>
                  <SelectTrigger id="prazo">
                    <SelectValue placeholder="Selecione" />
                  </SelectTrigger>
                  <SelectContent className="max-h-72">
                    {prazosDisponiveis.map((p) => (
                      <SelectItem key={p} value={String(p)}>
                        {p}x
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {idadeNum !== null && idadeNum > 75 && (
              <div className="flex items-start gap-2 rounded-md border border-yellow-300 bg-yellow-50 p-3 text-sm text-yellow-800">
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                <span>ATENÇÃO: Para clientes acima de 75 anos o prazo máximo permitido é de 60 meses.</span>
              </div>
            )}

            {avisoPrazo && (
              <div className="rounded-md border border-yellow-300 bg-yellow-50 p-3 text-sm text-yellow-800">
                {avisoPrazo}
              </div>
            )}

            {erro && (
              <div className="rounded-md border border-red-300 bg-red-50 p-3 text-sm text-red-700">
                {erro}
              </div>
            )}

            <div className="flex flex-wrap gap-3">
              <Button
                type="button"
                className="gap-2 text-white hover:opacity-90"
                style={{ backgroundColor: "#00A651" }}
                disabled={!podeCalcular}
              >
                <Calculator className="h-4 w-4" /> Calcular
              </Button>
              <Button type="button" variant="outline" className="gap-2" onClick={limpar}>
                <Eraser className="h-4 w-4" /> Limpar
              </Button>
            </div>

            {resultado && (
              <div
                className="rounded-xl p-5 text-white"
                style={{ background: "linear-gradient(135deg, #003B7A, #00A651)" }}
              >
                <p className="text-sm uppercase tracking-wide text-white/80">Valor Liberado</p>
                <p className="text-3xl font-bold">{brl(resultado.valorLiberado)}</p>
                <div className="mt-4 grid gap-3 sm:grid-cols-3">
                  <div>
                    <p className="text-xs text-white/70">Coeficiente</p>
                    <p className="font-semibold">{coef4(resultado.coeficiente)}</p>
                  </div>
                  <div>
                    <p className="text-xs text-white/70">Prazo efetivo</p>
                    <p className="font-semibold">{resultado.prazoEfetivo} meses</p>
                  </div>
                  <div>
                    <p className="text-xs text-white/70">Idade informada</p>
                    <p className="font-semibold">{resultado.idade} anos</p>
                  </div>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle style={{ color: "#003B7A" }}>Coeficientes principais</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-hidden rounded-lg border">
              <table className="w-full text-sm">
                <thead>
                  <tr style={{ backgroundColor: "#003B7A" }} className="text-white">
                    <th className="px-4 py-2 text-left">Prazo</th>
                    <th className="px-4 py-2 text-left">Coeficiente</th>
                  </tr>
                </thead>
                <tbody>
                  {COEFICIENTES_PRINCIPAIS.map((p, i) => (
                    <tr key={p} className={i % 2 ? "bg-muted/40" : ""}>
                      <td className="px-4 py-2 font-medium">{p}x</td>
                      <td className="px-4 py-2">{coef4(COEFICIENTES[p])}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      </div>
    </AppShell>
  );
}
