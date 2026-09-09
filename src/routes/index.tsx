import { createFileRoute, Navigate } from "@tanstack/react-router";
import { useAuth } from "@/lib/auth";
import { useRhAccess } from "@/hooks/use-rh-access";

export const Route = createFileRoute("/")({ component: Index });

function Index() {
  const { user, loading } = useAuth();
  const { isAdmin, isLoading } = useRhAccess();

  if (loading || (user && isLoading)) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background text-muted-foreground">
        Carregando…
      </div>
    );
  }

  if (!user) return <Navigate to="/login" />;
  // Administrador entra no hub de gestão; consultoras já caem no CRM.
  return <Navigate to={isAdmin ? "/admin" : "/prospeccao"} />;
}
