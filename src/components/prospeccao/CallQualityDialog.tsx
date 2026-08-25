import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import {
  Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { ScrollArea } from "@/components/ui/scroll-area";
import { getMyCallDetails } from "@/lib/prospeccao/prospeccao.functions";
import { cn } from "@/lib/utils";
import { PhoneIncoming, PhoneOff, ExternalLink, X } from "lucide-react";

export type CallQualityFilters = {
  days: number;
  date?: string;
  outcome?: string;
  answered: "all" | "yes" | "no";
  leadStatus?: string;
};

const STATUS = ["novo", "qualificado", "proposta", "ganho", "perdido"];

function dataHora(iso: string) {
  return new Date(iso).toLocaleString("pt-BR", {
    day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit",
  });
}

export function CallQualityDialog({
  open, onOpenChange, filters, onFiltersChange, outcomes,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  filters: CallQualityFilters;
  onFiltersChange: (f: CallQualityFilters) => void;
  outcomes: string[];
}) {
  const fetchDetails = useServerFn(getMyCallDetails);
  const [local, setLocal] = useState(filters);
  useEffect(() => { setLocal(filters); }, [filters]);

  const set = (patch: Partial<CallQualityFilters>) => {
    const next = { ...local, ...patch };
    setLocal(next);
    onFiltersChange(next);
  };

  const { data, isLoading } = useQuery({
    queryKey: ["my-call-details", local],
    queryFn: () => fetchDetails({
      data: {
        days: local.days,
        date: local.date,
        outcome: local.outcome,
        leadStatus: local.leadStatus,
        answered: local.answered,
      },
    }),
    enabled: open,
  });

  const rows = data ?? [];
  const atendidas = rows.filter((r) => r.answered).length;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle>Detalhe das ligações</DialogTitle>
          <DialogDescription>
            Leads que geraram suas taxas e resultados no período selecionado.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-wrap items-center gap-2">
          <Select value={String(local.days)} onValueChange={(v) => set({ days: Number(v), date: undefined })}>
            <SelectTrigger className="h-9 w-[150px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="1">Hoje</SelectItem>
              <SelectItem value="7">Últimos 7 dias</SelectItem>
              <SelectItem value="15">Últimos 15 dias</SelectItem>
              <SelectItem value="30">Últimos 30 dias</SelectItem>
            </SelectContent>
          </Select>

          <Select value={local.answered} onValueChange={(v) => set({ answered: v as CallQualityFilters["answered"] })}>
            <SelectTrigger className="h-9 w-[150px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Atendidas e não</SelectItem>
              <SelectItem value="yes">Só atendidas</SelectItem>
              <SelectItem value="no">Não atendidas</SelectItem>
            </SelectContent>
          </Select>

          <Select
            value={local.outcome ?? "__all"}
            onValueChange={(v) => set({ outcome: v === "__all" ? undefined : v })}
          >
            <SelectTrigger className="h-9 w-[180px]"><SelectValue placeholder="Resultado" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="__all">Todos os resultados</SelectItem>
              {outcomes.map((o) => <SelectItem key={o} value={o}>{o}</SelectItem>)}
            </SelectContent>
          </Select>

          <Select
            value={local.leadStatus ?? "__all"}
            onValueChange={(v) => set({ leadStatus: v === "__all" ? undefined : v })}
          >
            <SelectTrigger className="h-9 w-[160px]"><SelectValue placeholder="Status do lead" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="__all">Todos os status</SelectItem>
              {STATUS.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
            </SelectContent>
          </Select>

          {local.date && (
            <Button variant="secondary" size="sm" className="h-9 gap-1" onClick={() => set({ date: undefined })}>
              Dia {new Date(local.date + "T12:00:00").toLocaleDateString("pt-BR")} <X className="h-3 w-3" />
            </Button>
          )}
        </div>

        <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
          <span><strong className="text-foreground">{rows.length}</strong> ligações</span>
          <span><strong className="text-emerald-600 dark:text-emerald-400">{atendidas}</strong> atendidas</span>
          <span>
            taxa <strong className="text-sky-600 dark:text-sky-400">
              {rows.length ? Math.round((atendidas / rows.length) * 100) : 0}%
            </strong>
          </span>
        </div>

        {isLoading && <Skeleton className="h-56 w-full" />}

        {!isLoading && (
          <ScrollArea className="max-h-[52vh] pr-2">
            {rows.length === 0 && (
              <p className="py-8 text-center text-sm text-muted-foreground">
                Nenhuma ligação encontrada com esses filtros.
              </p>
            )}
            <ul className="space-y-2">
              {rows.map((r) => (
                <li key={r.eventId} className="rounded-lg border p-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className={cn(
                      "grid h-7 w-7 shrink-0 place-items-center rounded-lg",
                      r.answered
                        ? "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400"
                        : "bg-muted text-muted-foreground",
                    )}>
                      {r.answered ? <PhoneIncoming className="h-3.5 w-3.5" /> : <PhoneOff className="h-3.5 w-3.5" />}
                    </span>
                    <p className="min-w-0 flex-1 truncate text-sm font-semibold">{r.nome}</p>
                    <Badge variant="secondary" className="text-xs">{r.outcome}</Badge>
                    <Badge variant="outline" className="text-xs capitalize">{r.status}</Badge>
                    <span className="text-xs text-muted-foreground">{dataHora(r.createdAt)}</span>
                    <Button asChild size="sm" variant="ghost" className="h-7 gap-1 px-2 text-xs">
                      <Link to="/prospeccao/$leadId" params={{ leadId: r.leadId }}>
                        Abrir <ExternalLink className="h-3 w-3" />
                      </Link>
                    </Button>
                  </div>
                  {r.body && (
                    <p className="mt-1.5 line-clamp-2 text-xs text-muted-foreground">{r.body}</p>
                  )}
                </li>
              ))}
            </ul>
          </ScrollArea>
        )}
      </DialogContent>
    </Dialog>
  );
}
