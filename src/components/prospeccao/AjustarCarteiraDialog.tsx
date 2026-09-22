import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { esteiraAtualizarAjustesCarteira, type EsteiraContrato } from "@/lib/prospeccao/esteira.functions";

type FormState = { margemUsada: string; margemRestante: string; prazo: string };

function paraNumero(valor: string): number | null {
  const limpo = valor.trim().replace(/\./g, "").replace(",", ".");
  if (!limpo) return null;
  const numero = Number(limpo);
  return Number.isFinite(numero) ? numero : null;
}

function paraForm(contrato: EsteiraContrato | null): FormState {
  return {
    margemUsada: contrato?.margem_usada != null ? String(contrato.margem_usada).replace(".", ",") : "",
    margemRestante: contrato?.margem_restante_valor != null ? String(contrato.margem_restante_valor).replace(".", ",") : "",
    prazo: contrato?.prazo != null ? String(contrato.prazo) : "",
  };
}

export function AjustarCarteiraDialog({ contrato, onClose }: { contrato: EsteiraContrato | null; onClose: () => void }) {
  const qc = useQueryClient();
  const salvarFn = useServerFn(esteiraAtualizarAjustesCarteira);
  const [salvando, setSalvando] = useState(false);
  const [form, setForm] = useState<FormState>(() => paraForm(contrato));
  const [ultimoId, setUltimoId] = useState(contrato?.id ?? null);

  if ((contrato?.id ?? null) !== ultimoId) {
    setUltimoId(contrato?.id ?? null);
    setForm(paraForm(contrato));
  }

  if (!contrato) return null;

  const salvar = async () => {
    const margemUsada = paraNumero(form.margemUsada);
    const margemRestante = paraNumero(form.margemRestante);
    const prazo = form.prazo.trim() ? Number(form.prazo) : null;
    if ((form.margemUsada.trim() && margemUsada == null) || (form.margemRestante.trim() && margemRestante == null)) {
      toast.error("Informe valores válidos para as margens.");
      return;
    }
    if ((margemUsada ?? 0) < 0 || (margemRestante ?? 0) < 0) {
      toast.error("Os valores das margens não podem ser negativos.");
      return;
    }
    if (prazo != null && (!Number.isInteger(prazo) || prazo < 1 || prazo > 240)) {
      toast.error("O prazo deve ter entre 1 e 240 meses.");
      return;
    }

    setSalvando(true);
    try {
      await salvarFn({ data: { contratoId: contrato.id, margemUsada, margemRestanteValor: margemRestante, prazo } });
      await qc.invalidateQueries({ queryKey: ["esteira"] });
      toast.success("Margem e prazo atualizados");
      onClose();
    } catch (erro: any) {
      toast.error("Não foi possível salvar", { description: erro?.message });
    } finally {
      setSalvando(false);
    }
  };

  return (
    <Dialog open onOpenChange={(aberto) => !aberto && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Atualizar margem e prazo</DialogTitle>
          <DialogDescription>{contrato.nome}. Estes ajustes aparecem na carteira, sem alterar a planilha original.</DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="margem-usada">Margem utilizada</Label>
            <Input id="margem-usada" inputMode="decimal" placeholder="0,00" value={form.margemUsada} onChange={(e) => setForm({ ...form, margemUsada: e.target.value })} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="margem-restante">Margem restante</Label>
            <Input id="margem-restante" inputMode="decimal" placeholder="0,00" value={form.margemRestante} onChange={(e) => setForm({ ...form, margemRestante: e.target.value })} />
          </div>
          <div className="space-y-1.5 sm:col-span-2">
            <Label htmlFor="prazo-carteira">Prazo (meses)</Label>
            <Input id="prazo-carteira" type="number" min={1} max={240} value={form.prazo} onChange={(e) => setForm({ ...form, prazo: e.target.value })} />
            {contrato.prazo_original != null && contrato.prazo_original !== contrato.prazo && (
              <p className="text-xs text-muted-foreground">Prazo original da planilha: {contrato.prazo_original} meses.</p>
            )}
          </div>
        </div>
        <DialogFooter className="gap-2">
          <Button variant="ghost" onClick={onClose}>Cancelar</Button>
          <Button onClick={salvar} disabled={salvando}>{salvando ? "Salvando…" : "Salvar ajustes"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}