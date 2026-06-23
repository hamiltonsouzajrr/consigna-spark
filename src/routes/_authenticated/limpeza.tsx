import { createFileRoute, Navigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useAuth } from "@/lib/auth";
import { AppShell } from "@/components/AppShell";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "sonner";
import { Trash2, Loader2 } from "lucide-react";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

export const Route = createFileRoute("/_authenticated/limpeza")({
  head: () => ({
    meta: [
      { title: "Limpeza de Registros — Consulta de Margem" },
      { name: "description", content: "Remova registros de consultas por status (pendentes, processando, concluídos ou com erro)." },
      { property: "og:title", content: "Limpeza de Registros — Consulta de Margem" },
      { property: "og:description", content: "Remova registros de consultas por status (pendentes, processando, concluídos ou com erro)." },
      { property: "og:url", content: "https://consigna-spark.lovable.app/limpeza" },
      { name: "robots", content: "noindex,nofollow" },
    ],
    links: [{ rel: "canonical", href: "https://consigna-spark.lovable.app/limpeza" }],
  }),
  component: Page,
});

type Status = "pendente" | "processando" | "concluido" | "erro";
const STATUSES: { id: Status; label: string; cls: string }[] = [
  { id: "pendente", label: "Pendentes", cls: "text-warning-foreground" },
  { id: "processando", label: "Processando", cls: "text-primary" },
  { id: "concluido", label: "Concluídos", cls: "text-success" },
  { id: "erro", label: "Erros", cls: "text-destructive" },
];

function Page() {
  const { user, loading } = useAuth();
  const [counts, setCounts] = useState<Record<Status, number>>({ pendente: 0, processando: 0, concluido: 0, erro: 0 });
  const [selected, setSelected] = useState<Set<Status>>(new Set());
  const [busy, setBusy] = useState(false);
  const [loadingCounts, setLoadingCounts] = useState(true);

  const loadCounts = async () => {
    setLoadingCounts(true);
    const out: Record<Status, number> = { pendente: 0, processando: 0, concluido: 0, erro: 0 };
    await Promise.all(STATUSES.map(async (s) => {
      const { count } = await supabase
        .from("consultas_margem")
        .select("id", { count: "exact", head: true })
        .eq("status", s.id);
      out[s.id] = count ?? 0;
    }));
    setCounts(out);
    setLoadingCounts(false);
  };

  useEffect(() => { if (user) loadCounts(); }, [user]);

  const toggle = (s: Status) => setSelected((prev) => {
    const n = new Set(prev); n.has(s) ? n.delete(s) : n.add(s); return n;
  });

  const totalSelected = Array.from(selected).reduce((a, s) => a + counts[s], 0);

  const handleDelete = async () => {
    if (selected.size === 0) return;
    setBusy(true);
    const { error, count } = await supabase
      .from("consultas_margem")
      .delete({ count: "exact" })
      .in("status", Array.from(selected));
    setBusy(false);
    if (error) return toast.error(error.message);
    toast.success(`${count ?? 0} registro(s) excluído(s)`);
    setSelected(new Set());
    loadCounts();
  };

  if (loading) return null;
  if (!user) return <Navigate to="/login" />;

  return (
    <AppShell>
      <div className="mb-6">
        <h1 className="text-2xl font-bold">Limpeza de importações</h1>
        <p className="text-sm text-muted-foreground">Exclua consultas importadas filtrando por status.</p>
      </div>

      <Card className="p-4">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {STATUSES.map((s) => (
            <label
              key={s.id}
              className={`flex cursor-pointer items-center justify-between rounded-md border p-4 transition ${
                selected.has(s.id) ? "border-primary bg-primary/5" : "hover:bg-accent"
              }`}
            >
              <div className="flex items-center gap-3">
                <Checkbox checked={selected.has(s.id)} onCheckedChange={() => toggle(s.id)} />
                <div>
                  <p className="text-sm font-medium">{s.label}</p>
                  <p className={`text-2xl font-bold tabular-nums ${s.cls}`}>
                    {loadingCounts ? "…" : counts[s.id].toLocaleString("pt-BR")}
                  </p>
                </div>
              </div>
            </label>
          ))}
        </div>

        <div className="mt-6 flex flex-wrap items-center justify-between gap-3 border-t pt-4">
          <p className="text-sm text-muted-foreground">
            {selected.size === 0
              ? "Selecione um ou mais status para excluir."
              : `${totalSelected.toLocaleString("pt-BR")} registro(s) serão excluídos.`}
          </p>
          <div className="flex gap-2">
            <Button variant="outline" onClick={loadCounts} disabled={loadingCounts || busy}>
              Atualizar
            </Button>
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="destructive" disabled={selected.size === 0 || busy || totalSelected === 0}>
                  {busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Trash2 className="mr-2 h-4 w-4" />}
                  Excluir selecionados
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Confirmar exclusão</AlertDialogTitle>
                  <AlertDialogDescription>
                    Esta ação removerá {totalSelected.toLocaleString("pt-BR")} registro(s) com status{" "}
                    <strong>{Array.from(selected).map((s) => STATUSES.find((x) => x.id === s)!.label).join(", ")}</strong>.
                    Não é possível desfazer.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancelar</AlertDialogCancel>
                  <AlertDialogAction onClick={handleDelete}>Excluir</AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>
        </div>
      </Card>
    </AppShell>
  );
}
