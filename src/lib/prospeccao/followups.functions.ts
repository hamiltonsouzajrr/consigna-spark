// Server functions dos lembretes de follow-up.
// - enviarLembretesFollowup: admin dispara o pop-up/notificação para todas as
//   consultoras com retornos agendados vencendo (o sistema também dispara
//   automaticamente pelo gatilho público de rotina).

import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const enviarLembretesFollowup = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data: isAdmin, error } = await context.supabase.rpc("has_role", {
      _user_id: context.userId,
      _role: "admin",
    });
    if (error) throw new Error(error.message);
    if (!isAdmin) throw new Error("Acesso restrito a administradores.");

    const { dispararLembretesFollowup } = await import("./followups.server");
    return dispararLembretesFollowup();
  });
