// Linha do tempo do lead: ligações, whatsapps, notas, mudanças de status,
// reagendamentos e follow-ups. Usada no modal de qualidade e nos follow-ups.
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { getLeadTimeline } from "@/lib/prospeccao/prospeccao.functions";
import { cn } from "@/lib/utils";
import {
  Phone, MessageCircle, StickyNote, Flag, CalendarClock, Cog, CheckCircle2, XCircle,
} from "lucide-react";

const ICONS: Record<string, typeof Phone> = {
  ligacao: Phone,
  whatsapp: MessageCircle,
  nota: StickyNote,
  status: Flag,
  followup: CalendarClock,
  tarefa: CalendarClock,
  sistema: Cog,
};

const TONES: Record<string, string> = {
  ligacao: "bg-sky-500/15 text-sky-600 dark:text-sky-400",
  whatsapp: "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400",
  nota: "bg-muted text-muted-foreground",
  status: "bg-violet-500/15 text-violet-600 dark:text-violet-400",
  followup: "bg-amber-500/15 text-amber-600 dark:text-amber-400",
  tarefa: "bg-amber-500/15 text-amber-600 dark:text-amber-400",
  sistema: "bg-muted text-muted-foreground",
};

function quando(iso: string) {
  return new Date(iso).toLocaleString("pt-BR", {
    day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit",
  });
}

export function LeadTimeline({
  leadId, enabled = true, limit = 20, className,
}: {
  leadId: string;
  enabled?: boolean;
  limit?: number;
  className?: string;
}) {
  const fetchTimeline = useServerFn(getLeadTimeline);
  const { data, isLoading } = useQuery({
    queryKey: ["lead-timeline", leadId, limit],
    queryFn: () => fetchTimeline({ data: { leadId, limit } }),
    enabled,
    staleTime: 30_000,
  });

  if (isLoading) return <Skeleton className={cn("h-24 w-full", className)} />;

  const items = data ?? [];
  if (items.length === 0) {
    return (
      <p className={cn("text-xs text-muted-foreground", className)}>
        Nenhum histórico registrado para este lead.
      </p>
    );
  }

  return (
    <ol className={cn("relative space-y-2 border-l pl-4", className)}>
      {items.map((it) => {
        const Icon = it.status === "done"
          ? CheckCircle2
          : it.status === "canceled"
            ? XCircle
            : (ICONS[it.kind] ?? Cog);
        return (
          <li key={it.id} className="relative">
            <span
              className={cn(
                "absolute -left-[27px] grid h-5 w-5 place-items-center rounded-full ring-2 ring-background",
                TONES[it.kind] ?? "bg-muted text-muted-foreground",
              )}
            >
              <Icon className="h-3 w-3" />
            </span>
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="text-xs font-semibold">{it.title}</span>
              {it.source === "task" && it.status === "pending" && (
                <Badge variant="outline" className="text-[10px]">agendado</Badge>
              )}
              <span className="text-[11px] text-muted-foreground tabular-nums">{quando(it.at)}</span>
            </div>
            {it.body && (
              <p className="mt-0.5 line-clamp-2 text-[11px] text-muted-foreground">{it.body}</p>
            )}
          </li>
        );
      })}
    </ol>
  );
}
