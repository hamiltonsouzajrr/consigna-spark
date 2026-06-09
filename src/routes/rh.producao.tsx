import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Trash2, Save, FileText, Lock } from "lucide-react";
import { RhPageHeader } from "@/components/rh/RhLayout";
import { ImportProducaoDialog } from "@/components/rh/ImportProducaoDialog";
import { useRhAccess } from "@/hooks/use-rh-access";
import { useAuth } from "@/lib/auth";
import { brl, colaboradores } from "@/lib/rh/mock";
import {
  producaoMesQueryOptions,
  upsertProducao,
  deleteProducao,
  mesAtual,
  formatMes,
} from "@/lib/rh/producao";

export const Route = createFileRoute("/rh/producao")({
  component: ProducaoAdmin,
});

function ProducaoAdmin() {
  const { isAdmin, canAccess, isLoading } = useRhAccess();
  const canView = isAdmin || canAccess("/rh/producao");
  const { user } = useAuth();
  const qc = useQueryClient();

  const [mes, setMes] = useState(mesAtual());
  const [consultora, setConsultora] = useState<string>("");
  const [valor, setValor] = useState<string>("");
  const [contratos, setContratos] = useState<string>("");
  const [saving, setSaving] = useState(false);

  const { data: lista } = useQuery(producaoMesQueryOptions(mes));

  const consultoraDep = useMemo(
    () => colaboradores.find((c) => c.nome === consultora)?.departamento ?? null,
    [consultora],
  );

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ["rh", "producao"] });
  };

  const onEdit = (nome: string, v: number, c: number) => {
    setConsultora(nome);
    setValor(String(v));
    setContratos(String(c));
  };

  const onSave = async () => {
    if (!consultora) { toast.error("Selecione a consultora"); return; }
    const v = Number(valor.replace(",", "."));
    const c = Number(contratos);
    if (isNaN(v) || v < 0) { toast.error("Valor inválido"); return; }
    if (isNaN(c) || c < 0) { toast.error("Quantidade de contratos inválida"); return; }
    setSaving(true);
    try {
      await upsertProducao(
        { consultora, departamento: consultoraDep, mes, valor: v, contratos: c },
        user?.id,
      );
      invalidate();
      toast.success("Produção salva", { description: `${consultora} · ${formatMes(mes)}` });
      setConsultora(""); setValor(""); setContratos("");
    } catch (e: any) {
      toast.error("Falha ao salvar", { description: e.message });
    } finally {
      setSaving(false);
    }
  };

  const onDelete = async (id: string) => {
    try {
      await deleteProducao(id);
      invalidate();
      toast.success("Lançamento removido");
    } catch (e: any) {
      toast.error("Falha ao remover", { description: e.message });
    }
  };

  if (isLoading) {
    return <p className="py-10 text-center text-sm text-muted-foreground">Carregando…</p>;
  }

  if (!isAdmin) {
    return (
      <div>
        <RhPageHeader title="Produção" description="Lançamento de produção das consultoras." />
        <Card>
          <CardContent className="flex flex-col items-center gap-3 py-12 text-center">
            <Lock className="h-8 w-8 text-muted-foreground" />
            <p className="text-sm text-muted-foreground">Acesso restrito a administradores.</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div>
      <RhPageHeader
        title="Produção"
        description="Lance a produção mensal — atualiza automaticamente o ranking e o painel de cada consultora."
        actions={<ImportProducaoDialog defaultMes={mes} userId={user?.id} />}
      />

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-1">
          <CardHeader className="pb-3"><CardTitle className="text-base">Novo lançamento</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-1.5">
              <Label>Mês de referência</Label>
              <Input type="month" value={mes} onChange={(e) => setMes(e.target.value || mesAtual())} />
            </div>
            <div className="space-y-1.5">
              <Label>Consultora</Label>
              <Select value={consultora} onValueChange={setConsultora}>
                <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                <SelectContent>
                  {colaboradores.map((c) => (
                    <SelectItem key={c.id} value={c.nome}>{c.nome}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {consultoraDep && <p className="text-xs text-muted-foreground">{consultoraDep}</p>}
            </div>
            <div className="space-y-1.5">
              <Label>Valor produzido (R$)</Label>
              <Input inputMode="decimal" placeholder="0,00" value={valor} onChange={(e) => setValor(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>Contratos</Label>
              <Input inputMode="numeric" placeholder="0" value={contratos} onChange={(e) => setContratos(e.target.value)} />
            </div>
            <Button onClick={onSave} disabled={saving} className="w-full">
              <Save className="mr-2 h-4 w-4" /> {saving ? "Salvando…" : "Salvar produção"}
            </Button>
          </CardContent>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader className="pb-2"><CardTitle className="text-base">Lançamentos de {formatMes(mes)}</CardTitle></CardHeader>
          <CardContent className="space-y-2">
            {(lista ?? []).length === 0 ? (
              <p className="py-6 text-center text-sm text-muted-foreground">Nenhum lançamento neste mês.</p>
            ) : (
              (lista ?? []).map((r) => (
                <div key={r.id} className="flex items-center gap-3 rounded-lg border p-2">
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{r.consultora}</p>
                    <p className="truncate text-xs text-muted-foreground">{r.departamento ?? "—"}</p>
                  </div>
                  <Badge variant="secondary" className="border-0">
                    <FileText className="mr-1 h-3 w-3" /> {r.contratos}
                  </Badge>
                  <span className="font-semibold tabular-nums">{brl(r.valor)}</span>
                  <Button variant="ghost" size="sm" onClick={() => onEdit(r.consultora, r.valor, r.contratos)}>
                    Editar
                  </Button>
                  <Button variant="ghost" size="icon" onClick={() => onDelete(r.id)}>
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                </div>
              ))
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
