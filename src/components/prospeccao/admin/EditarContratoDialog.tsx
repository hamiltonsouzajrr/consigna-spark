// Edição administrativa de um cliente da esteira de produção.
import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { esteiraAtualizarContrato, type EsteiraContrato } from "@/lib/prospeccao/esteira.functions";

const SEM_DONO = "__sem__";

type Conta = { user_id: string; nome: string };

export function EditarContratoDialog({
  contrato,
  contas,
  onClose,
}: {
  contrato: EsteiraContrato | null;
  contas: Conta[];
  onClose: () => void;
}) {
  const qc = useQueryClient();
  const salvarFn = useServerFn(esteiraAtualizarContrato);
  const [salvando, setSalvando] = useState(false);
  const [f, setF] = useState(() => paraForm(contrato));

  // Recarrega o formulário quando outro cliente é aberto.
  const [ultimoId, setUltimoId] = useState(contrato?.id ?? null);
  if ((contrato?.id ?? null) !== ultimoId) {
    setUltimoId(contrato?.id ?? null);
    setF(paraForm(contrato));
  }

  if (!contrato) return null;

  const salvar = async () => {
    setSalvando(true);
    try {
      await salvarFn({
        data: {
          contratoId: contrato.id,
          nome: f.nome.trim(),
          cpf: f.cpf.trim(),
          telefone: f.telefone.trim() || null,
          banco: f.banco.trim() || null,
          data_venda: f.data_venda,
          prazo: f.prazo ? Number(f.prazo) : null,
          valor_bruto: f.valor_bruto ? Number(f.valor_bruto.replace(",", ".")) : null,
          seguro: f.seguro.trim() || null,
          status: f.status.trim() || null,
          observacao: f.observacao.trim() || null,
          dia_amortizacao: Number(f.dia_amortizacao) || 1,
          proximo_contato_em: f.proximo_contato_em || null,
          acompanhamento_ativo: f.acompanhamento_ativo,
          consultant_id: f.consultant_id === SEM_DONO ? null : f.consultant_id,
        },
      });
      toast.success("Cliente atualizado");
      await qc.invalidateQueries({ queryKey: ["esteira"] });
      onClose();
    } catch (e: any) {
      toast.error("Não foi possível salvar", { description: e?.message });
    } finally {
      setSalvando(false);
    }
  };

  return (
    <Dialog open onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>Editar cliente</DialogTitle>
          <DialogDescription>O histórico de ligações é mantido. O lembrete é recalculado ao salvar.</DialogDescription>
        </DialogHeader>

        <div className="grid gap-3 sm:grid-cols-2">
          <Campo label="Nome" className="sm:col-span-2">
            <Input value={f.nome} onChange={(e) => setF({ ...f, nome: e.target.value })} />
          </Campo>
          <Campo label="CPF">
            <Input value={f.cpf} onChange={(e) => setF({ ...f, cpf: e.target.value })} />
          </Campo>
          <Campo label="Telefone">
            <Input
              value={f.telefone}
              placeholder="(00) 00000-0000"
              onChange={(e) => setF({ ...f, telefone: e.target.value })}
            />
          </Campo>
          <Campo label="Banco">
            <Input value={f.banco} onChange={(e) => setF({ ...f, banco: e.target.value })} />
          </Campo>
          <Campo label="Data da venda">
            <Input type="date" value={f.data_venda} onChange={(e) => setF({ ...f, data_venda: e.target.value })} />
          </Campo>
          <Campo label="Prazo (meses)">
            <Input type="number" value={f.prazo} onChange={(e) => setF({ ...f, prazo: e.target.value })} />
          </Campo>
          <Campo label="Valor bruto">
            <Input value={f.valor_bruto} onChange={(e) => setF({ ...f, valor_bruto: e.target.value })} />
          </Campo>
          <Campo label="Seguro">
            <Input value={f.seguro} onChange={(e) => setF({ ...f, seguro: e.target.value })} />
          </Campo>
          <Campo label="Status">
            <Input value={f.status} onChange={(e) => setF({ ...f, status: e.target.value })} />
          </Campo>
          <Campo label="Dia da ligação">
            <Input
              type="number"
              min={1}
              max={31}
              value={f.dia_amortizacao}
              onChange={(e) => setF({ ...f, dia_amortizacao: e.target.value })}
            />
          </Campo>
          <Campo label="Próxima ligação">
            <Input
              type="date"
              value={f.proximo_contato_em}
              onChange={(e) => setF({ ...f, proximo_contato_em: e.target.value })}
            />
          </Campo>
          <Campo label="Consultora responsável" className="sm:col-span-2">
            <Select value={f.consultant_id} onValueChange={(v) => setF({ ...f, consultant_id: v })}>
              <SelectTrigger>
                <SelectValue placeholder="Consultora" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={SEM_DONO}>Sem responsável</SelectItem>
                {contas.map((c) => (
                  <SelectItem key={c.user_id} value={c.user_id}>
                    {c.nome}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Campo>
          <Campo label="Observação" className="sm:col-span-2">
            <Textarea
              rows={2}
              value={f.observacao}
              onChange={(e) => setF({ ...f, observacao: e.target.value })}
            />
          </Campo>
          <div className="flex items-center gap-3 sm:col-span-2">
            <Switch
              checked={f.acompanhamento_ativo}
              onCheckedChange={(v) => setF({ ...f, acompanhamento_ativo: v })}
              id="acompanhar"
            />
            <Label htmlFor="acompanhar" className="text-sm">
              Continuar lembrando a consultora todo mês
            </Label>
          </div>
        </div>

        <DialogFooter className="gap-2">
          <Button variant="ghost" onClick={onClose}>
            Cancelar
          </Button>
          <Button onClick={salvar} disabled={salvando || f.nome.trim().length < 2}>
            {salvando ? "Salvando…" : "Salvar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function Campo({ label, className, children }: { label: string; className?: string; children: React.ReactNode }) {
  return (
    <div className={`space-y-1 ${className ?? ""}`}>
      <Label className="text-xs text-muted-foreground">{label}</Label>
      {children}
    </div>
  );
}

function paraForm(c: EsteiraContrato | null) {
  return {
    nome: c?.nome ?? "",
    cpf: c?.cpf ?? "",
    telefone: c?.telefone ?? "",
    banco: c?.banco ?? "",
    data_venda: c?.data_venda?.slice(0, 10) ?? "",
    prazo: c?.prazo != null ? String(c.prazo) : "",
    valor_bruto: c?.valor_bruto != null ? String(c.valor_bruto) : "",
    seguro: c?.seguro ?? "",
    status: c?.status ?? "",
    observacao: c?.observacao ?? "",
    dia_amortizacao: String(c?.dia_amortizacao ?? 1),
    proximo_contato_em: c?.proximo_contato_em?.slice(0, 10) ?? "",
    acompanhamento_ativo: c?.acompanhamento_ativo ?? true,
    consultant_id: c?.consultant_id ?? SEM_DONO,
  };
}
