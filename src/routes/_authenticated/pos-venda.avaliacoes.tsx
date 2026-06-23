import { createFileRoute, Navigate, Link } from "@tanstack/react-router";
import { useAuth } from "@/lib/auth";
import { AppShell } from "@/components/AppShell";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Star, QrCode, ExternalLink } from "lucide-react";

export const Route = createFileRoute("/pos-venda/avaliacoes")({
  head: () => ({
    meta: [
      { title: "Avaliações — Pós-venda" },
      { name: "description", content: "Acompanhe as avaliações dos clientes após o atendimento." },
      { name: "robots", content: "noindex,nofollow" },
    ],
  }),
  component: Page,
});

function Page() {
  const { user, loading } = useAuth();
  if (loading) return null;
  if (!user) return <Navigate to="/login" />;

  return (
    <AppShell>
      <div className="mb-6 flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-500/15 text-amber-600 dark:text-amber-400">
          <Star className="h-5 w-5" />
        </div>
        <div>
          <h1 className="text-2xl font-bold">Avaliações</h1>
          <p className="text-sm text-muted-foreground">Reúna e acompanhe as avaliações dos clientes.</p>
        </div>
      </div>

      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-base">Coletar avaliações</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Use os QR Codes de avaliação para que os clientes deixem uma nota e um comentário ao final do atendimento.
          </p>
          <div className="flex flex-wrap gap-2">
            <Button asChild>
              <Link to="/qrcodes"><QrCode className="mr-2 h-4 w-4" /> Abrir QR Codes</Link>
            </Button>
            <Button asChild variant="outline">
              <a href="https://g.page/r/" target="_blank" rel="noopener noreferrer">
                <ExternalLink className="mr-2 h-4 w-4" /> Avaliações no Google
              </a>
            </Button>
          </div>
        </CardContent>
      </Card>
    </AppShell>
  );
}
