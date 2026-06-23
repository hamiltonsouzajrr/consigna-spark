import { createFileRoute, Navigate } from "@tanstack/react-router";

export const Route = createFileRoute("/rh/")({
  component: () => <Navigate to="/rh/dashboard" replace />,
});
