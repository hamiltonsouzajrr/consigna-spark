// Admin-only "Central de Aprovação" section inside a lead.
// Create an approval session (generates the client link), list sessions, open the host call.
import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Video, Copy, Plus, ShieldCheck, Loader2 } from "lucide-react";
import { HostCall } from "@/components/legal/HostCall";

type Approval = {
  id: string; token: string; nome_completo: string; cpf: string | null; banco: string | null;
  tipo_operacao: string | null; valor_solicitado: number | null; valor_parcela: number | null;
  status: string; cliente_aceite: boolean | null; gravado_em: string | null; created_at: string;
};

export function CentralAprovacao({ lead }: { lead: { id: string; nome: string; cpf: string | null } }) {
  const { user } = useAuth();
  const [items, setItems] = useState<Approval[]>([]);
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [active, setActive] = useState<Approval | null>(null);

  const [form, setForm] = useState({
    nome_completo: lead.nome, cpf: lead.cpf ?? "", banco: "", tipo_operacao: "",
    valor_solicitado: "", valor_parcela: "",
  });

  const load = useCallback(async () => {
    const { data } = await supabase
      .from("legal_approvals").select("*").eq("lead_id", lead.id).order("created_at", { ascending: false });
    setItems((data ?? []) as any);
  }, [lead.id]);
  useEffect(() => { load(); }, [load]);

  const create = async () => {
    if (!form.nome_completo.trim()) { toast.error("Informe o nome completo."); return; }
    setBusy(true);
    // Short, hard-to-guess token (12 chars) for a shorter shareable link.
    const token = Array.from(crypto.getRandomValues(new Uint8Array(9)))
      .map((b) => "abcdefghijklmnopqrstuvwxyz0123456789"[b % 36]).join("");
    const { data, error } = await supabase.from("legal_approvals").insert({
      lead_id: lead.id, token, consultant_id: user?.id ?? null, consultant_email: user?.email ?? null,
      created_by: user?.id ?? null, nome_completo: form.nome_completo.trim(), cpf: form.cpf.trim() || null,
      banco: form.banco.trim() || null, tipo_operacao: form.tipo_operacao.trim() || null,
      valor_solicitado: form.valor_solicitado ? Number(form.valor_solicitado) : null,
      valor_parcela: form.valor_parcela ? Number(form.valor_parcela) : null,
    } as any).select("*").maybeSingle();
    setBusy(false);
    if (error) { toast.error(error.message); return; }
    toast.success("Sessão de aprovação criada.");
    setOpen(false);
    await load();
    if (data) setActive(data as any);
  };

  const copyLink = async (token: string) => {
    await navigator.clipboard.writeText(`${window.location.origin}/aprovacao/${token}`);
    toast.success("Link do cliente copiado.");
  };

  return (
    <div className="rounded-lg border p-4">
      <div className="mb-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <ShieldCheck className="h-5 w-5 text-primary" />
          <h3 className="font-semibold">Central de Aprovação <Badge variant="secondary" className="ml-1">Admin</Badge></h3>
        </div>
        <Button size="sm" onClick={() => setOpen((v) => !v)}><Plus className="mr-2 h-4 w-4" /> Nova sessão</Button>
      </div>
      <p className="mb-3 text-sm text-muted-foreground">
        Gere um link exclusivo para o cliente entrar em uma videochamada gravada com o roteiro de confirmação.
      </p>

      {open && (
        <div className="mb-4 grid gap-3 rounded-md border bg-muted/30 p-3 sm:grid-cols-2">
          <Field label="Nome completo" value={form.nome_completo} onChange={(v) => setForm({ ...form, nome_completo: v })} />
          <Field label="CPF" value={form.cpf} onChange={(v) => setForm({ ...form, cpf: v })} />
          <Field label="Banco" value={form.banco} onChange={(v) => setForm({ ...form, banco: v })} />
          <Field label="Tipo da operação" value={form.tipo_operacao} onChange={(v) => setForm({ ...form, tipo_operacao: v })} />
          <Field label="Valor solicitado" type="number" value={form.valor_solicitado} onChange={(v) => setForm({ ...form, valor_solicitado: v })} />
          <Field label="Valor da parcela" type="number" value={form.valor_parcela} onChange={(v) => setForm({ ...form, valor_parcela: v })} />
          <div className="sm:col-span-2">
            <Button onClick={create} disabled={busy}>
              {busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Plus className="mr-2 h-4 w-4" />} Criar e abrir chamada
            </Button>
          </div>
        </div>
      )}

      <div className="space-y-2">
        {items.length === 0 && <p className="text-sm text-muted-foreground">Nenhuma sessão criada ainda.</p>}
        {items.map((it) => (
          <div key={it.id} className="flex flex-wrap items-center justify-between gap-2 rounded-md border p-3 text-sm">
            <div>
              <p className="font-medium">{it.nome_completo}</p>
              <p className="text-xs text-muted-foreground">
                {new Date(it.created_at).toLocaleString("pt-BR")} ·{" "}
                <StatusBadge status={it.status} aceite={it.cliente_aceite} />
              </p>
            </div>
            <div className="flex gap-2">
              <Button size="sm" variant="outline" onClick={() => copyLink(it.token)}><Copy className="mr-2 h-4 w-4" /> Link</Button>
              <Button size="sm" onClick={() => setActive(it)}><Video className="mr-2 h-4 w-4" /> Entrar na chamada</Button>
            </div>
          </div>
        ))}
      </div>

      {active && <HostCall approval={active} onClose={() => setActive(null)} onSaved={load} />}
    </div>
  );
}

function StatusBadge({ status, aceite }: { status: string; aceite: boolean | null }) {
  if (status === "concluido") return <span className={aceite ? "text-emerald-600" : aceite === false ? "text-destructive" : ""}>Concluído{aceite === true ? " · Autorizado" : aceite === false ? " · Não autorizado" : ""}</span>;
  return <span className="text-muted-foreground">Pendente</span>;
}

function Field({ label, value, onChange, type = "text" }: { label: string; value: string; onChange: (v: string) => void; type?: string }) {
  return (
    <div className="space-y-1">
      <Label className="text-xs">{label}</Label>
      <Input type={type} value={value} onChange={(e) => onChange(e.target.value)} />
    </div>
  );
}
