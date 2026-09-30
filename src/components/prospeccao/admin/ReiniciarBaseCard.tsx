import { useState } from "react";
import { toast } from "sonner";
import { RotateCcw } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

type Resultado = { reiniciados: number; atribuidos: number; esgotados: number; consultoras: number };

const ESCOPOS: Record<string, { label: string; status: string[] }> = {
  perdido: { label: "Só \"Não quer agora\"", status: ["perdido"] },
  aberto: { label: "Em aberto parados", status: ["novo", "qualificado", "proposta"] },
  todos: { label: "Todos (menos vendas fechadas)", status: ["perdido", "novo", "qualificado", "proposta"] },
};

export function ReiniciarBaseCard({ consultantIds }: { consultantIds: string[] }) {
  const qc = useQueryClient();
  const [escopo, setEscopo] = useState("perdido");
  const [dias, setDias] = useState("15");
  const [previa, setPrevia] = useState<Resultado | null>(null);
  const [busy, setBusy] = useState(false);

  const [progresso, setProgresso] = useState<number | null>(null);

  async function chamar(simular: boolean, desde?: string): Promise<Resultado | null> {
    if (!consultantIds.length) { toast.error("Selecione ao menos uma consultora."); return null; }
    const { data, error } = await (supabase.rpc as any)("reiniciar_prospect_leads", {
      _consultoras: consultantIds, _status: ESCOPOS[escopo].status,
      _dias_min: Number(dias), _limite: 800, _simular: simular, _desde: desde ?? null,
    });
    if (error) { toast.error(error.message); return null; }
    return (Array.isArray(data) ? data[0] : data) as Resultado;
  }

  async function verPrevia() { setBusy(true); try { setPrevia(await chamar(true)); } finally { setBusy(false); } }

  async function confirmar() {
    if (!previa) return;
    if (!confirm(`Reiniciar ${previa.reiniciados} lead(s)? Nenhum volta para quem já atendeu.`)) return;
    setBusy(true);
    const desde = new Date().toISOString();
    const tot = { reiniciados: 0, atribuidos: 0, esgotados: 0 };
    setProgresso(0);
    try {
      for (let i = 0; i < 500; i++) {
        const r = await chamar(false, desde);
        if (!r) {
          if (tot.reiniciados) toast.info(`${tot.reiniciados} já foram reiniciados. Toque de novo para continuar.`);
          return;
        }
        if (!Number(r.reiniciados)) break;
        tot.reiniciados += Number(r.reiniciados);
        tot.atribuidos += Number(r.atribuidos);
        tot.esgotados += Number(r.esgotados);
        setProgresso(tot.reiniciados);
      }
      toast.success(`${tot.reiniciados} reiniciados, ${tot.atribuidos} entregues a novas consultoras, ${tot.esgotados} sem ninguém disponível.`);
      setPrevia(null);
      qc.invalidateQueries();
    } finally { setBusy(false); setProgresso(null); }
  }

  return (
    <div className="min-w-0 rounded-lg border p-4 md:col-span-2">
      <p className="mb-1 flex items-center gap-2 text-sm font-medium">
        <RotateCcw className="h-4 w-4" /> Reiniciar base do CRM
      </p>
      <p className="mb-3 text-xs text-muted-foreground">
        Os leads voltam como "Novo" e são divididos por igual entre as consultoras selecionadas.
        Um lead nunca volta para quem já o atendeu. Vendas fechadas não são mexidas.
      </p>
      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <Label className="text-xs">Quais leads</Label>
          <Select value={escopo} onValueChange={(v) => { setEscopo(v); setPrevia(null); }}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              {Object.entries(ESCOPOS).map(([k, v]) => <SelectItem key={k} value={k}>{v.label}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label className="text-xs">Sem contato há pelo menos</Label>
          <Select value={dias} onValueChange={(v) => { setDias(v); setPrevia(null); }}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              {["0", "7", "15", "30"].map((d) => <SelectItem key={d} value={d}>{d === "0" ? "Qualquer data" : `${d} dias`}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
      </div>
      {previa && (
        <p className="mt-3 rounded-md bg-muted p-2 text-xs">
          {previa.reiniciados} lead(s) voltam para a base · {previa.atribuidos} podem ir para outra consultora ·{" "}
          {previa.esgotados} já passaram por todas e ficarão sem responsável.
        </p>
      )}
      {progresso !== null && (
        <p className="mt-3 text-xs font-medium">
          Reiniciando… {progresso.toLocaleString("pt-BR")} de {(previa?.reiniciados ?? 0).toLocaleString("pt-BR")}
        </p>
      )}
      <div className="mt-3 flex flex-wrap gap-2">
        <Button variant="outline" size="sm" disabled={busy} onClick={verPrevia}>Ver prévia</Button>
        <Button variant="destructive" size="sm" disabled={busy || !previa || !previa.reiniciados} onClick={confirmar}>
          Reiniciar agora
        </Button>
      </div>
    </div>
  );
}
