import { useEffect, useMemo, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Clock, ShieldAlert, LogOut } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { useAuth } from "@/lib/auth";
import { pulseAccess } from "@/lib/security/session.functions";
import logo from "@/assets/grupo-positive-logo-2026.png.asset.json";

const KEY = "gp.session-key";

/** Chave estável por navegador (dois dispositivos = duas chaves). */
function getSessionKey(): string {
  try {
    const found = localStorage.getItem(KEY);
    if (found && found.length >= 8) return found;
    const key = crypto.randomUUID();
    localStorage.setItem(KEY, key);
    return key;
  } catch {
    return "sem-storage-" + Math.random().toString(36).slice(2, 12);
  }
}

/**
 * Trava de horário (seg–qui 08:00–18:00, sex 08:00–17:00, fim de semana
 * fechado) e bloqueio de acesso simultâneo. Administradores são isentos.
 */
export function AccessGuard({ children }: { children: React.ReactNode }) {
  const { signOut, user } = useAuth();
  const pulse = useServerFn(pulseAccess);
  const [sessionKey, setSessionKey] = useState<string | null>(null);
  const avisou = useRef(false);

  useEffect(() => setSessionKey(getSessionKey()), []);

  const { data } = useQuery({
    queryKey: ["access-state", sessionKey],
    enabled: !!sessionKey && !!user,
    queryFn: () => pulse({ data: { sessionKey: sessionKey! } }),
    refetchInterval: 30_000,
    refetchOnWindowFocus: true,
    staleTime: 0,
  });

  // Aviso 10 minutos antes do corte.
  useEffect(() => {
    const faltam = data?.janela.minutosParaFechar;
    if (data?.isAdmin || faltam == null) return;
    if (faltam <= 10 && faltam > 0 && !avisou.current) {
      avisou.current = true;
      toast.warning("O sistema fecha em breve", {
        description: `Encerramento às ${data.janela.fechaAs}. Finalize seus atendimentos.`,
        duration: 15000,
      });
    }
    if (faltam > 10) avisou.current = false;
  }, [data]);

  // Corte de horário: encerra a sessão.
  useEffect(() => {
    if (!data || data.isAdmin) return;
    if (!data.janela.aberto && data.janela.motivo === "depois") {
      void signOut();
    }
  }, [data, signOut]);

  const bloqueioSessao = !!data && !data.isAdmin && data.sessaoBloqueada;
  const bloqueioHorario = !!data && !data.isAdmin && !data.janela.aberto;

  const mensagemHorario = useMemo(() => {
    if (!data) return "";
    if (data.janela.motivo === "fim_de_semana")
      return "O sistema não opera aos sábados e domingos.";
    if (data.janela.motivo === "antes") return "O sistema abre às 08:00.";
    return `O expediente de hoje terminou às ${data.janela.fechaAs}.`;
  }, [data]);

  if (bloqueioSessao) {
    return (
      <Overlay
        tone="danger"
        icon={<ShieldAlert className="h-10 w-10 text-destructive" />}
        titulo="Conta bloqueada por acesso simultâneo"
        texto="Detectamos esta conta em uso em dois dispositivos ao mesmo tempo. Por segurança, as duas sessões foram bloqueadas e um administrador foi notificado."
        extra="Fale com o administrador para liberar seu acesso."
        onSignOut={signOut}
      />
    );
  }

  if (bloqueioHorario) {
    return (
      <Overlay
        tone="warning"
        icon={<Clock className="h-10 w-10 text-primary" />}
        titulo="Sistema fora do horário de funcionamento"
        texto={mensagemHorario}
        extra={`Horário de acesso: segunda a quinta, 08:00 às 18:00 · sexta, 08:00 às 17:00. Liberação: ${data?.janela.proximaAbertura}.`}
        onSignOut={signOut}
      />
    );
  }

  return <>{children}</>;
}

function Overlay({
  icon,
  titulo,
  texto,
  extra,
  tone,
  onSignOut,
}: {
  icon: React.ReactNode;
  titulo: string;
  texto: string;
  extra: string;
  tone: "danger" | "warning";
  onSignOut: () => void | Promise<void>;
}) {
  return (
    <main className="flex min-h-screen items-center justify-center app-bg p-4">
      <Card
        className={`w-full max-w-lg space-y-5 border-2 p-8 text-center ${
          tone === "danger" ? "border-destructive/40" : "border-primary/30"
        }`}
      >
        <img
          src={logo.url}
          alt="Grupo Positive"
          className="mx-auto h-14 w-14 rounded-xl bg-white object-contain p-1"
        />
        <div className="flex justify-center">{icon}</div>
        <h1 className="text-xl font-bold">{titulo}</h1>
        <p className="text-sm text-muted-foreground">{texto}</p>
        <p className="rounded-lg bg-muted/60 p-3 text-xs text-muted-foreground">{extra}</p>
        <Button variant="outline" className="w-full" onClick={() => void onSignOut()}>
          <LogOut className="mr-2 h-4 w-4" /> Sair
        </Button>
      </Card>
    </main>
  );
}
