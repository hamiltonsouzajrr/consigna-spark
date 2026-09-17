import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Inbox } from "lucide-react";
import { Card } from "@/components/ui/card";
import { chegaramParaMim } from "@/lib/prospeccao/chegaram.functions";
import { STATUS_LABEL, type LeadStatus } from "@/lib/prospeccao/constants";

// Mostra o que a administração entregou nas últimas 24 horas — inclusive
// clientes já trabalhados antes, que não aparecem na fila de "ainda não falei".
export function ChegaramParaVoce({ base = "crm" }: { base?: "crm" | "tomadores" | "promovidos" }) {
  const buscar = useServerFn(chegaramParaMim);
  const { data } = useQuery({
    queryKey: ["chegaram-para-mim"],
    queryFn: () => buscar({ data: { horas: 24 } }),
    refetchInterval: 120_000,
    staleTime: 60_000,
  });

  if (!data) return null;
  const total = base === "crm" ? data.crm : base === "tomadores" ? data.tomadores : data.promovidos;
  if (!total) return null;

  return (
    <Card className="mt-4 border-primary/30 bg-primary/5 p-4">
      <p className="flex items-center gap-2 text-sm font-semibold">
        <Inbox className="h-4 w-4" /> Chegaram para você nas últimas 24 horas: {total} cliente(s)
      </p>
      {base === "crm" && data.leads.length > 0 && (
        <ul className="mt-2 space-y-1 text-xs text-muted-foreground">
          {data.leads.map((l) => (
            <li key={l.id} className="truncate">
              {l.nome}
              {l.cidade ? ` · ${l.cidade}` : ""} ·{" "}
              {STATUS_LABEL[l.status as LeadStatus] ?? l.status}
            </li>
          ))}
        </ul>
      )}
      <p className="mt-2 text-xs text-muted-foreground">
        Alguns já foram atendidos antes, então podem não aparecer na fila — use a busca pelo nome ou
        CPF para abrir a ficha.
      </p>
    </Card>
  );
}
