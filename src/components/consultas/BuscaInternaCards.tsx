import { MapPin, Phone, UserRound, WalletCards } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PRAZO_EMPRESTIMO_PADRAO, valorLiberado } from "@/lib/prospeccao/coeficientes";
import type { BuscaClienteResultado, ClienteBusca } from "@/lib/prospeccao/busca-cliente.functions";

const BRL = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });

export function BuscaInternaCards({ resultado, onPlus }: { resultado: BuscaClienteResultado; onPlus: (cliente: ClienteBusca) => void }) {
  if (!resultado.resultados.length) return <Card><CardContent className="py-8 text-center text-sm text-muted-foreground">Nenhum cliente encontrado nas bases internas.</CardContent></Card>;
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm font-medium">{resultado.resultados.length} cliente(s) encontrado(s) no sistema</p>
        {resultado.truncado && <Badge variant="secondary">Mostrando os 50 primeiros</Badge>}
      </div>
      {resultado.resultados.map((cliente) => <ClienteCard key={cliente.chave} cliente={cliente} onPlus={onPlus} />)}
    </div>
  );
}

function ClienteCard({ cliente, onPlus }: { cliente: ClienteBusca; onPlus: (cliente: ClienteBusca) => void }) {
  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0">
            <CardTitle className="flex items-center gap-2 text-base"><UserRound className="h-4 w-4" />{cliente.nome}</CardTitle>
            <p className="mt-1 text-sm text-muted-foreground">{cliente.cpf ?? "CPF não disponível"}</p>
          </div>
          <div className="flex flex-wrap gap-1">{cliente.origens.map((origem) => <Badge key={origem} variant="secondary">{origem}</Badge>)}</div>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="grid gap-2 text-sm sm:grid-cols-2">
          <p className="flex items-start gap-2"><Phone className="mt-0.5 h-4 w-4 text-muted-foreground" /><span>{cliente.telefones.join(" · ") || "Telefone não informado"}</span></p>
          <p className="flex items-start gap-2"><MapPin className="mt-0.5 h-4 w-4 text-muted-foreground" /><span>{cliente.endereco ?? "Endereço não informado"}</span></p>
          <p><span className="text-muted-foreground">Responsável:</span> {cliente.responsavel ?? "Sem responsável"}</p>
          <p><span className="text-muted-foreground">Situação:</span> {cliente.situacao ?? "Não informada"}</p>
        </div>
        {cliente.margens.some((m) => m.valor != null) && (
          <div className="grid gap-2 border-t pt-3 sm:grid-cols-3">
            {cliente.margens.filter((m) => m.valor != null).map((m, index) => (
              <div key={`${m.tipo}-${index}`} className="rounded-md bg-muted/50 p-2">
                <p className="flex items-center gap-1 text-xs text-muted-foreground"><WalletCards className="h-3 w-3" />{m.tipo}</p>
                <p className="font-semibold">{BRL.format(m.valor ?? 0)}</p>
                <p className="text-xs text-muted-foreground">Estimativa: {BRL.format(valorLiberado(m.valor, PRAZO_EMPRESTIMO_PADRAO) ?? 0)}</p>
              </div>
            ))}
          </div>
        )}
        <div className="flex justify-end border-t pt-3">
          <Button size="sm" variant="outline" disabled={!cliente.cpf} onClick={() => onPlus(cliente)}>Busca Plus RockData</Button>
        </div>
      </CardContent>
    </Card>
  );
}