import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { AppShell } from "@/components/AppShell";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ArrowLeft, Phone, PiggyBank, CalendarClock, CheckCircle2, BellOff, Bell, History } from "lucide-react";
import {
  esteiraListar,
  esteiraRegistrarContato,
  esteiraEncerrarAcompanhamento,
  esteiraHistorico,
  type EsteiraContrato,
} from "@/lib/prospeccao/esteira.functions";

export const Route = createFileRoute("/_authenticated/prospeccao/amortizacao")({
  head: () => ({
    meta: [
      { title: "Minha carteira de amortização — acompanhamento mensal" },
      {
        name: "description",
        content:
          "Clientes com contrato fechado para ligar todo mês e oferecer a amortização de parcela, com histórico de cada contato.",
      },
      { property: "og:title", content: "Minha carteira de amortização" },
      {
        property: "og:description",
        content: "Ligações do dia, atrasadas e histórico de amortização de cada cliente.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex,nofollow" },
    ],
  }),
  component: Page,
});

const BRL = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });
const fmtData = (v: string | null) => (v ? new Date(`${v.slice(0, 10)}T12:00:00`).toLocaleDateString("pt-BR") : "—");
const hojeISO = () => new Date(Date.now() - 3 * 3600_000).toISOString().slice(0, 10);

const RESULTADOS = [
  { value: "amortizou", label: "Amortizou uma parcela", tone: "bg-emerald-100 text-emerald-700" },
  { value: "falei", label: "Falei com o cliente", tone: "bg-sky-100 text-sky-700" },
  { value: "nao_atendeu", label: "Não atendeu", tone: "bg-amber-100 text-amber-800" },
  { value: "nao_quis", label: "Não quis agora", tone: "bg-rose-100 text-rose-700" },
] as const;

function Page() {
  const qc = useQueryClient();
  const listar = useServerFn(esteiraListar);
  const registrar = useServerFn(esteiraRegistrarContato);
  const encerrar = useServerFn(esteiraEncerrarAcompanhamento);
  const historico = useServerFn(esteiraHistorico);

  const [busca, setBusca] = useState("");
  const [mostrarEncerrados, setMostrarEncerrados] = useState(false);
  const [contato, setContato] = useState<EsteiraContrato | null>(null);
  const [resultado, setResultado] = useState<string>("falei");
  const [obs, setObs] = useState("");
  const [salvando, setSalvando] = useState(false);
  const [verHistorico, setVerHistorico] = useState<EsteiraContrato | null>(null);

  const listaQ = useQuery({
    queryKey: ["esteira", "carteira", busca, mostrarEncerrados],
    queryFn: () => listar({ data: { busca: busca || undefined, somenteAtivos: !mostrarEncerrados } }),
    refetchInterval: 120_000,
  });

  const histQ = useQuery({
    queryKey: ["esteira", "historico", verHistorico?.id],
    queryFn: () => historico({ data: { contratoId: verHistorico!.id } }),
    enabled: !!verHistorico,
  });

  const hoje = hojeISO();
  const grupos = useMemo(() => {
    const rows = listaQ.data ?? [];
    return {
      atrasados: rows.filter((r) => r.proximo_contato_em && r.proximo_contato_em < hoje && r.acompanhamento_ativo),
      hoje: rows.filter((r) => r.proximo_contato_em === hoje && r.acompanhamento_ativo),
      proximos: rows.filter((r) => r.proximo_contato_em && r.proximo_contato_em > hoje && r.acompanhamento_ativo),
      outros: rows.filter((r) => !r.acompanhamento_ativo || !r.proximo_contato_em),
    };
  }, [listaQ.data, hoje]);

  const salvarContato = async () => {
    if (!contato) return;
    setSalvando(true);
    try {
      const r = await registrar({
        data: { contratoId: contato.id, resultado: resultado as any, observacao: obs || undefined },
      });
      toast.success("Contato registrado", {
        description: r.proximo ? `Próxima ligação em ${fmtData(r.proximo)}` : "Acompanhamento concluído",
      });
      setContato(null);
      setObs("");
      setResultado("falei");
      qc.invalidateQueries({ queryKey: ["esteira"] });
    } catch (e: any) {
      toast.error("Não foi possível registrar", { description: e.message });
    } finally {
      setSalvando(false);
    }
  };

  const alternar = async (c: EsteiraContrato) => {
    try {
      await encerrar({ data: { contratoId: c.id, ativo: !c.acompanhamento_ativo } });
      toast.success(c.acompanhamento_ativo ? "Lembretes pausados" : "Lembretes reativados");
      qc.invalidateQueries({ queryKey: ["esteira"] });
    } catch (e: any) {
      toast.error("Não foi possível alterar", { description: e.message });
    }
  };

  const Linha = ({ c }: { c: EsteiraContrato }) => (
    <Card className="flex flex-col gap-3 p-3 sm:flex-row sm:items-center">
      <div className="min-w-0 flex-1">
        <p className="truncate font-medium">{c.nome}</p>
        <p className="truncate text-xs text-muted-foreground">
          {c.banco ?? "—"} · venda {fmtData(c.data_venda)} · {c.prazo ? `${c.prazo}x` : "—"} ·{" "}
          {c.valor_bruto != null ? BRL.format(c.valor_bruto) : "—"}
        </p>
        <p className="truncate text-xs text-muted-foreground">
          Ligar todo dia {c.dia_amortizacao} · próxima {fmtData(c.proximo_contato_em)}
          {c.ultimo_contato_em ? ` · último contato ${fmtData(c.ultimo_contato_em)}` : " · nunca contatado"}
        </p>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        {c.status && <Badge variant="outline" className="text-[10px]">{c.status}</Badge>}
        <Badge variant="outline" className="text-[10px]">{c.contatos} contato(s)</Badge>
        <Button size="sm" onClick={() => setContato(c)}>
          <Phone className="mr-1.5 h-3.5 w-3.5" /> Registrar contato
        </Button>
        <Button size="sm" variant="outline" onClick={() => setVerHistorico(c)}>
          <History className="h-3.5 w-3.5" />
        </Button>
        <Button size="sm" variant="ghost" onClick={() => alternar(c)} title={c.acompanhamento_ativo ? "Pausar lembretes" : "Reativar lembretes"}>
          {c.acompanhamento_ativo ? <BellOff className="h-3.5 w-3.5" /> : <Bell className="h-3.5 w-3.5" />}
        </Button>
      </div>
    </Card>
  );

  const Bloco = ({ titulo, itens, vazio }: { titulo: string; itens: EsteiraContrato[]; vazio?: string }) => (
    <section className="space-y-2">
      <h2 className="text-sm font-semibold text-muted-foreground">
        {titulo} <span className="ml-1 text-xs font-normal">({itens.length})</span>
      </h2>
      {itens.length === 0 ? (
        <p className="rounded-lg border border-dashed p-4 text-sm text-muted-foreground">{vazio ?? "Nada por aqui."}</p>
      ) : (
        <div className="space-y-2">{itens.map((c) => <Linha key={c.id} c={c} />)}</div>
      )}
    </section>
  );

  return (
    <AppShell>
      <div className="mx-auto max-w-5xl space-y-6 p-4 sm:p-6">
        <div className="flex flex-wrap items-center gap-3">
          <Button asChild variant="ghost" size="sm">
            <Link to="/prospeccao">
              <ArrowLeft className="mr-1.5 h-4 w-4" /> Voltar
            </Link>
          </Button>
          <div className="min-w-0">
            <h1 className="flex items-center gap-2 text-xl font-bold">
              <PiggyBank className="h-5 w-5 text-primary" /> Minha carteira de amortização
            </h1>
            <p className="text-sm text-muted-foreground">
              Ligue todo mês para o cliente que já fechou contrato e ofereça amortizar uma parcela.
            </p>
          </div>
        </div>

        <CarteiraTabs />


        <div className="flex flex-wrap items-end gap-3">
          <div className="space-y-1.5">
            <Label className="text-xs">Buscar por nome ou CPF</Label>
            <Input value={busca} onChange={(e) => setBusca(e.target.value)} className="w-[260px]" placeholder="Ex.: Maria ou 123456…" />
          </div>
          <Button variant="outline" size="sm" onClick={() => setMostrarEncerrados((v) => !v)}>
            {mostrarEncerrados ? "Ver só ativos" : "Incluir pausados/concluídos"}
          </Button>
        </div>

        {listaQ.isLoading ? (
          <div className="space-y-2">
            {[0, 1, 2].map((i) => <Skeleton key={i} className="h-20 w-full" />)}
          </div>
        ) : (listaQ.data ?? []).length === 0 ? (
          <Card className="p-8 text-center text-sm text-muted-foreground">
            Nenhum contrato na sua carteira ainda. A administração sobe a esteira de produção e ele aparece aqui.
          </Card>
        ) : (
          <div className="space-y-6">
            <Bloco titulo="Atrasadas" itens={grupos.atrasados} vazio="Nenhuma ligação atrasada." />
            <Bloco titulo="Para ligar hoje" itens={grupos.hoje} vazio="Nenhuma ligação marcada para hoje." />
            <Bloco titulo="Próximas" itens={grupos.proximos} vazio="Sem próximas ligações." />
            {mostrarEncerrados && <Bloco titulo="Pausados e concluídos" itens={grupos.outros} />}
          </div>
        )}
      </div>

      <Dialog open={!!contato} onOpenChange={(o) => !o && setContato(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Registrar contato</DialogTitle>
            <DialogDescription>
              {contato?.nome} · {contato?.banco ?? "—"} · ligar todo dia {contato?.dia_amortizacao}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-2">
              {RESULTADOS.map((r) => (
                <Button
                  key={r.value}
                  variant={resultado === r.value ? "default" : "outline"}
                  size="sm"
                  onClick={() => setResultado(r.value)}
                >
                  {r.label}
                </Button>
              ))}
            </div>
            <div className="space-y-1.5">
              <Label>Observação (opcional)</Label>
              <Textarea value={obs} onChange={(e) => setObs(e.target.value)} rows={3} placeholder="O que o cliente disse…" />
            </div>
            <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <CalendarClock className="h-3.5 w-3.5" /> O próximo lembrete é criado automaticamente no mês seguinte.
            </p>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setContato(null)}>Cancelar</Button>
            <Button onClick={salvarContato} disabled={salvando}>
              <CheckCircle2 className="mr-1.5 h-4 w-4" /> {salvando ? "Salvando…" : "Salvar contato"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!verHistorico} onOpenChange={(o) => !o && setVerHistorico(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Histórico de {verHistorico?.nome}</DialogTitle>
            <DialogDescription>Todos os contatos de amortização registrados.</DialogDescription>
          </DialogHeader>
          <div className="max-h-80 space-y-2 overflow-y-auto">
            {histQ.isLoading ? (
              <Skeleton className="h-16 w-full" />
            ) : (histQ.data ?? []).length === 0 ? (
              <p className="text-sm text-muted-foreground">Nenhum contato registrado ainda.</p>
            ) : (
              (histQ.data ?? []).map((h) => {
                const meta = RESULTADOS.find((r) => r.value === h.resultado);
                return (
                  <div key={h.id} className="rounded-lg border p-2 text-sm">
                    <div className="flex items-center justify-between gap-2">
                      <Badge variant="secondary" className={`border-0 ${meta?.tone ?? ""}`}>
                        {meta?.label ?? h.resultado}
                      </Badge>
                      <span className="text-xs text-muted-foreground">
                        {new Date(h.contato_em).toLocaleString("pt-BR")}
                      </span>
                    </div>
                    {h.observacao && <p className="mt-1 text-xs text-muted-foreground">{h.observacao}</p>}
                  </div>
                );
              })
            )}
          </div>
        </DialogContent>
      </Dialog>
    </AppShell>
  );
}
