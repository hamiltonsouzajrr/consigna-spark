import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { adminCreateLeads } from "@/lib/prospeccao/prospeccao.functions";

type Consultant = { id: string; email: string };

export function ManualLeadCard({ consultants }: { consultants: Consultant[] }) {
  const qc = useQueryClient();
  const createLeads = useServerFn(adminCreateLeads);
  const [busy, setBusy] = useState(false);
  const [m, setM] = useState({ nome: "", telefone: "", cidade: "", origem: "indicacao", orcamento: "", urgencia: "alta", consultant_id: "none" });

  const createManual = async () => {
    if (!m.nome.trim()) { toast.error("Informe o nome."); return; }
    setBusy(true);
    try {
      await createLeads({ data: { leads: [{
        nome: m.nome.trim(),
        telefone: m.telefone || null,
        cidade: m.cidade || null,
        origem: m.origem,
        orcamento: m.orcamento ? Number(m.orcamento) : null,
        urgencia: m.urgencia as never,
        consultant_id: m.consultant_id === "none" ? null : m.consultant_id,
      }] } });
      toast.success("Lead criado.");
      setM({ nome: "", telefone: "", cidade: "", origem: "indicacao", orcamento: "", urgencia: "alta", consultant_id: "none" });
      qc.invalidateQueries({ queryKey: ["prospect"] });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Falha ao criar lead.");
    }
    setBusy(false);
  };

  return (
    <Card className="p-5">
      <p className="mb-3 text-sm font-semibold">Novo lead (manual)</p>
      <div className="grid grid-cols-2 gap-2">
        <Input placeholder="Nome" value={m.nome} onChange={(e) => setM({ ...m, nome: e.target.value })} className="col-span-2" maxLength={200} />
        <Input placeholder="Telefone" value={m.telefone} onChange={(e) => setM({ ...m, telefone: e.target.value })} maxLength={40} />
        <Input placeholder="Cidade" value={m.cidade} onChange={(e) => setM({ ...m, cidade: e.target.value })} maxLength={120} />
        <Input placeholder="Orçamento" type="number" value={m.orcamento} onChange={(e) => setM({ ...m, orcamento: e.target.value })} />
        <Select value={m.origem} onValueChange={(v) => setM({ ...m, origem: v })}>
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent>{["indicacao", "whatsapp", "site", "evento", "planilha"].map((o) => <SelectItem key={o} value={o}>{o}</SelectItem>)}</SelectContent>
        </Select>
        <Select value={m.urgencia} onValueChange={(v) => setM({ ...m, urgencia: v })}>
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent>{["alta", "media", "baixa"].map((u) => <SelectItem key={u} value={u}>{u}</SelectItem>)}</SelectContent>
        </Select>
        <Select value={m.consultant_id} onValueChange={(v) => setM({ ...m, consultant_id: v })}>
          <SelectTrigger className="col-span-2"><SelectValue placeholder="Consultora" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="none">Não atribuir</SelectItem>
            {consultants.map((c) => <SelectItem key={c.id} value={c.id}>{c.email}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>
      <Button className="mt-3 w-full" disabled={busy} onClick={createManual}>Criar lead</Button>
    </Card>
  );
}
