// Cards dos clientes que vieram das planilhas de produção (esteira).
// Aparecem na carteira da consultora, com a próxima ligação de amortização.
import { useMemo } from "react";
import { Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { PiggyBank, Phone } from "lucide-react";
import { esteiraListar } from "@/lib/prospeccao/esteira.functions";

const BRL = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });
const fmtData = (v: string | null) => (v ? new Date(`${v.slice(0, 10)}T12:00:00`).toLocaleDateString("pt-BR") : "—");
const hojeISO = () => new Date(Date.now() - 3 * 3600_000).toISOString().slice(0, 10);

export function ClientesPlanilhaCards({ limite = 6 }: { limite?: number }) {
  const listar = useServerFn(esteiraListar);
  const { data, isLoading } = useQuery({
    queryKey: ["esteira", "carteira-cards"],
    queryFn: () => listar({ data: { somenteAtivos: true, limit: 300 } }),
    refetchOnWindowFocus: false,
  });

  const hoje = hojeISO();
  const itens = useMemo(() => {
    const rows = data ?? [];
    return [...rows].sort((a, b) => (a.proximo_contato_em ?? "9999").localeCompare(b.proximo_contato_em ?? "9999"));
  }, [data]);

  if (isLoading) return <Skeleton className="mb-4 h-28 w-full" />;
  if (!itens.length) return null;

  const paraHoje = itens.filter((c) => c.proximo_contato_em && c.proximo_contato_em <= hoje).length;

  return (
    <section className="mb-6 space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="flex items-center gap-2 text-sm font-semibold">
          <PiggyBank className="h-4 w-4 text-primary" /> Clientes das planilhas ({itens.length})
          {paraHoje > 0 && (
            <Badge variant="secondary" className="border-0 bg-amber-100 text-amber-800">
              {paraHoje} para ligar hoje
            </Badge>
          )}
        </h2>
        <Button asChild size="sm" variant="outline">
          <Link to="/prospeccao/amortizacao">Ver todos</Link>
        </Button>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {itens.slice(0, limite).map((c) => {
          const atrasado = !!c.proximo_contato_em && c.proximo_contato_em < hoje;
          const ehHoje = c.proximo_contato_em === hoje;
          return (
            <Card key={c.id} className="space-y-2 p-4">
              <div className="flex items-start justify-between gap-2">
                <p className="min-w-0 truncate font-medium">{c.nome}</p>
                {(atrasado || ehHoje) && (
                  <Badge
                    variant="secondary"
                    className={`border-0 ${atrasado ? "bg-rose-100 text-rose-700" : "bg-amber-100 text-amber-800"}`}
                  >
                    {atrasado ? "atrasado" : "hoje"}
                  </Badge>
                )}
              </div>
              {[c.banco, c.prazo ? `${c.prazo}x` : null, c.valor_bruto != null ? BRL.format(c.valor_bruto) : null]
                .filter(Boolean)
                .join(" · ") && (
                <p className="truncate text-xs text-muted-foreground">
                  {[c.banco, c.prazo ? `${c.prazo}x` : null, c.valor_bruto != null ? BRL.format(c.valor_bruto) : null]
                    .filter(Boolean)
                    .join(" · ")}
                </p>
              )}
              <p className="text-xs text-muted-foreground">
                Ligar todo dia {c.dia_amortizacao} · próxima {fmtData(c.proximo_contato_em)}
              </p>
              <p className="text-xs text-muted-foreground">
                Margem usada:{" "}
                {c.margem_usada != null ? BRL.format(c.margem_usada) : "consultar no app do servidor"}
                <br />
                Resta:{" "}
                {c.margem_restante_valor != null
                  ? BRL.format(c.margem_restante_valor)
                  : "consultar no app do servidor"}
              </p>
              <div className="flex items-center gap-2 pt-1">
                {c.telefone && (
                  <Button asChild size="sm" variant="outline">
                    <a href={`tel:${c.telefone.replace(/\D/g, "")}`}>
                      <Phone className="mr-1.5 h-3.5 w-3.5" /> Ligar
                    </a>
                  </Button>
                )}
                <Button asChild size="sm" variant="ghost">
                  <Link to="/prospeccao/amortizacao">Registrar contato</Link>
                </Button>
              </div>
            </Card>
          );
        })}
      </div>
    </section>
  );
}
