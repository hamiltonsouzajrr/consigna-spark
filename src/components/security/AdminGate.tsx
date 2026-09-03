// Gate único para telas administrativas: trata carregamento (sem tela branca)
// e mostra uma mensagem clara de permissão em vez de redirecionar às cegas.
import type { ReactNode } from "react";
import { Link } from "@tanstack/react-router";
import { Lock } from "lucide-react";
import { useAuth } from "@/lib/auth";
import { useRhAccess } from "@/hooks/use-rh-access";
import { AppShell } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";

export function AdminGate({ children }: { children: ReactNode }) {
  const { user, loading } = useAuth();
  const { isAdmin, isLoading } = useRhAccess();

  if (loading || isLoading) {
    return (
      <AppShell>
        <div className="space-y-4">
          <Skeleton className="h-8 w-64" />
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <Skeleton key={i} className="h-28 w-full" />
            ))}
          </div>
        </div>
      </AppShell>
    );
  }

  if (!user || !isAdmin) {
    return (
      <AppShell>
        <div className="flex flex-col items-center justify-center gap-3 rounded-xl border bg-card py-20 text-center">
          <Lock className="h-10 w-10 text-muted-foreground" />
          <p className="font-medium">Área restrita a administradores</p>
          <p className="max-w-sm text-sm text-muted-foreground">
            Sua conta não tem permissão de administrador. Se precisar deste acesso, solicite ao
            administrador do sistema.
          </p>
          <Button asChild variant="outline" size="sm">
            <Link to="/">Voltar ao início</Link>
          </Button>
        </div>
      </AppShell>
    );
  }

  return <>{children}</>;
}
