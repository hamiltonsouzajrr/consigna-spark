// Dashboard por consultora (auto-atualizado): abordagem, conversão, follow-up e tempo ativo.
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Loader2, RefreshCw, Users, PhoneCall, Trophy, Timer } from "lucide-react";
import {
  getDashboardConsultoras,
  type DashboardConsultoras,
} from "@/lib/prospeccao/dashboard-consultoras.functions";

function fmtTempo(seg: number) {
  const h = Math.floor(seg / 3600);
  const m = Math.floor((seg % 3600) / 60);
  return h > 0 ? `${h}h ${m}min` : `${m}min`;
}

export function DashboardConsultorasPanel() {
  const fetchDados = useServerFn(getDashboardConsultoras);
  const [dados, setDados] = useState<DashboardConsultoras | null>(null);
  const [carregando, setCarregando] = useState(true);

  useEffect(() => {
    let cancelado = false;
    const carregar = () => {
      fetchDados()
        .then((r) => { if (!cancelado) setDados(r); })
        .catch(() => { if (!cancelado) setDados(null); })
        .finally(() => { if (!cancelado) setCarregando(false); });
    };
    carregar();
    const id = setInterval(carregar, 60000);
    return () => { cancelado = true; clearInterval(id); };
  }, [fetchDados]);

  const t = dados?.totais;

  return (
    <Card className="p-4">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="text-lg font-semibold">Dashboard por consultora</h2>
          <p className="text-xs text-muted-foreground">
            Últimos {dados?.periodoDias ?? 30} dias · atualiza automaticamente a cada 60s
            {dados ? ` · ${new Date(dados.atualizadoEm).toLocaleTimeString("pt-BR")}` : ""}
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => { setCarregando(true); fetchDados().then(setDados).catch(() => {}).finally(() => setCarregando(false)); }}
          disabled={carregando}
        >
          {carregando ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <RefreshCw className="mr-2 h-4 w-4" />}
          Atualizar
        </Button>
      </div>

      {t && (
        <div className="mb-4 grid grid-cols-2 gap-3 md:grid-cols-4">
          <div className="rounded-lg border bg-muted/30 p-3">
            <div className="flex items-center gap-2 text-xs text-muted-foreground"><Users className="h-3.5 w-3.5" /> Consultoras</div>
            <div className="text-xl font-bold">{t.consultoras}</div>
          </div>
          <div className="rounded-lg border bg-muted/30 p-3">
            <div className="flex items-center gap-2 text-xs text-muted-foreground"><PhoneCall className="h-3.5 w-3.5" /> Abordados / contatos</div>
            <div className="text-xl font-bold">{t.abordados} / {t.contatos}</div>
          </div>
          <div className="rounded-lg border bg-muted/30 p-3">
            <div className="flex items-center gap-2 text-xs text-muted-foreground"><Trophy className="h-3.5 w-3.5" /> Conversões</div>
            <div className="text-xl font-bold">{t.ganhos}</div>
          </div>
          <div className="rounded-lg border bg-muted/30 p-3">
            <div className="flex items-center gap-2 text-xs text-muted-foreground"><Timer className="h-3.5 w-3.5" /> Tempo ativo total</div>
            <div className="text-xl font-bold">{fmtTempo(t.tempoAtivoSegundos)}</div>
          </div>
        </div>
      )}

      {carregando && !dados ? (
        <div className="flex items-center gap-2 py-8 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" /> Carregando indicadores…
        </div>
      ) : !dados || dados.linhas.length === 0 ? (
        <p className="py-6 text-sm text-muted-foreground">Nenhum indicador disponível ainda.</p>
      ) : (
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Consultora</TableHead>
                <TableHead className="text-right">Leads</TableHead>
                <TableHead className="text-right">Abordados</TableHead>
                <TableHead className="text-right">Contatos</TableHead>
                <TableHead className="text-right">Conversões</TableHead>
                <TableHead className="text-right">Follow-ups</TableHead>
                <TableHead className="text-right">Tempo ativo</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {dados.linhas.map((l) => (
                <TableRow key={l.nome}>
                  <TableCell className="font-medium">{l.nome}</TableCell>
                  <TableCell className="text-right">{l.leads}</TableCell>
                  <TableCell className="text-right">
                    {l.abordados} <span className="text-xs text-muted-foreground">({l.taxaAbordagem}%)</span>
                  </TableCell>
                  <TableCell className="text-right">
                    {l.contatos}
                    <span className="ml-1 text-xs text-muted-foreground">
                      {l.ligacoes}☎ / {l.whatsapp}💬
                    </span>
                  </TableCell>
                  <TableCell className="text-right">
                    {l.ganhos} <span className="text-xs text-muted-foreground">({l.taxaConversao}%)</span>
                  </TableCell>
                  <TableCell className="text-right">
                    {l.followupsAbertos} abertos
                    {l.followupsAtrasados > 0 && (
                      <Badge variant="destructive" className="ml-2">{l.followupsAtrasados} atrasados</Badge>
                    )}
                  </TableCell>
                  <TableCell className="text-right">
                    {fmtTempo(l.tempoAtivoSegundos)}
                    <div className="text-xs text-muted-foreground">hoje {fmtTempo(l.tempoAtivoHojeSegundos)}</div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </Card>
  );
}
