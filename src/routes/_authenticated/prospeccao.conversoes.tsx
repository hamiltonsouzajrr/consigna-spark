import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { AppShell } from "@/components/AppShell";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ArrowLeft, Plus, Trash2, Pencil, CalendarClock, Wallet, CheckCircle2, Clock, XCircle } from "lucide-react";
import { CarteiraTabs } from "@/components/prospeccao/CarteiraTabs";
import {
  listarConversoes,
  criarConversao,
  atualizarConversao,
  removerConversao,
  buscarLeadsCarteira,
  LEMBRETE_LABEL,
  LEMBRETE_OPCOES,
  type Conversao,
  type LembreteOpcao,
  type TipoMargemConversao,
} from "@/lib/prospeccao/conversoes.functions";

export const Route = createFileRoute("/_authenticated/prospeccao/conversoes")({
  head: () => ({
    meta: [
      { title: "Minha carteira — conversões e retorno de margem" },
      {
        name: "description",
        content:
          "Registre o cliente convertido com data, valor liberado, prazo e parcela, marque se restou margem e agende quando retornar.",
      },
      { property: "og:title", content: "Minha carteira — conversões" },
      {
        property: "og:description",
        content: "Clientes convertidos, valores, margem restante e lembretes de retorno.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex,nofollow" },
    ],
  }),
  component: Page,
});

const BRL = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });
const fmtData = (v: string) => new Date(`${v}T12:00:00`).toLocaleDateString("pt-BR");
const fmtDataHora = (v: string) => new Date(v).toLocaleDateString("pt-BR");

function hojeISO() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function numeroBr(v: string): number | null {
  const t = v.replace(/\s/g, "").replace(/\./g, "").replace(",", ".");
  if (!t) return null;
  const n = Number(t);
  return Number.isFinite(n) ? n : null;
}

type FormState = {
  id?: string;
  leadId: string | null;
  tomadorId: string | null;
  origem: "crm" | "tomadores_al";
  clienteNome: string;
  cpf: string;
  dataOperacao: string;
  valorLiberado: string;
  prazo: string;
  valorParcela: string;
  margemRestante: "toda" | "restou";
  tipoMargem: TipoMargemConversao;
  margemUsada: string;
  margemRestanteValor: string;
  observacao: string;
  lembrete: LembreteOpcao | "manter";
};

const vazio = (): FormState => ({
  leadId: null,
  tomadorId: null,
  origem: "crm",
  clienteNome: "",
  cpf: "",
  dataOperacao: hojeISO(),
  valorLiberado: "",
  prazo: "",
  valorParcela: "",
  margemRestante: "toda",
  tipoMargem: "emprestimo",
  margemUsada: "",
  margemRestanteValor: "",
  observacao: "",
  lembrete: "1m",
});

const STATUS_BADGE: Record<string, { label: string; icon: typeof Clock; cls: string }> = {
  pendente: { label: "Aguardando o gerente", icon: Clock, cls: "bg-amber-500/15 text-amber-700 dark:text-amber-400" },
  confirmada: { label: "Confirmada", icon: CheckCircle2, cls: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400" },
  recusada: { label: "Recusada", icon: XCircle, cls: "bg-destructive/15 text-destructive" },
};

function Page() {
  const listar = useServerFn(listarConversoes);
  const criar = useServerFn(criarConversao);
  const atualizar = useServerFn(atualizarConversao);
  const remover = useServerFn(removerConversao);
  const buscarLeads = useServerFn(buscarLeadsCarteira);
  const qc = useQueryClient();

  const [aberto, setAberto] = useState(false);
  const [form, setForm] = useState<FormState>(vazio());
  const [termoLead, setTermoLead] = useState("");

  const { data, isLoading } = useQuery({
    queryKey: ["conversoes"],
    queryFn: () => listar({ data: {} }),
    refetchOnWindowFocus: false,
  });

  const { data: leads } = useQuery({
    queryKey: ["conversoes-leads", termoLead],
    queryFn: () => buscarLeads({ data: { termo: termoLead } }),
    enabled: termoLead.trim().length >= 2,
  });

  const itens = data?.itens ?? [];

  const totalMes = useMemo(() => {
    const mes = hojeISO().slice(0, 7);
    const doMes = itens.filter((i) => i.data_operacao.startsWith(mes));
    return { qtd: doMes.length, valor: doMes.reduce((s, i) => s + i.valor_liberado, 0) };
  }, [itens]);

  const salvar = useMutation({
    mutationFn: async () => {
      const valor = numeroBr(form.valorLiberado);
      if (!form.clienteNome.trim()) throw new Error("Informe o nome do cliente");
      if (valor == null || valor <= 0) throw new Error("Informe o valor liberado");
      const payload = {
        leadId: form.leadId,
        tomadorId: form.tomadorId,
        origem: form.origem,
        clienteNome: form.clienteNome.trim(),
        cpf: form.cpf || null,
        dataOperacao: form.dataOperacao,
        valorLiberado: valor,
        prazo: form.prazo ? Number(form.prazo.replace(/\D/g, "")) : null,
        valorParcela: numeroBr(form.valorParcela),
        margemRestante: form.margemRestante === "restou",
        tipoMargem: form.tipoMargem,
        margemUsada: numeroBr(form.margemUsada) ?? 0,
        margemRestanteValor: form.margemRestante === "restou" ? numeroBr(form.margemRestanteValor) : null,
        observacao: form.observacao.trim() || null,
        lembrete: form.lembrete,
      };
      if (form.id) return atualizar({ data: { ...payload, id: form.id } });
      return criar({
        data: {
          ...payload,
          lembrete: form.lembrete === "manter" ? "nenhum" : form.lembrete,
        },
      });
    },
    onSuccess: () => {
      toast.success(form.id ? "Conversão atualizada" : "Conversão registrada — o gerente vai confirmar a venda");
      setAberto(false);
      setForm(vazio());
      qc.invalidateQueries({ queryKey: ["conversoes"] });
    },
    onError: (e: any) => toast.error(e?.message ?? "Não foi possível salvar"),
  });

  const excluir = useMutation({
    mutationFn: (id: string) => remover({ data: { id } }),
    onSuccess: () => {
      toast.success("Conversão removida");
      qc.invalidateQueries({ queryKey: ["conversoes"] });
    },
    onError: (e: any) => toast.error(e?.message ?? "Não foi possível remover"),
  });

  function editar(c: Conversao) {
    setForm({
      id: c.id,
      leadId: c.lead_id,
      tomadorId: c.tomador_id,
      origem: c.origem,
      clienteNome: c.cliente_nome,
      cpf: c.cpf ?? "",
      dataOperacao: c.data_operacao,
      valorLiberado: String(c.valor_liberado).replace(".", ","),
      prazo: c.prazo ? String(c.prazo) : "",
      valorParcela: c.valor_parcela != null ? String(c.valor_parcela).replace(".", ",") : "",
      margemRestante: c.margem_restante ? "restou" : "toda",
      tipoMargem: c.tipo_margem ?? "emprestimo",
      margemUsada: c.margem_usada != null ? String(c.margem_usada).replace(".", ",") : "",
      margemRestanteValor: c.margem_restante_valor != null ? String(c.margem_restante_valor).replace(".", ",") : "",
      observacao: c.observacao ?? "",
      lembrete: c.lembrete_em ? "manter" : "nenhum",
    });
    setAberto(true);
  }

  return (
    <AppShell>
      <CarteiraTabs />
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0">
          <Button asChild variant="ghost" size="sm" className="-ml-2 mb-1">
            <Link to="/prospeccao"><ArrowLeft className="mr-2 h-4 w-4" /> Voltar</Link>
          </Button>
          <h1 className="truncate text-2xl font-bold">Minha carteira — conversões</h1>
          <p className="text-sm text-muted-foreground">
            Registre o cliente que fechou, o valor retirado e quando você quer ser lembrada de voltar.
          </p>
        </div>
        <Button
          onClick={() => {
            setForm(vazio());
            setAberto(true);
          }}
        >
          <Plus className="mr-2 h-4 w-4" /> Nova conversão
        </Button>
      </div>

      <div className="mb-4 grid grid-cols-2 gap-3">
        <Card className="p-4">
          <p className="text-xs uppercase tracking-wide text-muted-foreground">Conversões no mês</p>
          <p className="text-2xl font-bold">{totalMes.qtd}</p>
        </Card>
        <Card className="p-4">
          <p className="text-xs uppercase tracking-wide text-muted-foreground">Valor liberado no mês</p>
          <p className="text-2xl font-bold">{BRL.format(totalMes.valor)}</p>
        </Card>
      </div>

      <ClientesPlanilhaCards />

      {isLoading ? (
        <div className="space-y-3">
          <Skeleton className="h-24 w-full" />
          <Skeleton className="h-24 w-full" />
        </div>
      ) : !itens.length ? (
        <Card className="p-6 text-center text-sm text-muted-foreground">
          Nenhuma conversão registrada ainda. Toque em “Nova conversão” quando fechar um cliente.
        </Card>
      ) : (
        <div className="space-y-3">
          {itens.map((c) => {
            const st = c.venda_status ? STATUS_BADGE[c.venda_status] : null;
            const Icon = st?.icon ?? Clock;
            return (
              <Card key={c.id} className="p-4">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="truncate font-semibold">{c.cliente_nome}</p>
                    <p className="text-xs text-muted-foreground">
                      {fmtData(c.data_operacao)}
                      {data?.isAdmin && c.consultora_nome ? ` · ${c.consultora_nome}` : ""}
                    </p>
                  </div>
                  {st && (
                    <span className={`inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium ${st.cls}`}>
                      <Icon className="h-3.5 w-3.5" /> {st.label}
                    </span>
                  )}
                </div>

                <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-5">
                  <div className="rounded-md border bg-muted/30 px-3 py-2">
                    <p className="text-[11px] uppercase tracking-wide text-muted-foreground">Margem usada</p>
                    <p className="text-sm font-semibold">{c.tipo_margem === "cartao_credito" ? "Cartão crédito" : c.tipo_margem === "cartao_beneficio" ? "Cartão benefício" : "Empréstimo"} · {c.margem_usada != null ? BRL.format(c.margem_usada) : "—"}</p>
                  </div>
                  <div className="rounded-md border bg-muted/30 px-3 py-2">
                    <p className="text-[11px] uppercase tracking-wide text-muted-foreground">Valor liberado</p>
                    <p className="text-sm font-semibold">{BRL.format(c.valor_liberado)}</p>
                  </div>
                  <div className="rounded-md border bg-muted/30 px-3 py-2">
                    <p className="text-[11px] uppercase tracking-wide text-muted-foreground">Prazo</p>
                    <p className="text-sm font-semibold">{c.prazo ? `${c.prazo}x` : "—"}</p>
                  </div>
                  <div className="rounded-md border bg-muted/30 px-3 py-2">
                    <p className="text-[11px] uppercase tracking-wide text-muted-foreground">Parcela</p>
                    <p className="text-sm font-semibold">{c.valor_parcela != null ? BRL.format(c.valor_parcela) : "—"}</p>
                  </div>
                  <div className="rounded-md border bg-muted/30 px-3 py-2">
                    <p className="text-[11px] uppercase tracking-wide text-muted-foreground">Margem</p>
                    <p className="text-sm font-semibold">
                      {c.margem_restante
                        ? c.margem_restante_valor != null
                          ? `Restou ${BRL.format(c.margem_restante_valor)}`
                          : "Ainda restou margem"
                        : "Usou toda a margem"}
                    </p>
                  </div>
                </div>

                {c.observacao && <p className="mt-2 text-sm text-muted-foreground">{c.observacao}</p>}

                <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
                  <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                    {c.lembrete_em ? (
                      <>
                        <CalendarClock className="h-3.5 w-3.5" /> Retornar em {fmtDataHora(c.lembrete_em)}
                      </>
                    ) : (
                      <>
                        <Wallet className="h-3.5 w-3.5" /> Sem lembrete
                      </>
                    )}
                  </span>
                  <div className="flex gap-2">
                    <Button size="sm" variant="outline" onClick={() => editar(c)}>
                      <Pencil className="mr-1 h-3.5 w-3.5" /> Editar
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="text-destructive"
                      onClick={() => excluir.mutate(c.id)}
                      disabled={excluir.isPending}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      )}

      <Dialog open={aberto} onOpenChange={setAberto}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{form.id ? "Editar conversão" : "Nova conversão"}</DialogTitle>
            <DialogDescription>
              Os pontos da campanha entram somente depois que o gerente confirmar a venda.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3">
            <div>
              <Label>Cliente</Label>
              <Input
                value={form.clienteNome}
                placeholder="Nome do cliente"
                onChange={(e) => {
                  setForm((f) => ({ ...f, clienteNome: e.target.value, leadId: null }));
                  setTermoLead(e.target.value);
                }}
              />
              {!!leads?.length && !form.leadId && (
                <div className="mt-1 rounded-md border">
                  {leads.map((l) => (
                    <button
                      key={l.id}
                      type="button"
                      className="block w-full truncate px-3 py-2 text-left text-sm hover:bg-muted"
                      onClick={() => {
                        setForm((f) => ({ ...f, leadId: l.id, clienteNome: l.nome, cpf: l.cpf ?? "" }));
                        setTermoLead("");
                      }}
                    >
                      {l.nome} {l.cpf ? `· ${l.cpf}` : ""}
                    </button>
                  ))}
                </div>
              )}
              {form.leadId && (
                <Badge variant="secondary" className="mt-1">Cliente da sua carteira</Badge>
              )}
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Data da operação</Label>
                <Input
                  type="date"
                  value={form.dataOperacao}
                  onChange={(e) => setForm((f) => ({ ...f, dataOperacao: e.target.value }))}
                />
              </div>
              <div>
                <Label>CPF (opcional)</Label>
                <Input value={form.cpf} onChange={(e) => setForm((f) => ({ ...f, cpf: e.target.value }))} />
              </div>
              <div>
                <Label>Valor liberado</Label>
                <Input
                  inputMode="decimal"
                  placeholder="0,00"
                  value={form.valorLiberado}
                  onChange={(e) => setForm((f) => ({ ...f, valorLiberado: e.target.value }))}
                />
              </div>
              <div>
                <Label>Prazo (parcelas)</Label>
                <Input
                  inputMode="numeric"
                  placeholder="96"
                  value={form.prazo}
                  onChange={(e) => setForm((f) => ({ ...f, prazo: e.target.value }))}
                />
              </div>
              <div>
                <Label>Valor da parcela</Label>
                <Input
                  inputMode="decimal"
                  placeholder="0,00"
                  value={form.valorParcela}
                  onChange={(e) => setForm((f) => ({ ...f, valorParcela: e.target.value }))}
                />
              </div>
              <div>
                <Label>Tipo de margem usada</Label>
                <Select value={form.tipoMargem} onValueChange={(v) => setForm((f) => ({ ...f, tipoMargem: v as TipoMargemConversao }))}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="emprestimo">Empréstimo</SelectItem><SelectItem value="cartao_credito">Cartão de crédito</SelectItem><SelectItem value="cartao_beneficio">Cartão benefício</SelectItem></SelectContent></Select>
              </div>
              <div>
                <Label>Margem usada</Label>
                <Input inputMode="decimal" placeholder="0,00" value={form.margemUsada} onChange={(e) => setForm((f) => ({ ...f, margemUsada: e.target.value }))} />
              </div>
              <div>
                <Label>Margem</Label>
                <Select
                  value={form.margemRestante}
                  onValueChange={(v) => setForm((f) => ({ ...f, margemRestante: v as "toda" | "restou" }))}
                >
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="toda">Usou toda a margem</SelectItem>
                    <SelectItem value="restou">Ainda restou margem</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              {form.margemRestante === "restou" && (
                <div className="col-span-2">
                  <Label>Margem que sobrou (opcional)</Label>
                  <Input
                    inputMode="decimal"
                    placeholder="0,00"
                    value={form.margemRestanteValor}
                    onChange={(e) => setForm((f) => ({ ...f, margemRestanteValor: e.target.value }))}
                  />
                </div>
              )}
            </div>

            <div>
              <Label>Lembrar de contatar novamente</Label>
              <Select
                value={form.lembrete}
                onValueChange={(v) => setForm((f) => ({ ...f, lembrete: v as LembreteOpcao | "manter" }))}
              >
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {form.lembrete === "manter" && (
                    <SelectItem value="manter">Manter a data atual</SelectItem>
                  )}
                  {LEMBRETE_OPCOES.map((o) => (
                    <SelectItem key={o} value={o}>{LEMBRETE_LABEL[o]}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label>Observação (opcional)</Label>
              <Textarea
                rows={2}
                value={form.observacao}
                onChange={(e) => setForm((f) => ({ ...f, observacao: e.target.value }))}
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setAberto(false)}>Cancelar</Button>
            <Button onClick={() => salvar.mutate()} disabled={salvar.isPending}>
              {salvar.isPending ? "Salvando..." : "Salvar conversão"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AppShell>
  );
}
