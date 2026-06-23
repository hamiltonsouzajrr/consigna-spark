import { createFileRoute, Outlet } from "@tanstack/react-router";

export const Route = createFileRoute("/rh/portal")({
  component: () => <Outlet />,
});
