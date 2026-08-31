import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

// Notificação persistente de esgotamento da base de Tomadores AL.
// O alerta é gravado em diario_alertas (mesma tabela usada pelos alertas do
// Diário Oficial) com tipo próprio, deduplicado em janela de 6 horas para não
// encher o sistema de registros repetidos. A leitura/escrita usa o cliente
// administrativo (service role) e o acesso é restrito a administradores.

const STATUS_ABERTOS = ["novo", "contatado", "proposta_enviada"] as const;
const TIPO_ALERTA = "tomadores_al_base_esgotada";
const JANELA_DEDUP_MS = 6 * 3600_000;

export const registrarAlertaBaseEsgotadaTomadores = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<{ alertaCriado: boolean; livres: number }> => {
    const { supabase, userId } = context;

    const { data: ehAdmin } = await supabase.rpc("has_role", {
      _user_id: userId,
      _role: "admin",
    });
    if (!ehAdmin) throw new Error("Apenas administradores podem registrar este alerta.");

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { count, error: cErr } = await supabaseAdmin
      .from("tomadores_al")
      .select("id", { count: "exact", head: true })
      .is("consultora_responsavel", null)
      .in("status_abordagem", [...STATUS_ABERTOS]);
    if (cErr) throw new Error(cErr.message);

    const livres = Number(count ?? 0);
    if (livres > 0) return { alertaCriado: false, livres };

    const limite = new Date(Date.now() - JANELA_DEDUP_MS).toISOString();
    const { count: recentes } = await supabaseAdmin
      .from("diario_alertas")
      .select("id", { count: "exact", head: true })
      .eq("tipo", TIPO_ALERTA)
      .eq("lido", false)
      .gte("criado_em", limite);
    if (Number(recentes ?? 0) > 0) return { alertaCriado: false, livres };

    const { error: iErr } = await supabaseAdmin.from("diario_alertas").insert({
      tipo: TIPO_ALERTA,
      titulo: "Base de Tomadores AL acabou",
      mensagem:
        "Não há leads livres com margem para distribuir entre as consultoras. Importe uma nova planilha de Tomadores AL ou libere leads parados em carteiras de consultoras inativas.",
      severidade: "warning",
      lido: false,
    });
    if (iErr) throw new Error(iErr.message);

    return { alertaCriado: true, livres };
  });
