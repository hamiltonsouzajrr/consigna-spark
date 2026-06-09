// Consultant (host) call screen: live video, confirmation script, acceptance,
// composite recording (remote + PiP local), upload to Storage and metadata save.
import { useCallback, useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useApprovalCall } from "@/lib/legal/useApprovalCall";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Video, VideoOff, Circle, Square, PhoneOff, Loader2, Copy, CheckCircle2, XCircle, ShieldCheck } from "lucide-react";

type Approval = {
  id: string; token: string; nome_completo: string; cpf: string | null; banco: string | null;
  tipo_operacao: string | null; valor_solicitado: number | null; valor_parcela: number | null;
  cliente_aceite: boolean | null;
};

const brl = (n: number | null) =>
  n == null ? "—" : new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(n);

async function sha256Hex(blob: Blob) {
  const buf = await blob.arrayBuffer();
  const hash = await crypto.subtle.digest("SHA-256", buf);
  return Array.from(new Uint8Array(hash)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

export function HostCall({ approval, onClose, onSaved }: { approval: Approval; onClose: () => void; onSaved: () => void }) {
  const { status, error, localStream, remoteStream, start, hangup } = useApprovalCall(approval.token, "host");
  const localVideoRef = useRef<HTMLVideoElement>(null);
  const remoteVideoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const recVideoRef = useRef<MediaRecorder | null>(null);
  const recAudioRef = useRef<MediaRecorder | null>(null);
  const videoChunks = useRef<Blob[]>([]);
  const audioChunks = useRef<Blob[]>([]);
  const rafRef = useRef<number>(0);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const startedAtRef = useRef<number>(0);

  const [recording, setRecording] = useState(false);
  const [saving, setSaving] = useState(false);
  const [aceite, setAceite] = useState<boolean | null>(approval.cliente_aceite);
  const guestLink = `${typeof window !== "undefined" ? window.location.origin : ""}/aprovacao/${approval.token}`;

  useEffect(() => { start(); /* eslint-disable-next-line */ }, []);
  useEffect(() => { if (localVideoRef.current && localStream) localVideoRef.current.srcObject = localStream; }, [localStream]);
  useEffect(() => { if (remoteVideoRef.current && remoteStream) remoteVideoRef.current.srcObject = remoteStream; }, [remoteStream]);

  const drawLoop = useCallback(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;
    ctx.fillStyle = "#0b0b0f";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    const rv = remoteVideoRef.current;
    if (rv && rv.videoWidth) ctx.drawImage(rv, 0, 0, canvas.width, canvas.height);
    const lv = localVideoRef.current;
    if (lv && lv.videoWidth) {
      const w = canvas.width * 0.25, h = canvas.height * 0.25;
      ctx.drawImage(lv, canvas.width - w - 16, canvas.height - h - 16, w, h);
    }
    rafRef.current = requestAnimationFrame(drawLoop);
  }, []);

  const startRecording = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas || !localStream) { toast.error("Câmera ainda não está pronta."); return; }
    rafRef.current = requestAnimationFrame(drawLoop);

    const audioCtx = new AudioContext();
    audioCtxRef.current = audioCtx;
    const dest = audioCtx.createMediaStreamDestination();
    if (localStream.getAudioTracks().length) audioCtx.createMediaStreamSource(localStream).connect(dest);
    if (remoteStream?.getAudioTracks().length) audioCtx.createMediaStreamSource(remoteStream).connect(dest);

    const canvasStream = canvas.captureStream(25);
    const mixed = new MediaStream([...canvasStream.getVideoTracks(), ...dest.stream.getAudioTracks()]);

    videoChunks.current = []; audioChunks.current = [];
    const vr = new MediaRecorder(mixed, { mimeType: "video/webm" });
    vr.ondataavailable = (e) => { if (e.data.size) videoChunks.current.push(e.data); };
    recVideoRef.current = vr; vr.start(1000);

    const ar = new MediaRecorder(dest.stream, { mimeType: "audio/webm" });
    ar.ondataavailable = (e) => { if (e.data.size) audioChunks.current.push(e.data); };
    recAudioRef.current = ar; ar.start(1000);

    startedAtRef.current = Date.now();
    setRecording(true);
    toast.success("Gravação iniciada.");
  }, [localStream, remoteStream, drawLoop]);

  const stopAndSave = useCallback(async () => {
    if (!recording) return;
    setSaving(true);
    const duracao = Math.round((Date.now() - startedAtRef.current) / 1000);

    const stopRec = (r: MediaRecorder | null) =>
      new Promise<void>((resolve) => { if (!r || r.state === "inactive") return resolve(); r.onstop = () => resolve(); r.stop(); });
    await Promise.all([stopRec(recVideoRef.current), stopRec(recAudioRef.current)]);
    cancelAnimationFrame(rafRef.current);
    try { await audioCtxRef.current?.close(); } catch { /* noop */ }

    try {
      const videoBlob = new Blob(videoChunks.current, { type: "video/webm" });
      const audioBlob = new Blob(audioChunks.current, { type: "audio/webm" });
      const hash = await sha256Hex(videoBlob);
      const videoPath = `${approval.id}/video.webm`;
      const audioPath = `${approval.id}/audio.webm`;

      const up1 = await supabase.storage.from("legal-recordings").upload(videoPath, videoBlob, { upsert: true, contentType: "video/webm" });
      if (up1.error) throw up1.error;
      const up2 = await supabase.storage.from("legal-recordings").upload(audioPath, audioBlob, { upsert: true, contentType: "audio/webm" });
      if (up2.error) throw up2.error;

      const { error: upErr } = await supabase
        .from("legal_approvals")
        .update({
          video_path: videoPath, audio_path: audioPath, duracao_segundos: duracao,
          file_hash: hash, gravado_em: new Date().toISOString(), status: "concluido",
          cliente_aceite: aceite, aceite_registrado_at: aceite != null ? new Date().toISOString() : null,
        })
        .eq("id", approval.id);
      if (upErr) throw upErr;

      toast.success("Gravação salva nas Gravações Jurídicas.");
      setRecording(false);
      onSaved();
      hangup();
      onClose();
    } catch (e: any) {
      toast.error(e?.message ?? "Falha ao salvar a gravação.");
    } finally {
      setSaving(false);
    }
  }, [recording, approval.id, aceite, hangup, onClose, onSaved]);

  const copyLink = async () => { await navigator.clipboard.writeText(guestLink); toast.success("Link copiado."); };

  const statusLabel: Record<string, string> = {
    idle: "Iniciando…", waiting: "Aguardando o cliente entrar…", connecting: "Conectando…",
    connected: "Conectado", ended: "Encerrada", error: "Erro",
  };

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-background">
      <div className="flex items-center justify-between border-b px-4 py-3">
        <div className="flex items-center gap-2">
          <ShieldCheck className="h-5 w-5 text-primary" />
          <span className="font-semibold">Central de Aprovação — {approval.nome_completo}</span>
          <Badge variant={status === "connected" ? "default" : "secondary"}>{statusLabel[status]}</Badge>
          {recording && <Badge className="bg-red-600 text-white gap-1"><Circle className="h-3 w-3 fill-current animate-pulse" /> REC</Badge>}
        </div>
        <Button variant="ghost" size="sm" onClick={() => { hangup(); onClose(); }}><PhoneOff className="mr-2 h-4 w-4" /> Sair</Button>
      </div>

      {error && <div className="bg-destructive/10 px-4 py-2 text-sm text-destructive">{error}</div>}

      <div className="grid flex-1 gap-4 overflow-auto p-4 lg:grid-cols-[1fr_360px]">
        <div className="space-y-3">
          <div className="relative overflow-hidden rounded-lg bg-black">
            <video ref={remoteVideoRef} autoPlay playsInline className="aspect-video w-full bg-black object-cover" />
            <video ref={localVideoRef} autoPlay playsInline muted className="absolute bottom-3 right-3 w-1/4 rounded-md border-2 border-white/40 object-cover" />
            {status !== "connected" && (
              <div className="absolute inset-0 flex items-center justify-center text-sm text-white/70">
                <VideoOff className="mr-2 h-5 w-5" /> {statusLabel[status]}
              </div>
            )}
          </div>
          <canvas ref={canvasRef} width={1280} height={720} className="hidden" />

          <div className="flex flex-wrap gap-2">
            {!recording ? (
              <Button onClick={startRecording} disabled={status !== "connected"}>
                <Circle className="mr-2 h-4 w-4" /> Iniciar gravação
              </Button>
            ) : (
              <Button variant="destructive" onClick={stopAndSave} disabled={saving}>
                {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Square className="mr-2 h-4 w-4" />} Parar e salvar
              </Button>
            )}
            <Button variant="outline" onClick={copyLink}><Copy className="mr-2 h-4 w-4" /> Copiar link do cliente</Button>
          </div>
        </div>

        <div className="space-y-4">
          <div className="rounded-lg border p-4">
            <p className="mb-3 text-sm font-semibold">Roteiro de confirmação</p>
            <dl className="space-y-2 text-sm">
              <Row k="Nome completo" v={approval.nome_completo} />
              <Row k="CPF" v={approval.cpf} />
              <Row k="Banco" v={approval.banco} />
              <Row k="Tipo da operação" v={approval.tipo_operacao} />
              <Row k="Valor solicitado" v={brl(approval.valor_solicitado)} />
              <Row k="Valor da parcela" v={brl(approval.valor_parcela)} />
            </dl>
          </div>

          <div className="rounded-lg border border-primary/40 bg-primary/5 p-4">
            <p className="text-sm font-medium">Pergunte ao cliente:</p>
            <p className="mt-1 text-sm italic">"Confirma que está ciente e autoriza a continuidade desta operação?"</p>
            <div className="mt-3 flex gap-2">
              <Button size="sm" variant={aceite === true ? "default" : "outline"} onClick={() => setAceite(true)}>
                <CheckCircle2 className="mr-2 h-4 w-4" /> Autorizou
              </Button>
              <Button size="sm" variant={aceite === false ? "destructive" : "outline"} onClick={() => setAceite(false)}>
                <XCircle className="mr-2 h-4 w-4" /> Não autorizou
              </Button>
            </div>
            <p className="mt-2 text-xs text-muted-foreground">
              {aceite == null ? "O aceite será salvo junto com a gravação." : aceite ? "Aceite registrado: AUTORIZADO." : "Aceite registrado: NÃO autorizado."}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

function Row({ k, v }: { k: string; v: string | null }) {
  return (
    <div className="flex justify-between gap-3">
      <dt className="text-muted-foreground">{k}</dt>
      <dd className="text-right font-medium">{v || "—"}</dd>
    </div>
  );
}
