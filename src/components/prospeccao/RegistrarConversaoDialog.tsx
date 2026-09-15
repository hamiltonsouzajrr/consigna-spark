import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { criarConversao, LEMBRETE_LABEL, LEMBRETE_OPCOES, type LembreteOpcao, type TipoMargemConversao } from "@/lib/prospeccao/conversoes.functions";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";

const hoje = () => new Date().toISOString().slice(0, 10);
const numero = (v: string) => {
  const n = Number(v.replace(/\s/g, "").replace(/\./g, "").replace(",", "."));
  return Number.isFinite(n) ? n : 0;
};

export function RegistrarConversaoDialog({
  open, onOpenChange, origem, clienteId, clienteNome, cpf, onSaved,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  origem: "crm" | "tomadores_al";
  clienteId: string;
  clienteNome: string;
  cpf?: string | null;
  onSaved: () => void | Promise<void>;
}) {
  const criar = useServerFn(criarConversao);
  const [data, setData] = useState(hoje());
  const [valor, setValor] = useState("");
  const [prazo, setPrazo] = useState("");
  const [parcela, setParcela] = useState("");
  const [tipo, setTipo] = useState<TipoMargemConversao>("emprestimo");
  const [usada, setUsada] = useState("");
  const [restante, setRestante] = useState("");
  const [lembrete, setLembrete] = useState<LembreteOpcao>("1m");
  const [observacao, setObservacao] = useState("");
  const [saving, setSaving] = useState(false);

  const salvar = async () => {
    if (numero(valor) <= 0) return toast.error("Informe o valor liberado.");
    if (numero(usada) < 0) return toast.error("Informe a margem usada.");
    setSaving(true);
    try {
      await criar({ data: {
        origem,
        leadId: origem === "crm" ? clienteId : null,
        tomadorId: origem === "tomadores_al" ? clienteId : null,
        clienteNome,
        cpf: cpf ?? null,
        dataOperacao: data,
        valorLiberado: numero(valor),
        prazo: prazo ? Number(prazo.replace(/\D/g, "")) : null,
        valorParcela: parcela ? numero(parcela) : null,
        tipoMargem: tipo,
        margemUsada: numero(usada),
        margemRestante: numero(restante) > 0,
        margemRestanteValor: restante ? numero(restante) : null,
        observacao: observacao.trim() || null,
        lembrete,
      } });
      await onSaved();
      toast.success("Venda registrada e enviada para conferência do gerente.");
      onOpenChange(false);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Não foi possível registrar a venda.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Registrar venda convertida</DialogTitle>
          <DialogDescription>{clienteNome} · a venda ficará aguardando confirmação do gerente.</DialogDescription>
        </DialogHeader>
        <div className="grid gap-3 sm:grid-cols-2">
          <div><Label>Data da operação</Label><Input type="date" value={data} onChange={(e) => setData(e.target.value)} /></div>
          <div><Label>Valor liberado</Label><Input inputMode="decimal" placeholder="0,00" value={valor} onChange={(e) => setValor(e.target.value)} /></div>
          <div><Label>Prazo</Label><Input inputMode="numeric" placeholder="96" value={prazo} onChange={(e) => setPrazo(e.target.value)} /></div>
          <div><Label>Valor da parcela</Label><Input inputMode="decimal" placeholder="0,00" value={parcela} onChange={(e) => setParcela(e.target.value)} /></div>
          <div className="sm:col-span-2">
            <Label>Tipo de margem usada</Label>
            <Select value={tipo} onValueChange={(v) => setTipo(v as TipoMargemConversao)}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="emprestimo">Empréstimo</SelectItem><SelectItem value="cartao_credito">Cartão de crédito</SelectItem><SelectItem value="cartao_beneficio">Cartão benefício</SelectItem></SelectContent></Select>
          </div>
          <div><Label>Margem usada</Label><Input inputMode="decimal" placeholder="0,00" value={usada} onChange={(e) => setUsada(e.target.value)} /></div>
          <div><Label>Margem restante</Label><Input inputMode="decimal" placeholder="0,00 (sem margem)" value={restante} onChange={(e) => setRestante(e.target.value)} /></div>
          <div className="sm:col-span-2">
            <Label>Lembrar de contatar novamente</Label>
            <Select value={lembrete} onValueChange={(v) => setLembrete(v as LembreteOpcao)}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{LEMBRETE_OPCOES.map((o) => <SelectItem key={o} value={o}>{LEMBRETE_LABEL[o]}</SelectItem>)}</SelectContent></Select>
          </div>
          <div className="sm:col-span-2"><Label>Observação</Label><Textarea rows={2} value={observacao} onChange={(e) => setObservacao(e.target.value)} /></div>
        </div>
        <DialogFooter><Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button><Button onClick={salvar} disabled={saving}>{saving ? "Salvando..." : "Registrar conversão"}</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  );
}