import { createFileRoute, Outlet } from "@tanstack/react-router";
import { AppShell } from "@/components/AppShell";
import { RhLayout } from "@/components/rh/RhLayout";

export const Route = createFileRoute("/rh")({
  head: () => ({
    meta: [
      { title: "RH | Grupo Positive" },
      { name: "description", content: "Módulo de Recursos Humanos do Grupo Positive: colaboradores, férias, treinamentos, recrutamento e mais." },
      { name: "robots", content: "noindex,nofollow" },
    ],
  }),
  component: RhRoot,
});

function RhRoot() {
  return (
    <AppShell>
      <RhLayout>
        <Outlet />
      </RhLayout>
    </AppShell>
  );
}
