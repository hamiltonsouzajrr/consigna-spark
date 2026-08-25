// PROMOVIDOS RECENTEMENTE — leads do Radar Diário Oficial dos últimos 15 dias,
// entregues automaticamente à consultora logada (rodízio no banco).
import { createFileRoute, Link } from "@tanstack/react-router";
import { useCallback, useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useAuth } from "@/lib/auth";
import { AppShell } from "@/components/AppShell";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import {
  PartyPopper, Loader2, Copy, Building2, ArrowLeft, ShieldQuestion, CheckCircle2,
  Phone, RefreshCw, IdCard,
} from "lucide-react";
import { WhatsAppIcon } from "@/components/WhatsAppIcon";
import { whatsappLink } from "@/lib/prospeccao/constants";
import { marcarAbordagem } from "@/lib/radar/radar.functions";
import {
  getPromovidosRecentes, confirmarCpfPromovido, distribuirPromovidosAgora,
  type PromovidoRecente,
} from "@/lib/radar/promovidos-recentes.functions";
import { useRhAccess } from "@/hooks/use-rh-access";

export const Route = createFileRoute("/_authenticated/prospeccao/promovidos-recentes")({
  head: () => ({
    meta: [
      { title: "Promovidos recentemente — CRM" },
      {
        name: "description",
        content: "Servidores recém promovidos entregues automaticamente pelo Radar Diário Oficial, com janela de ouro de 48h.",
      },
      { name: "robots", content: "noindex,nofollow" },
    ],
  }),
  component: Page,
});

const PAGE = 12;

function fmtData(iso: string | null): string {
  if (!iso) return "—";
  const [y, m, d] = String(iso).slice(0, 10).split("-");
  return y && m && d ? `${d}/${m}/${y}` : iso;
}

function diasDe(iso: string | null): number {
  if (!iso) return 99;
  const t = Date.parse(`${String(iso).slice(0, 10)}T12:00:00Z`);
  if (Number.isNaN(t)) return 99;
  return Math.floor((Date.now() - t) / 86_400_000);
}

function urgencia(iso: string | null) {
  const d = diasDe(iso);
  if (d <= 2) return { label: "Janela de ouro (48h)", cls: "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400" };
  if (d <= 7) return { label: `${d} dias`, cls: "bg-amber-500/15 text-amber-600 dark:text-amber-400" };
  return { label: `${d} dias`, cls: "bg-muted text-muted-foreground" };
}

const STATUS_LABEL: Record<string, string> = {
  novo: "Novo",
  contatado: "Contatado",
  proposta_enviada: "Proposta enviada",
  convertido: "Convertido",
  sem_interesse: "Sem interesse",
};

function Page() {
  const { user } = useAuth();
  const { isAdmin } = useRhAccess();
  const fetchLeads = useServerFn(getPromovidosRecentes);
  const confirmarCpf = useServerFn(confirmarCpfPromovido);
  const abordagemFn = useServerFn(marcarAbordagem);
  const distribuirFn = useServerFn(distribuirPromovidosAgora);

  const [rows, setRows] = useState<PromovidoRecente[]>([]);
  const [total, setTotal] = useState(0);
  const [stats, setStats] = useState({ novosHoje: 0, novos7d: 0, semCpf: 0, naoAbordados: 0 });
  const [consultoraNome, setConsultoraNome] = useState<string | null>(null);
  const [vinculada, setVinculada] = useState(false);
  const [loading, setLoading] = useState(true);
  const [more, setMore] = useState(false);
  const [apenasNovos, setApenasNovos] = useState(false);
  const [cpfDraft, setCpfDraft] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState<string | null>(null);

  const carregar = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    try {
      const res = await fetchLeads({ data: { offset: 0, limit: PAGE, apenasNovos } });
      setRows(res.rows);
      setTotal(res.total);
      setConsultoraNome(res.consultoraNome);
      setVinculada(res.vinculada);
      setStats({
        novosHoje: res.novosHoje, novos7d: res.novos7d,
        semCpf: res.semCpf, naoAbordados: res.naoAbordados,
      });
    } catch (e: any) {
      toast.error(e?.message ?? "Erro ao carregar promovidos.");
    } finally {
      setLoading(false);
    }
  }, [user, apenasNovos]);

  useEffect(() => { void carregar(); }, [carregar]);

  const carregarMais = async () => {
    setMore(true);
    try {
      const res = await fetchLeads({ data: { offset: rows.length, limit: PAGE, apenasNovos } });
      setRows((r) => [...r, ...res.rows]);
      setTotal(res.total);
    } catch (e: any) {
      toast.error(e?.message ?? "Erro ao carregar mais.");
    } finally {
      setMore(false);
    }
  };

  const abordar = async (id: string, status: PromovidoRecente["status_abordagem"]) => {
    setBusy(id);
    try {
      await abordagemFn({ data: { id, status: status as any } });
      setRows((r) => r.map((x) => (x.id === id ? { ...x, status_abordagem: status } : x)));
      toast.success("Situação atualizada.");
    } catch (e: any) {
      toast.error(e?.message ?? "Erro ao atualizar.");
    } finally {
      setBusy(null);
    }
  };

  const salvarCpf = async (id: string) => {
    const cpf = cpfDraft[id] ?? "";
    setBusy(id);
    try {
      const res = await confirmarCpf({ data: { id, cpf } });
      setRows((r) =>
        r.map((x) => (x.id === id ? { ...x, cpf_confirmado: res.cpf, cpf_validado_em: new Date().toISOString() } : x)),
      );
      toast.success("CPF confirmado e salvo no lead.");
    } catch (e: any) {
      toast.error(e?.message ?? "Erro ao salvar CPF.");
    } finally {
      setBusy(null);
    }
  };

  const distribuir = async () => {
    setBusy("dist");
    try {
      const res = await distribuirFn();
      toast.success(`${res.atribuidos} lead(s) distribuído(s) entre ${res.consultoras} consultora(s).`);
      void carregar();
    } catch (e: any) {
      toast.error(e?.message ?? "Erro ao distribuir.");
    } finally {
      setBusy(null);
    }
  };

  return (
    <AppShell>
      <div className="space-y-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="flex items-center gap-2 text-xl font-semibold">
              <PartyPopper className="h-5 w-5 text-primary" />
              Promovidos recentemente
            </h1>
            <p className="text-sm text-muted-foreground">
              Entrega automática do Radar Diário Oficial — últimos 15 dias.
              {consultoraNome ? ` Carteira de ${consultoraNome}.` : isAdmin ? " Visão de administrador (todas)." : ""}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={() => void carregar()} disabled={loading}>
              <RefreshCw className={`mr-2 h-4 w-4 ${loading ? "animate-spin" : ""}`} />
              Atualizar
            </Button>
            {isAdmin && (
              <Button size="sm" onClick={distribuir} disabled={busy === "dist"}>
                {busy === "dist" ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                Distribuir pendentes
              </Button>
            )}
            <Button asChild variant="ghost" size="sm">
              <Link to="/prospeccao">
                <ArrowLeft className="mr-2 h-4 w-4" />
                CRM
              </Link>
            </Button>
          </div>
        </div>

        <div className="grid gap-3 sm:grid-cols-4">
          <Stat label="Novos hoje" value={stats.novosHoje} />
          <Stat label="Últimos 7 dias" value={stats.novos7d} />
          <Stat label="Ainda não abordados" value={stats.naoAbordados} />
          <Stat label="Sem CPF confirmado" value={stats.semCpf} />
        </div>

        <Card className="border-primary/30 bg-primary/5 p-4">
          <h2 className="mb-1 flex items-center gap-2 text-sm font-semibold">
            <ShieldQuestion className="h-4 w-4 text-primary" />
            Sem CPF no Diário? Faça assim
          </h2>
          <ol className="ml-4 list-decimal space-y-1 text-sm text-muted-foreground">
            <li>Copie o <strong>nome completo</strong> do lead no botão de copiar do cartão.</li>
            <li>Pesquise esse nome no <strong>Congonhas</strong>.</li>
            <li>Compare os <strong>3 dígitos do CPF</strong> publicados no Diário com o resultado — precisam bater.</li>
            <li>Se houver homônimo, confirme pelo <strong>órgão e cargo</strong> antes de escolher.</li>
            <li>Salve o CPF completo no campo do cartão para marcar o lead como validado.</li>
          </ol>
        </Card>

        <div className="flex items-center gap-2">
          <Button variant={apenasNovos ? "default" : "outline"} size="sm" onClick={() => setApenasNovos((v) => !v)}>
            {apenasNovos ? "Mostrando só não abordados" : "Ver só não abordados"}
          </Button>
          <span className="text-xs text-muted-foreground">{total} lead(s) na janela</span>
        </div>

        {loading ? (
          <Card className="p-8 text-center text-sm text-muted-foreground">
            <Loader2 className="mx-auto mb-2 h-5 w-5 animate-spin" />
            Carregando…
          </Card>
        ) : !vinculada && !isAdmin ? (
          <Card className="p-6 text-sm text-muted-foreground">
            Sua conta ainda não foi vinculada como consultora. Assim que a distribuição automática rodar
            (a cada 10 minutos), seus leads aparecem aqui.
          </Card>
        ) : rows.length === 0 ? (
          <Card className="p-6 text-sm text-muted-foreground">
            Nenhum promovido nos últimos 15 dias na sua carteira.
          </Card>
        ) : (
          <div className="grid gap-3 lg:grid-cols-2">
            {rows.map((r) => {
              const u = urgencia(r.data_publicacao);
              const alto = String(r.potencial_financeiro ?? "").toLowerCase() === "alto";
              return (
                <Card key={r.id} className={`p-4 ${alto ? "border-emerald-500/40" : ""}`}>
                  <div className="mb-2 flex flex-wrap items-center gap-2">
                    <Badge variant="outline">{fmtData(r.data_publicacao)}</Badge>
                    <Badge className={u.cls}>{u.label}</Badge>
                    {alto && (
                      <Badge className="bg-emerald-500/15 text-emerald-600 dark:text-emerald-400">Alto potencial</Badge>
                    )}
                    <Badge variant="secondary">{STATUS_LABEL[r.status_abordagem] ?? r.status_abordagem}</Badge>
                    {r.cpf_confirmado ? (
                      <Badge className="bg-sky-500/15 text-sky-600 dark:text-sky-400">
                        <CheckCircle2 className="mr-1 h-3 w-3" /> CPF validado
                      </Badge>
                    ) : (
                      <Badge variant="outline" className="text-amber-600 dark:text-amber-400">
                        Validar CPF no Congonhas
                      </Badge>
                    )}
                  </div>

                  <div className="mb-1 flex items-start gap-2">
                    <p className="flex-1 font-medium leading-tight">{r.nome_servidor}</p>
                    <Button
                      size="icon"
                      variant="ghost"
                      title="Copiar nome completo"
                      onClick={() => {
                        void navigator.clipboard.writeText(r.nome_servidor);
                        toast.success("Nome copiado — pesquise no Congonhas.");
                      }}
                    >
                      <Copy className="h-4 w-4" />
                    </Button>
                  </div>

                  <div className="space-y-1 text-sm text-muted-foreground">
                    <p className="flex items-center gap-2">
                      <IdCard className="h-3.5 w-3.5" />
                      CPF: {r.cpf_confirmado ?? (r.cpf_parcial ? `***${r.cpf_parcial}**` : "não publicado")}
                    </p>
                    {r.orgao && (
                      <p className="flex items-center gap-2">
                        <Building2 className="h-3.5 w-3.5" />
                        {r.orgao}
                      </p>
                    )}
                    <p>
                      {(r.cargo_anterior || r.cargo) ?? "—"}
                      {r.cargo_novo ? ` → ${r.cargo_novo}` : ""}
                    </p>
                    {r.tipo_movimentacao && <p className="italic">{r.tipo_movimentacao}</p>}
                  </div>

                  {!r.cpf_confirmado && (
                    <div className="mt-3 flex items-center gap-2">
                      <Input
                        value={cpfDraft[r.id] ?? ""}
                        onChange={(e) => setCpfDraft((d) => ({ ...d, [r.id]: e.target.value }))}
                        placeholder="CPF completo confirmado"
                        className="h-9"
                      />
                      <Button size="sm" onClick={() => salvarCpf(r.id)} disabled={busy === r.id}>
                        Salvar
                      </Button>
                    </div>
                  )}

                  <div className="mt-3 flex flex-wrap items-center gap-2">
                    <Button size="sm" onClick={() => abordar(r.id, "contatado")} disabled={busy === r.id}>
                      ABORDAR
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => abordar(r.id, "proposta_enviada")} disabled={busy === r.id}>
                      Proposta enviada
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => abordar(r.id, "convertido")} disabled={busy === r.id}>
                      Convertido
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => abordar(r.id, "sem_interesse")} disabled={busy === r.id}>
                      Sem interesse
                    </Button>
                  </div>

                  <p className="mt-3 text-xs text-muted-foreground">
                    Roteiro: “Olá {r.nome_servidor.split(" ")[0]}, parabéns pela promoção publicada em{" "}
                    {fmtData(r.data_publicacao)}! Com o novo cargo sua margem aumentou — posso te mostrar as
                    condições disponíveis hoje?”
                  </p>
                </Card>
              );
            })}
          </div>
        )}

        {rows.length < total && (
          <div className="flex justify-center">
            <Button variant="outline" onClick={carregarMais} disabled={more}>
              {more ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Carregar mais
            </Button>
          </div>
        )}

        <p className="flex items-center gap-2 text-xs text-muted-foreground">
          <WhatsAppIcon className="h-3.5 w-3.5" />
          Fluxo sugerido: WhatsApp primeiro, depois ligação
          <Phone className="h-3.5 w-3.5" /> pelo app do computador, usando o número validado no Congonhas.
        </p>
      </div>
    </AppShell>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <Card className="p-4">
      <p className="text-xs uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="text-2xl font-semibold">{value}</p>
    </Card>
  );
}
