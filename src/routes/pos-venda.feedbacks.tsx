import { createFileRoute, Navigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useAuth } from "@/lib/auth";
import { AppShell } from "@/components/AppShell";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { MessageSquare, Trash2 } from "lucide-react";

export const Route = createFileRoute("/pos-venda/feedbacks")({
  head: () => ({
    meta: [
      { title: "Feedbacks — Pós-venda" },
      { name: "description", content: "Registre feedbacks dos clientes para melhorar o atendimento." },
      { name: "robots", content: "noindex,nofollow" },
    ],
  }),
  component: Page,
});

type Feedback = { id: string; texto: string; data: string };
const STORAGE_KEY = "pos-venda-feedbacks";

function Page() {
  const { user, loading } = useAuth();
  const [lista, setLista] = useState<Feedback[]>([]);
  const [texto, setTexto] = useState("");

  useEffect(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) { try { setLista(JSON.parse(saved)); } catch { /* ignore */ } }
  }, []);

  const persist = (next: Feedback[]) => {
    setLista(next);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  };

  const add = () => {
    const t = texto.trim();
    if (!t) return;
    persist([{ id: crypto.randomUUID(), texto: t, data: new Date().toISOString() }, ...lista]);
    setTexto("");
  };

  if (loading) return null;
  if (!user) return <Navigate to="/login" />;

  return (
    <AppShell>
      <div className="mb-6 flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-sky-500/15 text-sky-600 dark:text-sky-400">
          <MessageSquare className="h-5 w-5" />
        </div>
        <div>
          <h1 className="text-2xl font-bold">Feedbacks</h1>
          <p className="text-sm text-muted-foreground">Anote impressões e sugestões dos clientes.</p>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-1">
          <CardHeader className="pb-3"><CardTitle className="text-base">Novo feedback</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            <Textarea rows={4} placeholder="O que o cliente comentou?" value={texto} onChange={(e) => setTexto(e.target.value)} />
            <Button onClick={add} disabled={!texto.trim()} className="w-full">Salvar feedback</Button>
            <p className="text-xs text-muted-foreground">Salvo neste dispositivo.</p>
          </CardContent>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader className="pb-2"><CardTitle className="text-base">Registrados</CardTitle></CardHeader>
          <CardContent className="space-y-2">
            {lista.length === 0 ? (
              <p className="py-6 text-center text-sm text-muted-foreground">Nenhum feedback ainda.</p>
            ) : (
              lista.map((f) => (
                <div key={f.id} className="flex items-start gap-3 rounded-lg border p-3">
                  <div className="min-w-0 flex-1">
                    <p className="text-sm">{f.texto}</p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {new Date(f.data).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", year: "2-digit", hour: "2-digit", minute: "2-digit" })}
                    </p>
                  </div>
                  <Button variant="ghost" size="icon" onClick={() => persist(lista.filter((x) => x.id !== f.id))}>
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                </div>
              ))
            )}
          </CardContent>
        </Card>
      </div>
    </AppShell>
  );
}
