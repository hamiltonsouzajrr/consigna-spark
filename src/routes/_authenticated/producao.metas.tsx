import { createFileRoute, Navigate } from "@tanstack/react-router";
import { useMemo, useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/lib/auth";
import { AppShell } from "@/components/AppShell";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { Target } from "lucide-react";
import { brl } from "@/lib/rh/mock";
import { producaoMesQueryOptions, mesAtual, formatMes } from "@/lib/rh/producao";

export const Route = createFileRoute("/_authenticated/_authenticated/producao/metas")({
  head: () => ({
    meta: [
      { title: "Metas — Produção" },
      { name: "description", content: "Acompanhe a meta de produção mensal da equipe." },
      { name: "robots", content: "noindex,nofollow" },
    ],
  }),
  component: Page,
});

const STORAGE_KEY = "producao-meta-mensal";

function Page() {
  const { user, loading } = useAuth();
  const mes = mesAtual();
  const { data } = useQuery(producaoMesQueryOptions(mes));
  const [meta, setMeta] = useState<number>(0);

  useEffect(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) setMeta(Number(saved) || 0);
  }, []);

  const totais = useMemo(() => {
    const rows = data ?? [];
    return {
      valor: rows.reduce((s, r) => s + Number(r.valor || 0), 0),
      contratos: rows.reduce((s, r) => s + Number(r.contratos || 0), 0),
    };
  }, [data]);

  if (loading) return null;
  if (!user) return <Navigate to="/login" />;

  const pct = meta > 0 ? Math.min(100, Math.round((totais.valor / meta) * 100)) : 0;
  const falta = Math.max(0, meta - totais.valor);

  return (
    <AppShell>
      <div className="mb-6 flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/15 text-primary">
          <Target className="h-5 w-5" />
        </div>
        <div>
          <h1 className="text-2xl font-bold">Metas</h1>
          <p className="text-sm text-muted-foreground">Meta de produção de {formatMes(mes)}.</p>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-1">
          <CardHeader className="pb-3"><CardTitle className="text-base">Definir meta</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            <div className="space-y-1.5">
              <Label>Meta de valor (R$)</Label>
              <Input
                inputMode="decimal"
                placeholder="0,00"
                value={meta ? String(meta) : ""}
                onChange={(e) => {
                  const v = Number(e.target.value.replace(",", ".")) || 0;
                  setMeta(v);
                  localStorage.setItem(STORAGE_KEY, String(v));
                }}
              />
            </div>
            <p className="text-xs text-muted-foreground">A meta é salva neste dispositivo.</p>
          </CardContent>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader className="pb-2"><CardTitle className="text-base">Progresso de {formatMes(mes)}</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div>
              <div className="mb-1 flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Produção atual</span>
                <span className="font-semibold tabular-nums">{brl(totais.valor)}</span>
              </div>
              <Progress value={pct} />
              <div className="mt-1 flex items-center justify-between text-xs text-muted-foreground">
                <span>{pct}% da meta</span>
                <span>Meta: {meta ? brl(meta) : "—"}</span>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-lg border p-3">
                <p className="text-xs text-muted-foreground">Contratos</p>
                <p className="text-xl font-bold">{totais.contratos}</p>
              </div>
              <div className="rounded-lg border p-3">
                <p className="text-xs text-muted-foreground">Falta para a meta</p>
                <p className="text-xl font-bold">{meta ? brl(falta) : "—"}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </AppShell>
  );
}
