import type { LucideIcon } from "lucide-react";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";

type Props = {
  label: string;
  value: string | number;
  icon: LucideIcon;
  hint?: string;
  tone?: "default" | "emerald" | "amber" | "sky" | "rose" | "violet";
};

const tones: Record<NonNullable<Props["tone"]>, string> = {
  default: "bg-primary/10 text-primary",
  emerald: "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400",
  amber: "bg-amber-500/15 text-amber-600 dark:text-amber-400",
  sky: "bg-sky-500/15 text-sky-600 dark:text-sky-400",
  rose: "bg-rose-500/15 text-rose-600 dark:text-rose-400",
  violet: "bg-violet-500/15 text-violet-600 dark:text-violet-400",
};

export function RhStatCard({ label, value, icon: Icon, hint, tone = "default" }: Props) {
  return (
    <Card className="p-4 sm:p-5">
      <div className="flex items-start justify-between gap-2 sm:gap-3">
        <div className="min-w-0">
          <p className="text-xs leading-tight text-muted-foreground sm:text-sm">{label}</p>
          <p className="mt-1.5 text-2xl font-bold tracking-tight sm:mt-2 sm:text-3xl">{value}</p>
          {hint && <p className="mt-1 text-xs text-muted-foreground">{hint}</p>}
        </div>
        <span className={cn("flex h-10 w-10 shrink-0 items-center justify-center rounded-xl sm:h-11 sm:w-11", tones[tone])}>
          <Icon className="h-5 w-5" />
        </span>
      </div>
    </Card>
  );
}
