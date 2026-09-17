import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Progress } from "@/components/ui/progress";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { RefreshCw, Database, CheckCircle2, Clock, Users, Layers, TrendingUp } from "lucide-react";
import { getPainelResumo } from "@/lib/prospeccao/dashboard-admin.functions";
import { STATUS_LABEL } from "@/lib/prospeccao/constants";
import type { LeadStatus } from "@/lib/prospeccao/constants";

const nf = new Intl.NumberFormat("pt-BR");
const brl = (v: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 }).format(v);

function Numero({
  label,
  value,
  hint,
  tone,
}: {
  label: string;
  value: string | number;
  hint?: string;
  tone?: string;
}) {
  return (
    <div className="rounded-lg border bg-card p-3">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className={`text-2xl font-bold tabular-nums ${tone ?? ""}`}>
        {typeof value === "number" ? nf.format(value) : value}
      </p>
      {hint && <p className="mt-0.5 text-[11px] text-muted-foreground">{hint}</p>}
    </div>
  );
}

function Bloco({
  titulo, descricao, icon: Icon, children,
}: {
  titulo: string;
  descricao: string;
  icon: typeof Database;
  children: React.ReactNode;
}) {
  return (
    <Card className="p-4">
      <div className="mb-3 flex items-start gap-2">
        <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-primary/10 text-primary">
          <Icon className="h-4.5 w-4.5" />
        </span>
        <div className="min-w-0">
          <p className="text-sm font-semibold">{titulo}</p>
          <p className="text-xs text-muted-foreground">{descricao}</p>
        </div>
      </div>
      {children}
    </Card>
  );
}

export function ResumoGeralTab() {
  const fetchResumo = useServerFn(getPainelResumo);
  const q = useQuery({
    queryKey: ["prospect", "painel-resumo"],
    queryFn: () => fetchResumo(),
    // Fiscalização ao vivo: atualiza sozinho a cada 15s e sempre que a tela
    // volta ao foco, sem depender de nenhuma ação manual.
    refetchInterval: 15_000,
    refetchIntervalInBackground: false,
    refetchOnWindowFocus: true,
    placeholderData: (prev) => prev,
  });

  const r = q.data;

  const statusRows = useMemo(
    () => Object.entries(r?.por_status ?? {}).sort((a, b) => b[1] - a[1]),
    [r],
  );
  const maxStatus = statusRows[0]?.[1] ?? 1;

  if (q.isPending) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-28 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  if (q.isError || !r) {
    return (
      <Card className="p-4">
        <p className="text-sm text-muted-foreground">
          Não foi possível carregar o resumo agora.
        </p>
        <Button className="mt-3" size="sm" variant="outline" onClick={() => q.refetch()}>
          <RefreshCw className="mr-2 h-4 w-4" /> Tentar de novo
        </Button>
      </Card>
    );
  }

  // Totais somando as três bases (CRM, Tomadores AL e recém-promovidos).
  const entregues = r.crm.atribuidos + r.tomadores.atribuidos + r.promovidos.atribuidos;
  const trabalhados = r.crm.trabalhados + r.tomadores.trabalhados + r.promovidos.contatados;
  const vendidos = r.crm.ganhos + r.tomadores.convertidos;

  const usoCrm = r.crm.total ? Math.round((r.crm.trabalhados / r.crm.total) * 100) : 0;
  const usoTomadores = r.tomadores.total
    ? Math.round((r.tomadores.trabalhados / r.tomadores.total) * 100)
    : 0;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <span className="relative grid h-2 w-2 place-items-center">
            <span className="absolute h-2 w-2 animate-ping rounded-full bg-emerald-500/70" />
            <span className="h-2 w-2 rounded-full bg-emerald-500" />
          </span>
          Ao vivo: números exatos de toda a base, atualizados sozinhos a cada 15 segundos.
        </p>
        <Button size="sm" variant="outline" onClick={() => q.refetch()} disabled={q.isFetching}>
          <RefreshCw className={`mr-2 h-4 w-4 ${q.isFetching ? "animate-spin" : ""}`} /> Atualizar
        </Button>
      </div>

      <Bloco
        titulo="Acompanhamento ao vivo"
        descricao="Somando CRM, Tomadores AL e recém-promovidos, sem precisar de entrega manual."
        icon={TrendingUp}
      >
        <div className="grid grid-cols-3 gap-2">
          <Numero label="Entregues às consultoras" value={entregues} />
          <Numero
            label="Já trabalhados"
            value={trabalhados}
            tone="text-emerald-600 dark:text-emerald-400"
            hint={entregues ? `${Math.round((trabalhados / entregues) * 100)}% do que foi entregue` : undefined}
          />
          <Numero
            label="Vendidos (fechados)"
            value={vendidos}
            tone="text-emerald-600 dark:text-emerald-400"
            hint={trabalhados ? `${Math.round((vendidos / trabalhados) * 100)}% dos trabalhados` : undefined}
          />
        </div>
      </Bloco>

      <Bloco
        titulo="Clientes do CRM (prospecção)"
        descricao="Tudo que já entrou no sistema e quanto já foi usado."
        icon={Database}
      >
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
          <Numero label="Cadastrados no sistema" value={r.crm.total} />
          <Numero label="Já trabalhados" value={r.crm.trabalhados} tone="text-emerald-600 dark:text-emerald-400"
            hint={`${usoCrm}% da base`} />
          <Numero label="Nunca abordados" value={r.crm.nao_trabalhados} tone="text-amber-600 dark:text-amber-400" />
          <Numero label="Com consultora" value={r.crm.atribuidos} />
          <Numero label="Sem responsável" value={r.crm.sem_responsavel} />
          <Numero label="Ainda em aberto" value={r.crm.em_aberto} />
        </div>

        <div className="mt-3 space-y-1">
          <div className="flex items-center justify-between text-xs">
            <span className="text-muted-foreground">Base já utilizada</span>
            <span className="font-medium tabular-nums">{usoCrm}%</span>
          </div>
          <Progress value={usoCrm} className="h-2" />
        </div>

        <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
          <Numero label="Fechou (venda)" value={r.crm.ganhos} tone="text-emerald-600 dark:text-emerald-400" />
          <Numero label="Não quer agora" value={r.crm.perdidos} />
          <Numero label="Falados hoje" value={r.crm.contatados_hoje} />
          <Numero label="Falados em 7 dias" value={r.crm.contatados_7d} />
          <Numero label="Parados há 3+ dias" value={r.crm.esquecidos_3d} tone="text-rose-600 dark:text-rose-400" />
          <Numero label="Com telefone válido" value={r.crm.com_telefone} />
        </div>

        <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
          <Numero label="Adicionados em 7 dias" value={r.crm.adicionados_7d} />
          <Numero label="Adicionados em 30 dias" value={r.crm.adicionados_30d} />
          <Numero label="Vendas registradas" value={r.vendas.total} />
          <Numero label="Valor liberado (total)" value={brl(Number(r.vendas.valor_total ?? 0))}
            hint={`${nf.format(r.vendas.semana)} nesta semana`} />
        </div>

        <div className="mt-4 space-y-1.5">
          <p className="text-xs text-muted-foreground">O que aconteceu com cada cliente</p>
          {statusRows.map(([status, total]) => (
            <div key={status} className="flex items-center gap-2 text-xs">
              <span className="w-40 shrink-0 truncate text-muted-foreground">
                {STATUS_LABEL[status as LeadStatus] ?? status}
              </span>
              <div className="h-2 flex-1 overflow-hidden rounded-full bg-muted">
                <div className="h-full rounded-full bg-primary/70"
                  style={{ width: `${Math.round((total / maxStatus) * 100)}%` }} />
              </div>
              <span className="w-16 shrink-0 text-right tabular-nums">{nf.format(total)}</span>
            </div>
          ))}
        </div>
      </Bloco>

      <div className="grid gap-4 lg:grid-cols-2">
        <Bloco titulo="Tomadores AL" descricao="Estoque de tomadores e quanto já foi consumido." icon={CheckCircle2}>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            <Numero label="Cadastrados" value={r.tomadores.total} />
            <Numero label="Já trabalhados" value={r.tomadores.trabalhados}
              tone="text-emerald-600 dark:text-emerald-400" hint={`${usoTomadores}% da base`} />
            <Numero label="Livres no estoque" value={r.tomadores.livres}
              tone={r.tomadores.livres < 100 ? "text-rose-600 dark:text-rose-400" : undefined} />
            <Numero label="Nas carteiras" value={r.tomadores.atribuidos} />
            <Numero label="Fecharam venda" value={r.tomadores.convertidos} />
            <Numero label="Sem interesse" value={r.tomadores.sem_interesse} />
          </div>
          <div className="mt-3 space-y-1">
            <div className="flex items-center justify-between text-xs">
              <span className="text-muted-foreground">Base já utilizada</span>
              <span className="font-medium tabular-nums">{usoTomadores}%</span>
            </div>
            <Progress value={usoTomadores} className="h-2" />
          </div>
        </Bloco>

        <Bloco titulo="Recém-promovidos (Radar)" descricao="Publicações do Diário Oficial já entregues." icon={TrendingUp}>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            <Numero label="Cadastrados" value={r.promovidos.total} />
            <Numero label="Nas carteiras" value={r.promovidos.atribuidos} />
            <Numero label="Sem responsável" value={r.promovidos.livres} />
            <Numero label="Já contatados" value={r.promovidos.contatados}
              tone="text-emerald-600 dark:text-emerald-400" />
            <Numero label="Últimos 15 dias" value={r.promovidos.ultimos_15d} />
          </div>
        </Bloco>
      </div>

      <Bloco titulo="Por lote de importação" descricao="Quanto entrou em cada planilha e quanto já foi usado." icon={Layers}>
        <div className="max-h-72 overflow-auto rounded-md border">
          <Table>
            <TableHeader className="sticky top-0 bg-muted/60">
              <TableRow>
                <TableHead>Lote</TableHead>
                <TableHead className="text-right">Entraram</TableHead>
                <TableHead className="text-right">Trabalhados</TableHead>
                <TableHead className="text-right">Sobraram</TableHead>
                <TableHead className="text-right">Último cadastro</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {r.lotes.map((l) => (
                <TableRow key={l.lote}>
                  <TableCell className="max-w-[150px] truncate sm:max-w-[280px]">{l.lote}</TableCell>
                  <TableCell className="text-right tabular-nums">{nf.format(l.total)}</TableCell>
                  <TableCell className="text-right tabular-nums">{nf.format(l.trabalhados)}</TableCell>
                  <TableCell className="text-right tabular-nums">{nf.format(l.total - l.trabalhados)}</TableCell>
                  <TableCell className="text-right text-xs text-muted-foreground">
                    {l.ultimo_em ? new Date(l.ultimo_em).toLocaleDateString("pt-BR") : "—"}
                  </TableCell>
                </TableRow>
              ))}
              {!r.lotes.length && (
                <TableRow>
                  <TableCell colSpan={5} className="text-center text-sm text-muted-foreground">
                    Nenhuma importação registrada.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      </Bloco>

      <Bloco titulo="Uso por consultora" descricao="Quantos clientes cada uma recebeu e quantos já trabalhou." icon={Users}>
        <div className="max-h-96 overflow-auto rounded-md border">
          <Table>
            <TableHeader className="sticky top-0 bg-muted/60">
              <TableRow>
                <TableHead>Consultora</TableHead>
                <TableHead className="text-right">Recebeu</TableHead>
                <TableHead className="text-right">Trabalhou</TableHead>
                <TableHead className="text-right">Em aberto</TableHead>
                <TableHead className="text-right">Vendas</TableHead>
                <TableHead className="text-right">Aproveitou</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {r.consultoras.map((c) => (
                <TableRow key={c.consultant_id}>
                  <TableCell className="max-w-[140px] truncate sm:max-w-[260px]">
                    {c.email || c.nome}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">{nf.format(c.recebidos)}</TableCell>
                  <TableCell className="text-right tabular-nums">{nf.format(c.trabalhados)}</TableCell>
                  <TableCell className="text-right tabular-nums">{nf.format(c.em_aberto)}</TableCell>
                  <TableCell className="text-right tabular-nums">{nf.format(c.ganhos)}</TableCell>
                  <TableCell className="text-right tabular-nums">
                    {c.recebidos ? Math.round((c.trabalhados / c.recebidos) * 100) : 0}%
                  </TableCell>
                </TableRow>
              ))}
              {!r.consultoras.length && (
                <TableRow>
                  <TableCell colSpan={6} className="text-center text-sm text-muted-foreground">
                    Nenhuma consultora com clientes.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      </Bloco>

      <p className="flex items-center gap-1 text-[11px] text-muted-foreground">
        <Clock className="h-3 w-3" /> Números gerados em{" "}
        {new Date(r.gerado_em).toLocaleString("pt-BR")}
        {q.isFetching && " · atualizando…"}
      </p>
    </div>
  );
}
