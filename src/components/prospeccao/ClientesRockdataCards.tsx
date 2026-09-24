import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { Calculator, MapPin, Phone, UserRound } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { listarClientesRockdata } from "@/lib/prospeccao/carteira-clientes.functions";

const ROTULO = { bancos: "Prévia AL", contracheque: "Contracheque GOV AL", banese: "Banese" };

export function ClientesRockdataCards() {
  const listar = useServerFn(listarClientesRockdata);
  const { data, isLoading } = useQuery({ queryKey: ["clientes-rockdata-carteira"], queryFn: () => listar(), refetchOnWindowFocus: false });
  if (isLoading) return <Skeleton className="mb-4 h-28 w-full" />;
  if (!data?.clientes.length) return null;
  return <section className="mb-6 space-y-3">
    <h2 className="flex items-center gap-2 text-sm font-semibold"><UserRound className="h-4 w-4 text-primary" />Clientes salvos da RockData ({data.clientes.length})</h2>
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{data.clientes.map((cliente) => {
      const calculos = data.calculos.filter((c) => c.leadId === cliente.id);
      return <Card key={cliente.id} className="space-y-2 p-4"><div className="flex items-start justify-between gap-2"><p className="font-semibold">{cliente.nome}</p><Badge variant="secondary">RockData</Badge></div><p className="text-xs text-muted-foreground">{cliente.cpf ?? "CPF não informado"}</p>{cliente.telefone && <p className="flex items-center gap-2 text-sm"><Phone className="h-3.5 w-3.5" />{cliente.telefone}</p>}{cliente.endereco && <p className="flex items-start gap-2 text-sm text-muted-foreground"><MapPin className="mt-0.5 h-3.5 w-3.5 shrink-0" />{cliente.endereco}</p>}<div className="border-t pt-2"><p className="flex items-center gap-1 text-xs font-medium"><Calculator className="h-3.5 w-3.5" />Cálculos salvos: {calculos.length}</p>{calculos.slice(0, 3).map((calculo) => <p key={calculo.id} className="mt-1 text-xs text-muted-foreground">{ROTULO[calculo.calculadora]} · {new Date(calculo.criadoEm).toLocaleDateString("pt-BR")}</p>)}</div></Card>;
    })}</div>
  </section>;
}