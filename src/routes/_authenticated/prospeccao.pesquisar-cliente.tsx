import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, Search, UserSearch, IdCard, Award, Users } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { buscarCliente } from "@/lib/prospeccao/busca-cliente.functions";
import { STATUS_LABEL, STATUS_TONE, type LeadStatus } from "@/lib/prospeccao/constants";


export const Route = createFileRoute("/_authenticated/prospeccao/pesquisar-cliente")({
  validateSearch: (search: Record<string, unknown>): { q: string } => ({
    q: typeof search.q === "string" ? search.q : "",
  }),
  head: () => ({
    meta: [
      { title: "Pesquisar cliente — CRM Prospecção" },
      { name: "description", content: "Localize um cliente por CPF ou nome nos leads, tomadores AL e recém promovidos." },
      { property: "og:title", content: "Pesquisar cliente — CRM Prospecção" },
      { property: "og:description", content: "Busca unificada de clientes por CPF ou nome nas bases da operação." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: PesquisarClientePage,
});

const BRL = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });
const money = (v: number | null) => (v != null ? BRL.format(v) : "—");

function PesquisarClientePage() {
  const { q } = Route.useSearch();
  const navigate = useNavigate({ from: "/prospeccao/pesquisar-cliente" });
  const [termo, setTermo] = useState(q);
  const fetchBusca = useServerFn(buscarCliente);

  const busca = useQuery({
    queryKey: ["prospect", "busca-cliente", q],
    queryFn: () => fetchBusca({ data: { termo: q } }),
    enabled: q.trim().length >= 3,
  });

  const aplicar = () => {
    navigate({ search: { q: termo.trim() } });
  };

  const r = busca.data;
  const totais = r ? r.leads.length + r.tomadores.length + r.promovidos.length : 0;

  return (
    <AppShell>
      <div className="mx-auto w-full max-w-5xl">
        <div className="mb-4 flex items-center gap-2">
          <Button asChild variant="ghost" size="sm">
            <Link to="/prospeccao"><ArrowLeft className="mr-2 h-4 w-4" /> Voltar</Link>
          </Button>
        </div>

        <h1 className="text-2xl font-bold">Pesquisar cliente</h1>
        <p className="mb-4 text-sm text-muted-foreground">
          Digite o CPF (com ou sem os zeros da frente) ou o nome — completo ou só o primeiro.
        </p>

        <Card className="mb-5 p-4">
          <div className="flex gap-2">
            <Input
              autoFocus
              placeholder="CPF ou nome…"
              value={termo}
              onChange={(e) => setTermo(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && aplicar()}
            />
            <Button onClick={aplicar} disabled={termo.trim().length < 3}>
              <Search className="mr-2 h-4 w-4" /> Buscar
            </Button>
          </div>
          {r && (
            <p className="mt-2 text-xs text-muted-foreground">
              Busca por {r.tipo === "cpf" ? `CPF ${r.cpfNormalizado}` : `nome “${r.termo}”`} · {totais} resultado(s)
            </p>
          )}
        </Card>

        {busca.isPending && q.trim().length >= 3 && (
          <div className="space-y-3">
            {[0, 1, 2].map((i) => <Skeleton key={i} className="h-24 w-full" />)}
          </div>
        )}

        {busca.isError && (
          <Card className="p-5 text-sm text-destructive">
            Não foi possível concluir a busca.{" "}
            <Button variant="link" size="sm" onClick={() => busca.refetch()}>Tentar novamente</Button>
          </Card>
        )}

        {r && totais === 0 && (
          <Card className="p-6 text-center text-sm text-muted-foreground">
            Nada encontrado nas bases de leads da prospecção, tomadores AL e recém promovidos.
          </Card>
        )}

        {r && r.leads.length > 0 && (
          <Grupo icon={<Users className="h-4 w-4" />} titulo="Leads da prospecção" qtd={r.leads.length} truncado={r.truncado.leads}>
            {r.leads.map((l) => (
              <div key={l.id} className="flex flex-wrap items-center justify-between gap-3 border-t px-4 py-3 first:border-t-0">
                <div className="min-w-0">
                  <p className="truncate font-semibold">{l.nome}</p>
                  <p className="text-xs text-muted-foreground">
                    {[l.cpf, l.telefone, l.cidade, l.situacao].filter(Boolean).join(" · ") || "—"}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Margem: {money(l.orcamento)} · Responsável: {l.responsavel ?? "sem responsável"}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant="outline" className={STATUS_TONE[l.status as LeadStatus]}>
                    {STATUS_LABEL[l.status as LeadStatus] ?? l.status}
                  </Badge>
                  <Button asChild size="sm" variant="secondary">
                    <Link to="/prospeccao/$leadId" params={{ leadId: l.id }}>Abrir</Link>
                  </Button>
                </div>
              </div>
            ))}
          </Grupo>
        )}

        {r && r.tomadores.length > 0 && (
          <Grupo icon={<IdCard className="h-4 w-4" />} titulo="Tomadores AL" qtd={r.tomadores.length} truncado={r.truncado.tomadores}>
            {r.tomadores.map((t) => (
              <div key={t.id} className="flex flex-wrap items-center justify-between gap-3 border-t px-4 py-3 first:border-t-0">
                <div className="min-w-0">
                  <p className="truncate font-semibold">{t.nome}</p>
                  <p className="text-xs text-muted-foreground">
                    {[t.documento, t.cargo, t.orgao].filter(Boolean).join(" · ")}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Empréstimo: {money(t.margemEmprestimo)} · Cartão: {money(t.margemCartao)} · Responsável: {t.responsavel ?? "sem responsável"}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  {t.status && <Badge variant="outline">{t.status}</Badge>}
                  <Button asChild size="sm" variant="secondary">
                    <Link to="/tomadores-al">Ver na base</Link>
                  </Button>
                </div>
              </div>
            ))}
          </Grupo>
        )}

        {r && r.promovidos.length > 0 && (
          <Grupo icon={<Award className="h-4 w-4" />} titulo="Recém promovidos" qtd={r.promovidos.length} truncado={r.truncado.promovidos}>
            {r.promovidos.map((p) => (
              <div key={p.id} className="flex flex-wrap items-center justify-between gap-3 border-t px-4 py-3 first:border-t-0">
                <div className="min-w-0">
                  <p className="truncate font-semibold">{p.nome}</p>
                  <p className="text-xs text-muted-foreground">
                    {[p.cargo, p.orgao, p.dataPromocao ? new Date(`${p.dataPromocao}T12:00:00`).toLocaleDateString("pt-BR") : null]
                      .filter(Boolean)
                      .join(" · ")}
                  </p>
                  <p className="text-xs text-muted-foreground">Responsável: {p.responsavel ?? "sem responsável"}</p>
                </div>
                <div className="flex items-center gap-2">
                  {p.status && <Badge variant="outline">{p.status}</Badge>}
                  <Button asChild size="sm" variant="secondary">
                    <Link to="/prospeccao/promovidos-recentes">Ver na lista</Link>
                  </Button>
                </div>
              </div>
            ))}
          </Grupo>
        )}

        {!q.trim() && (
          <Card className="flex flex-col items-center gap-2 p-8 text-center text-sm text-muted-foreground">
            <UserSearch className="h-6 w-6" />
            Comece digitando um CPF ou um nome acima.
          </Card>
        )}
      </div>
    </AppShell>
  );
}

function Grupo({
  icon, titulo, qtd, truncado, children,
}: { icon: React.ReactNode; titulo: string; qtd: number; truncado: boolean; children: React.ReactNode }) {
  return (
    <Card className="mb-4 overflow-hidden">
      <div className="flex items-center gap-2 border-b bg-muted/40 px-4 py-3">
        {icon}
        <p className="text-sm font-semibold">{titulo}</p>
        <Badge variant="secondary">{qtd}</Badge>
        {truncado && <span className="text-xs text-muted-foreground">mostrando os 50 primeiros</span>}
      </div>
      <div>{children}</div>
    </Card>
  );
}
