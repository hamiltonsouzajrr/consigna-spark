import { createFileRoute, Navigate } from "@tanstack/react-router";

export const Route = createFileRoute("/_authenticated/rh/")({
  component: () => <Navigate to="/rh/dashboard" replace />,
});
