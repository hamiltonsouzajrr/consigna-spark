import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Shuffle, RefreshCw, Dices, Eraser } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ConfirmDialog } from "./ConfirmDialog";
import { adminDistributeLeads, adminRecycleLeads } from "@/lib/prospeccao/prospeccao.functions";
import { previewSplit } from "@/lib/prospeccao/admin-import";

type Consultant = { id: string; email: string };

export function DistribuicaoTab({
  consultants, selected, onToggle, onSelectAll, onClear, unassignedCount,
}: {
  consultants: Consultant[];
  selected: Set<string>;
  onToggle: (id: string) => void;
  onSelectAll: () => void;
  onClear: () => void;
  unassignedCount: number;
}) {
  const qc = useQueryClient();
  const distributeLeads = useServerFn(adminDistributeLeads);
  const recycleLeads = useServerFn(adminRecycleLeads);
  const [distMode, setDistMode] = useState<"round_robin" | "score" | "city">("round_robin");
  const [recycleMode, setRecycleMode] = useState<"round_robin" | "score">("score");
  const [idleDays, setIdleDays] = useState(3);
  const [busy, setBusy] = useState(false);

  const split = previewSplit(unassignedCount, selected.size);

  const runDistribute = async () => {
    if (selected.size === 0) { toast.error("Selecione ao menos uma consultora."); return; }
    setBusy(true);
    try {
      const d = await distributeLeads({ data: { consultantIds: [...selected], mode: distMode } });
      if (d.assigned === 0) toast.info("Nenhum lead não atribuído para distribuir.");
      else toast.success(`${d.assigned} lead(s) distribuído(s) entre ${Object.keys(d.perConsultant).length} consultora(s).`);
      qc.invalidateQueries({ queryKey: ["prospect"] });
    } catch (e) { toast.error(e instanceof Error ? e.message : "Falha ao distribuir."); }
    setBusy(false);
  };

  const runRecycle = async () => {
    if (selected.size === 0) { toast.error("Selecione ao menos uma consultora."); return; }
    setBusy(true);
    try {
      const d = await recycleLeads({ data: { consultantIds: [...selected], idleDays, mode: recycleMode } });
      if (d.recycled === 0) toast.info(`Nenhum lead parado há ${idleDays}+ dia(s) para reciclar.`);
      else toast.success(`${d.recycled} lead(s) reciclado(s) para ${Object.keys(d.perConsultant).length} consultora(s).`);
      qc.invalidateQueries({ queryKey: ["prospect"] });
    } catch (e) { toast.error(e instanceof Error ? e.message : "Falha ao reciclar."); }
    setBusy(false);
  };

  return (
    <Card className="p-5">
      <p className="mb-1 flex items-center gap-2 text-sm font-semibold"><Shuffle className="h-4 w-4" /> Distribuir &amp; reciclar leads</p>
      <p className="mb-4 text-xs text-muted-foreground">Cada lead vai para apenas uma consultora. Marque quem deve participar do rodízio.</p>

      <div className="flex items-center justify-between">
        <Label className="text-xs">Consultoras participantes ({selected.size}/{consultants.length})</Label>
        <div className="flex gap-1">
          <Button variant="ghost" size="sm" onClick={onSelectAll}>Todas</Button>
          <Button variant="ghost" size="sm" onClick={onClear}>Nenhuma</Button>
        </div>
      </div>
      <div className="mt-2 flex flex-wrap gap-2">
        {consultants.map((c) => {
          const on = selected.has(c.id);
          return (
            <button
              key={c.id}
              type="button"
              aria-pressed={on}
              onClick={() => onToggle(c.id)}
              className={`rounded-full border px-3 py-1 text-xs transition-colors ${on ? "border-primary bg-primary/10 text-primary" : "border-border text-muted-foreground hover:bg-accent/50"}`}
            >
              {c.email}
            </button>
          );
        })}
        {!consultants.length && <span className="text-xs text-muted-foreground">Nenhuma consultora encontrada.</span>}
      </div>

      <div className="mt-5 grid gap-4 md:grid-cols-2">
        <div className="rounded-lg border p-4">
          <p className="mb-2 text-sm font-medium">Distribuir leads não atribuídos</p>
          <p className="mb-2 text-xs text-muted-foreground">
            {unassignedCount} lead(s) no pool → {selected.size} consultora(s) · ~{split.each} cada{split.rest ? ` (+1 para ${split.rest})` : ""}.
          </p>
          <Label className="text-xs">Critério</Label>
          <Select value={distMode} onValueChange={(v) => setDistMode(v as typeof distMode)}>
            <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="round_robin">Round-robin (rodízio igual)</SelectItem>
              <SelectItem value="score">Por score (espalha os quentes)</SelectItem>
              <SelectItem value="city">Por cidade (mesma cidade, mesma pessoa)</SelectItem>
            </SelectContent>
          </Select>
          <ConfirmDialog
            title="Distribuir leads agora?"
            description={`${unassignedCount} lead(s) sem responsável serão divididos entre ${selected.size} consultora(s) — aproximadamente ${split.each} para cada.`}
            confirmLabel="Distribuir"
            onConfirm={runDistribute}
          >
            <Button className="mt-3 w-full" variant="secondary" disabled={busy}><Shuffle className="mr-2 h-4 w-4" /> Distribuir agora</Button>
          </ConfirmDialog>
        </div>

        <div className="rounded-lg border p-4">
          <p className="mb-2 text-sm font-medium">Reciclar leads parados</p>
          <p className="mb-2 text-xs text-muted-foreground">Tira leads sem tratativa de quem não trabalhou e passa para quem tem menos fila.</p>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <Label className="text-xs">Parados há (dias)</Label>
              <Input type="number" min={1} max={60} value={idleDays} onChange={(e) => setIdleDays(Math.max(1, Math.min(60, Number(e.target.value) || 1)))} className="mt-1" />
            </div>
            <div>
              <Label className="text-xs">Ordem</Label>
              <Select value={recycleMode} onValueChange={(v) => setRecycleMode(v as typeof recycleMode)}>
                <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="score">Por score</SelectItem>
                  <SelectItem value="round_robin">Round-robin</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <ConfirmDialog
            title="Reciclar leads parados?"
            description={`Leads sem tratativa há ${idleDays}+ dia(s) serão retirados das consultoras atuais e redistribuídos entre as ${selected.size} selecionadas.`}
            confirmLabel="Reciclar"
            destructive
            onConfirm={runRecycle}
          >
            <Button className="mt-3 w-full" variant="secondary" disabled={busy}><RefreshCw className="mr-2 h-4 w-4" /> Reciclar agora</Button>
          </ConfirmDialog>
        </div>
      </div>
    </Card>
  );
}
