import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Trophy, Medal, FileText } from "lucide-react";
import { brl, colaboradores } from "@/lib/rh/mock";
import {
  producaoMesQueryOptions,
  mesesQueryOptions,
  mesAtual,
  formatMes,
} from "@/lib/rh/producao";

const medalCor = ["text-amber-500", "text-slate-400", "text-amber-700"];

const fotoDe = (nome: string) =>
  colaboradores.find((c) => c.nome === nome)?.foto;

export function ProducaoRanking({
  title = "Ranking de Produção",
  limit,
  defaultMes,
}: {
  title?: string;
  limit?: number;
  defaultMes?: string;
}) {
  const [mes, setMes] = useState(defaultMes ?? mesAtual());
  const { data: meses } = useQuery(mesesQueryOptions());
  const { data, isLoading } = useQuery(producaoMesQueryOptions(mes));

  const rows = limit ? (data ?? []).slice(0, limit) : data ?? [];
  const opcoes = meses && meses.length ? meses : [mesAtual()];

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between gap-2 pb-2">
        <CardTitle className="flex items-center gap-2 text-base">
          <Trophy className="h-4 w-4 text-amber-500" /> {title}
        </CardTitle>
        <Select value={mes} onValueChange={setMes}>
          <SelectTrigger className="h-8 w-[120px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {opcoes.map((m) => (
              <SelectItem key={m} value={m}>{formatMes(m)}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </CardHeader>
      <CardContent className="space-y-2">
        {isLoading ? (
          <p className="py-6 text-center text-sm text-muted-foreground">Carregando…</p>
        ) : rows.length === 0 ? (
          <p className="py-6 text-center text-sm text-muted-foreground">
            Nenhuma produção registrada em {formatMes(mes)}.
          </p>
        ) : (
          rows.map((r, i) => (
            <div key={r.id} className="flex items-center gap-3 rounded-lg border p-2">
              <span className="w-6 text-center font-bold text-muted-foreground">
                {i < 3 ? <Medal className={`mx-auto h-5 w-5 ${medalCor[i]}`} /> : i + 1}
              </span>
              <Avatar className="h-9 w-9">
                <AvatarImage src={fotoDe(r.consultora)} />
                <AvatarFallback>{r.consultora.slice(0, 2)}</AvatarFallback>
              </Avatar>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">{r.consultora}</p>
                <p className="truncate text-xs text-muted-foreground">{r.departamento ?? "—"}</p>
              </div>
              <Badge variant="secondary" className="hidden border-0 sm:inline-flex">
                <FileText className="mr-1 h-3 w-3" /> {r.contratos} contratos
              </Badge>
              <span className="font-semibold tabular-nums">{brl(r.valor)}</span>
            </div>
          ))
        )}
      </CardContent>
    </Card>
  );
}
