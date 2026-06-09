// WebRTC peer-to-peer call hook with Supabase Realtime signaling.
// Used by both the consultant (host) and the client (guest).
// Host creates the offer; guest answers. STUN servers only (public networks).
import { useCallback, useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export type CallRole = "host" | "guest";
export type CallStatus = "idle" | "waiting" | "connecting" | "connected" | "ended" | "error";

const ICE_SERVERS: RTCIceServer[] = [
  { urls: "stun:stun.l.google.com:19302" },
  { urls: "stun:stun1.l.google.com:19302" },
  { urls: "stun:stun.cloudflare.com:3478" },
];

export function useApprovalCall(token: string, role: CallRole) {
  const [status, setStatus] = useState<CallStatus>("idle");
  const [error, setError] = useState<string | null>(null);
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [remoteStream, setRemoteStream] = useState<MediaStream | null>(null);

  const pcRef = useRef<RTCPeerConnection | null>(null);
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const negotiatingRef = useRef(false);

  const cleanup = useCallback(() => {
    try { pcRef.current?.close(); } catch { /* noop */ }
    pcRef.current = null;
    if (channelRef.current) { supabase.removeChannel(channelRef.current); channelRef.current = null; }
    localStreamRef.current?.getTracks().forEach((t) => t.stop());
    localStreamRef.current = null;
  }, []);

  const hangup = useCallback(() => {
    try { channelRef.current?.send({ type: "broadcast", event: "bye", payload: {} }); } catch { /* noop */ }
    cleanup();
    setStatus("ended");
  }, [cleanup]);

  const start = useCallback(async () => {
    setError(null);
    setStatus("waiting");
    try {
      const media = await navigator.mediaDevices.getUserMedia({
        video: { width: { ideal: 1280 }, height: { ideal: 720 } },
        audio: { echoCancellation: true, noiseSuppression: true },
      });
      localStreamRef.current = media;
      setLocalStream(media);

      const pc = new RTCPeerConnection({ iceServers: ICE_SERVERS });
      pcRef.current = pc;
      media.getTracks().forEach((t) => pc.addTrack(t, media));

      const remote = new MediaStream();
      setRemoteStream(remote);
      pc.ontrack = (ev) => {
        ev.streams[0]?.getTracks().forEach((t) => remote.addTrack(t));
        setRemoteStream(new MediaStream(remote.getTracks()));
      };
      pc.onicecandidate = (ev) => {
        if (ev.candidate) {
          channelRef.current?.send({ type: "broadcast", event: "ice", payload: { candidate: ev.candidate, from: role } });
        }
      };
      pc.onconnectionstatechange = () => {
        const s = pc.connectionState;
        if (s === "connected") setStatus("connected");
        else if (s === "connecting") setStatus((p) => (p === "connected" ? p : "connecting"));
        else if (s === "failed" || s === "disconnected") setStatus((p) => (p === "ended" ? p : "error"));
      };

      const makeOffer = async () => {
        if (negotiatingRef.current) return;
        negotiatingRef.current = true;
        const offer = await pc.createOffer();
        await pc.setLocalDescription(offer);
        channelRef.current?.send({ type: "broadcast", event: "offer", payload: { sdp: offer } });
      };

      const channel = supabase.channel(`legal-call-${token}`, { config: { broadcast: { self: false } } });
      channelRef.current = channel;

      channel
        .on("broadcast", { event: "guest-join" }, () => { if (role === "host") makeOffer(); })
        .on("broadcast", { event: "host-online" }, () => { if (role === "guest") channel.send({ type: "broadcast", event: "guest-join", payload: {} }); })
        .on("broadcast", { event: "offer" }, async ({ payload }) => {
          if (role !== "guest") return;
          setStatus("connecting");
          await pc.setRemoteDescription(new RTCSessionDescription(payload.sdp));
          const answer = await pc.createAnswer();
          await pc.setLocalDescription(answer);
          channel.send({ type: "broadcast", event: "answer", payload: { sdp: answer } });
        })
        .on("broadcast", { event: "answer" }, async ({ payload }) => {
          if (role !== "host") return;
          setStatus("connecting");
          if (!pc.currentRemoteDescription) await pc.setRemoteDescription(new RTCSessionDescription(payload.sdp));
        })
        .on("broadcast", { event: "ice" }, async ({ payload }) => {
          if (payload.from === role) return;
          try { await pc.addIceCandidate(new RTCIceCandidate(payload.candidate)); } catch { /* noop */ }
        })
        .on("broadcast", { event: "bye" }, () => { cleanup(); setStatus("ended"); })
        .subscribe((s) => {
          if (s === "SUBSCRIBED") {
            if (role === "host") channel.send({ type: "broadcast", event: "host-online", payload: {} });
            else channel.send({ type: "broadcast", event: "guest-join", payload: {} });
          }
        });
    } catch (e: any) {
      setError(e?.message ?? "Não foi possível acessar a câmera/microfone.");
      setStatus("error");
    }
  }, [token, role, cleanup]);

  useEffect(() => () => cleanup(), [cleanup]);

  return { status, error, localStream, remoteStream, start, hangup };
}
