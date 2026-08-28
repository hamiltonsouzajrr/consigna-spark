import { Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { AlertTriangle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";

/** Aviso fixo enquanto a conta ainda usa a senha provisória entregue pelo admin. */
export function TempPasswordBanner() {
  const { user } = useAuth();
  const [temp, setTemp] = useState(false);

  useEffect(() => {
    if (!user?.id) {
      setTemp(false);
      return;
    }
    let cancelled = false;
    const load = async () => {
      const { data } = await supabase
        .from("profiles")
        .select("senha_temporaria")
        .eq("user_id", user.id)
        .maybeSingle();
      if (!cancelled) setTemp(Boolean(data?.senha_temporaria));
    };
    load();
    const onUpdated = () => setTemp(false);
    window.addEventListener("senha-atualizada", onUpdated);
    return () => {
      cancelled = true;
      window.removeEventListener("senha-atualizada", onUpdated);
    };
  }, [user?.id]);

  if (!temp) return null;

  return (
    <div className="flex flex-wrap items-center gap-2 border-b border-amber-500/40 bg-amber-500/15 px-4 py-2 text-sm text-amber-900 dark:text-amber-200 print:hidden">
      <AlertTriangle className="h-4 w-4 shrink-0" />
      <span className="flex-1">Você está usando uma senha provisória. Defina sua senha definitiva agora.</span>
      <Link to="/conta/senha" className="font-semibold underline underline-offset-2">
        Alterar senha
      </Link>
    </div>
  );
}
