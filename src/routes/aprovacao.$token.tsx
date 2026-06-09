// PUBLIC client route: join the recorded approval video call via exclusive link.
import { createFileRoute, useParams } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useRef } from "react";
import { useApprovalCall } from "@/lib/legal/useApprovalCall";
import { getApprovalByToken } from "@/lib/legal/legal.functions";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Video, PhoneOff, ShieldCheck, Loader2, Circle } from "lucide-react";

export const Route = createFileRoute("/aprovacao/$token")({
  head: () => ({ meta: [{ title: "Confirmação de operação" }, { name: "robots", content: "noindex,nofollow" }] }),
  component: GuestPage,
});

function GuestPage() {
  const { token } = useParams({ from: "/aprovacao/$token" });
  const fetchInfo = useServerFn(getApprovalByToken);
  const info = useQuery({ queryKey: ["approval", token], queryFn: () => fetchInfo({ data: { token } }) });

  const { status, error, localStream, remoteStream, start, hangup } = useApprovalCall(token, "guest");
  const localRef = useRef<HTMLVideoElement>(null);
  const remoteRef = useRef<HTMLVideoElement>(null);

  useEffect(() => { if (localRef.current && localStream) localRef.current.srcObject = localStream; }, [localStream]);
  useEffect(() => { if (remoteRef.current && remoteStream) remoteRef.current.srcObject = remoteStream; }, [remoteStream]);

  const statusLabel: Record<string, string> = {
    idle: "Pronto para entrar", waiting: "Aguardando o atendente…", connecting: "Conectando…",
    connected: "Conectado", ended: "Chamada encerrada", error: "Erro de conexão",
  };

  if (info.isLoading) return <Center><Loader2 className="h-6 w-6 animate-spin" /></Center>;
  if (!info.data?.ok) return <Center><p className="text-muted-foreground">Link inválido ou expirado.</p></Center>;

  return (
    <div className="min-h-screen bg-background">
      <header className="flex items-center gap-2 border-b px-4 py-3">
        <ShieldCheck className="h-5 w-5 text-primary" />
        <span className="font-semibold">Confirmação de operação</span>
        <Badge variant={status === "connected" ? "default" : "secondary"} className="ml-auto">{statusLabel[status]}</Badge>
      </header>

      <main className="mx-auto max-w-3xl p-4">
        <div className="mb-3 rounded-md border border-amber-500/40 bg-amber-500/10 p-3 text-sm">
          <Circle className="mr-1 inline h-3 w-3 fill-red-600 text-red-600" />
          Esta videochamada será <strong>gravada</strong> para fins de confirmação e autorização da operação.
        </div>

        <div className="relative overflow-hidden rounded-lg bg-black">
          <video ref={remoteRef} autoPlay playsInline className="aspect-video w-full bg-black object-cover" />
          <video ref={localRef} autoPlay playsInline muted className="absolute bottom-3 right-3 w-1/4 rounded-md border-2 border-white/40 object-cover" />
          {status !== "connected" && (
            <div className="absolute inset-0 flex items-center justify-center text-sm text-white/70">{statusLabel[status]}</div>
          )}
        </div>

        {error && <p className="mt-3 text-sm text-destructive">{error}</p>}

        <div className="mt-4 flex justify-center gap-2">
          {status === "idle" || status === "ended" ? (
            <Button onClick={start} size="lg"><Video className="mr-2 h-5 w-5" /> Entrar na chamada</Button>
          ) : (
            <Button onClick={hangup} variant="destructive" size="lg"><PhoneOff className="mr-2 h-5 w-5" /> Encerrar</Button>
          )}
        </div>
      </main>
    </div>
  );
}

function Center({ children }: { children: React.ReactNode }) {
  return <div className="flex min-h-screen items-center justify-center p-6">{children}</div>;
}
