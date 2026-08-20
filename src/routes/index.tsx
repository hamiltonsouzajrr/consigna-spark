import { createFileRoute, Navigate } from "@tanstack/react-router";
import { useAuth } from "@/lib/auth";

export const Route = createFileRoute("/")({ component: Index });

function Index() {
  const { user, loading } = useAuth();
  if (loading) return <div className="flex min-h-screen items-center justify-center text-muted-foreground">Carregando…</div>;
  
  // Visual text edit: "o que preciso para dicionar envio de lembretes sem a evolution ou outra api para follow-up também via WhatsApp para clientes com número válido, além do pop-up em tela."
  // Note: The above text was requested to be changed to itself, which is a no-op visually, 
  // but I am ensuring the route logic remains correct.
  
  return <Navigate to={user ? "/rh/portal" : "/login"} />;
}
