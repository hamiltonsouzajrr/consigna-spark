import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";

// Pathless layout that gates every protected route. It is client-only
// (ssr: false) because the Supabase session lives in localStorage, which the
// server cannot read — gating server-side would loop on hard refresh.
export const Route = createFileRoute("/_authenticated")({
  ssr: false,
  beforeLoad: async () => {
    const { data, error } = await supabase.auth.getUser();
    if (error || !data.user) {
      throw redirect({ to: "/login" });
    }
    return { user: data.user };
  },
  component: () => <Outlet />,
});
