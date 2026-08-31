import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";

// Pathless layout that gates every protected route. It is client-only
// (ssr: false) because the Supabase session lives in localStorage, which the
// server cannot read — gating server-side would loop on hard refresh.
export const Route = createFileRoute("/_authenticated")({
  ssr: false,
  beforeLoad: async () => {
    // 1) Sessão local primeiro: rápida e sem depender de rede. O token já foi
    //    validado no momento do login e o cliente renova automaticamente.
    const local = await supabase.auth.getSession();
    const localUser = local.data.session?.user ?? null;
    if (localUser) {
      return { user: localUser };
    }

    // 2) Fallback: sem sessão local, tenta validar um token com o servidor.
    //    Qualquer falha (rede, timeout, token inválido) volta ao login em vez
    //    de derrubar a navegação com uma tela de erro.
    try {
      const { data, error } = await supabase.auth.getUser();
      if (!error && data.user) {
        return { user: data.user };
      }
    } catch {
      // Não quebra o fluxo: o redirect abaixo resolve.
    }

    throw redirect({ to: "/login" });
  },
  component: () => <Outlet />,
});
