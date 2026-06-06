import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import {
  Plus, User, Search, SlidersHorizontal, MoreHorizontal, Briefcase,
  Building2, Code2, HeartHandshake, Users, UserCheck, Loader2, Trophy,
} from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { RhPageHeader } from "@/components/rh/RhLayout";
import { candidatos, vagas, type Candidato } from "@/lib/rh/mock";

export const Route = createFileRoute("/rh/recrutamento")({
  component: Recrutamento,
});

const etapas: Candidato["etapa"][] = ["Triagem", "Entrevista", "Teste", "Proposta", "Contratado"];

// Cor por etapa (barra do topo das colunas)
const etapaColor: Record<Candidato["etapa"], string> = {
  Triagem: "bg-blue-500",
  Entrevista: "bg-emerald-500",
  Teste: "bg-amber-500",
  Proposta: "bg-violet-500",
  Contratado: "bg-emerald-500",
};

// Estilo por área da vaga
const areaStyle: Record<string, { icon: typeof Briefcase; cls: string }> = {
  Comercial: { icon: Building2, cls: "bg-blue-500/10 text-blue-600 dark:text-blue-400" },
  Tecnologia: { icon: Code2, cls: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400" },
  "Recursos Humanos": { icon: HeartHandshake, cls: "bg-violet-500/10 text-violet-600 dark:text-violet-400" },
};

function areaFor(dep: string) {
  return areaStyle[dep] ?? { icon: Briefcase, cls: "bg-primary/10 text-primary" };
}

// Tags simuladas determinísticas por candidato
function tagsFor(c: Candidato): { label: string; cls: string }[] {
  const t: { label: string; cls: string }[] = [];
  const seed = c.id.charCodeAt(c.id.length - 1);
  if (c.etapa === "Triagem") t.push({ label: "Novo", cls: "bg-blue-500/10 text-blue-600 dark:text-blue-400" });
  if (seed % 2 === 0) t.push({ label: "Alta prioridade", cls: "bg-rose-500/10 text-rose-600 dark:text-rose-400" });
  t.push({ label: `Fit ${70 + (seed % 30)}%`, cls: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400" });
  return t;
}

function initials(name: string) {
  return name.split(" ").map((p) => p[0]).slice(0, 2).join("").toUpperCase();
}

function KpiCard({
  label, value, icon: Icon, cls,
}: { label: string; value: string | number; icon: typeof Users; cls: string }) {
  return (
    <Card className="flex items-center gap-4 rounded-2xl border-border/60 p-4 shadow-sm">
      <span className={cn("flex h-11 w-11 shrink-0 items-center justify-center rounded-xl", cls)}>
        <Icon className="h-5 w-5" />
      </span>
      <div className="min-w-0">
        <p className="text-2xl font-bold tracking-tight">{value}</p>
        <p className="truncate text-xs text-muted-foreground">{label}</p>
      </div>
    </Card>
  );
}

function Recrutamento() {
  const [busca, setBusca] = useState("");
  const [vagaFiltro, setVagaFiltro] = useState("all");
  const [statusFiltro, setStatusFiltro] = useState("all");

  const filtrados = useMemo(() => {
    return candidatos.filter((c) => {
      if (busca && !c.nome.toLowerCase().includes(busca.toLowerCase())) return false;
      if (vagaFiltro !== "all" && c.vaga !== vagaFiltro) return false;
      if (statusFiltro !== "all" && c.etapa !== statusFiltro) return false;
      return true;
    });
  }, [busca, vagaFiltro, statusFiltro]);

  const totalCandidatos = candidatos.length;
  const emAndamento = candidatos.filter((c) => c.etapa !== "Contratado").length;
  const contratados = candidatos.filter((c) => c.etapa === "Contratado").length;

  return (
    <div className="animate-fade-in space-y-6">
      <RhPageHeader
        title="Recrutamento"
        description="Pipeline do processo seletivo."
        actions={
          <Button
            size="sm"
            onClick={() => toast.info("Nova vaga (demonstração)")}
            className="bg-gradient-to-r from-primary to-blue-500 shadow-md shadow-primary/25 transition-all duration-200 hover:shadow-lg hover:shadow-primary/40 active:scale-[0.98]"
          >
            <Plus className="mr-2 h-4 w-4" /> Nova Vaga
          </Button>
        }
      />

      {/* KPIs */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <KpiCard label="Vagas abertas" value={vagas.length} icon={Briefcase} cls="bg-blue-500/10 text-blue-600 dark:text-blue-400" />
        <KpiCard label="Total de candidatos" value={totalCandidatos} icon={Users} cls="bg-violet-500/10 text-violet-600 dark:text-violet-400" />
        <KpiCard label="Em andamento" value={emAndamento} icon={Loader2} cls="bg-amber-500/10 text-amber-600 dark:text-amber-400" />
        <KpiCard label="Contratações no mês" value={contratados} icon={Trophy} cls="bg-emerald-500/10 text-emerald-600 dark:text-emerald-400" />
      </div>

      {/* Cards de vagas premium */}
      <div className="grid gap-4 sm:grid-cols-3">
        {vagas.map((v) => {
          const { icon: Icon, cls } = areaFor(v.departamento);
          return (
            <Card
              key={v.id}
              className="group rounded-2xl border-border/60 p-5 shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:shadow-lg"
            >
              <div className="flex items-start justify-between gap-3">
                <span className={cn("flex h-11 w-11 items-center justify-center rounded-xl", cls)}>
                  <Icon className="h-5 w-5" />
                </span>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground transition-colors hover:text-foreground">
                      <MoreHorizontal className="h-4 w-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem onClick={() => toast.info("Ver vaga (demonstração)")}>Ver vaga</DropdownMenuItem>
                    <DropdownMenuItem onClick={() => toast.info("Editar (demonstração)")}>Editar</DropdownMenuItem>
                    <DropdownMenuItem onClick={() => toast.info("Encerrar (demonstração)")}>Encerrar</DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
              <p className="mt-4 font-semibold">{v.titulo}</p>
              <p className="text-xs text-muted-foreground">{v.departamento}</p>
              <div className="mt-3 flex items-baseline gap-1.5">
                <span className="text-2xl font-bold tracking-tight">{v.candidatos}</span>
                <span className="text-xs text-muted-foreground">candidatos</span>
              </div>
            </Card>
          );
        })}
      </div>

      {/* Barra de filtros */}
      <div className="flex flex-col gap-3 rounded-2xl border border-border/60 bg-card/60 p-3 shadow-sm backdrop-blur sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            placeholder="Buscar candidato..."
            className="pl-9 transition-all duration-200 focus-visible:ring-2"
          />
        </div>
        <Select value={vagaFiltro} onValueChange={setVagaFiltro}>
          <SelectTrigger className="sm:w-48"><SelectValue placeholder="Vaga" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas as vagas</SelectItem>
            {vagas.map((v) => <SelectItem key={v.id} value={v.titulo}>{v.titulo}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={statusFiltro} onValueChange={setStatusFiltro}>
          <SelectTrigger className="sm:w-40"><SelectValue placeholder="Status" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos os status</SelectItem>
            {etapas.map((e) => <SelectItem key={e} value={e}>{e}</SelectItem>)}
          </SelectContent>
        </Select>
        <Button
          variant="outline"
          size="sm"
          onClick={() => toast.info("Mais filtros (demonstração)")}
          className="transition-all duration-200 active:scale-[0.98]"
        >
          <SlidersHorizontal className="mr-2 h-4 w-4" /> Filtros
        </Button>
      </div>

      {/* Pipeline Kanban */}
      <div className="-mx-1 overflow-x-auto pb-2">
        <div className="grid min-w-[60rem] grid-cols-5 gap-4 px-1">
          {etapas.map((etapa) => {
            const items = filtrados.filter((c) => c.etapa === etapa);
            return (
              <div
                key={etapa}
                className="flex flex-col overflow-hidden rounded-2xl border border-border/60 bg-muted/40 shadow-sm transition-colors"
              >
                <div className={cn("h-1.5 w-full", etapaColor[etapa])} />
                <div className="flex items-center justify-between px-3 py-3">
                  <p className="text-sm font-semibold">{etapa}</p>
                  <Badge variant="secondary" className="rounded-full">{items.length}</Badge>
                </div>
                <div className="space-y-2.5 px-3 pb-3">
                  {items.map((c) => (
                    <Card
                      key={c.id}
                      className="cursor-pointer rounded-xl border-border/60 p-3 shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md"
                    >
                      <div className="flex items-center gap-2.5">
                        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-primary/15 to-blue-500/15 text-xs font-semibold text-primary">
                          {initials(c.nome)}
                        </span>
                        <div className="min-w-0">
                          <p className="truncate text-sm font-medium">{c.nome}</p>
                          <p className="truncate text-xs text-muted-foreground">{c.vaga}</p>
                        </div>
                      </div>
                      <div className="mt-2.5 flex flex-wrap gap-1.5">
                        {tagsFor(c).map((t) => (
                          <span key={t.label} className={cn("rounded-md px-1.5 py-0.5 text-[10px] font-medium", t.cls)}>
                            {t.label}
                          </span>
                        ))}
                      </div>
                    </Card>
                  ))}
                  {items.length === 0 && (
                    <div className="flex flex-col items-center gap-1 py-6 text-center">
                      <User className="h-5 w-5 text-muted-foreground/50" />
                      <p className="text-xs text-muted-foreground">Vazio</p>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
