// Server functions for the Central de Aprovação (legal recordings).
// - getApprovalByToken: PUBLIC; minimal info so the client guest page can validate the link.
// - aiTranscribeApproval: admin-only; downloads the stored audio and uses Lovable AI
//   to produce a transcription + summary, saving both on the record.
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

async function assertAdmin(supabase: any, userId: string) {
  const { data, error } = await supabase.rpc("has_role", { _user_id: userId, _role: "admin" });
  if (error) throw new Error(error.message);
  if (!data) throw new Error("Acesso restrito a administradores.");
}

export type GuestApproval = { ok: boolean; nome_completo: string | null; consultant_email: string | null; status: string | null };

export type AdminApproval = {
  id: string; lead_id: string | null; token: string; nome_completo: string;
  cpf: string | null; banco: string | null; tipo_operacao: string | null;
  valor_solicitado: number | null; valor_parcela: number | null;
  status: string; cliente_aceite: boolean | null;
  video_path: string | null; audio_path: string | null;
  duracao_segundos: number | null; file_hash: string | null;
  transcricao: string | null; resumo: string | null;
  consultant_email: string | null; gravado_em: string | null; created_at: string;
  video_ok: boolean; audio_ok: boolean;
};

// Admin-only: list every approval session (video calls) with a storage health check.
export const adminListApprovals = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<AdminApproval[]> => {
    const { supabase, userId } = context;
    await assertAdmin(supabase, userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data, error } = await supabaseAdmin
      .from("legal_approvals")
      .select("id,lead_id,token,nome_completo,cpf,banco,tipo_operacao,valor_solicitado,valor_parcela,status,cliente_aceite,video_path,audio_path,duracao_segundos,file_hash,transcricao,resumo,consultant_email,gravado_em,created_at")
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    const rows = data ?? [];

    // Verify each stored file actually exists in the bucket.
    const checkExists = async (path: string | null): Promise<boolean> => {
      if (!path) return false;
      const slash = path.lastIndexOf("/");
      const dir = slash >= 0 ? path.slice(0, slash) : "";
      const name = slash >= 0 ? path.slice(slash + 1) : path;
      const { data: list } = await supabaseAdmin.storage.from("legal-recordings").list(dir, { search: name, limit: 100 });
      return !!list?.some((f) => f.name === name);
    };

    return Promise.all(
      rows.map(async (r: any) => ({
        ...r,
        video_ok: await checkExists(r.video_path),
        audio_ok: await checkExists(r.audio_path),
      })),
    ) as Promise<AdminApproval[]>;
  });

// Admin-only: signed URL to play/download a stored recording (video or audio).
export const adminApprovalMediaUrl = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ approvalId: z.string().uuid(), kind: z.enum(["video", "audio"]) }).parse(d))
  .handler(async ({ context, data }): Promise<{ url: string }> => {
    const { supabase, userId } = context;
    await assertAdmin(supabase, userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: row, error } = await supabaseAdmin
      .from("legal_approvals").select("video_path,audio_path").eq("id", data.approvalId).maybeSingle();
    if (error || !row) throw new Error("Gravação não encontrada.");
    const path = data.kind === "video" ? row.video_path : row.audio_path;
    if (!path) throw new Error("Arquivo não disponível para esta gravação.");
    const { data: signed, error: sErr } = await supabaseAdmin.storage
      .from("legal-recordings").createSignedUrl(path, 60 * 60);
    if (sErr || !signed?.signedUrl) throw new Error(sErr?.message ?? "Não foi possível gerar o link do arquivo.");
    return { url: signed.signedUrl };
  });

// Admin-only: delete an approval session and its stored files.
export const adminDeleteApproval = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ approvalId: z.string().uuid() }).parse(d))
  .handler(async ({ context, data }): Promise<{ ok: true }> => {
    const { supabase, userId } = context;
    await assertAdmin(supabase, userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: row } = await supabaseAdmin
      .from("legal_approvals").select("video_path,audio_path").eq("id", data.approvalId).maybeSingle();
    const paths = [row?.video_path, row?.audio_path].filter(Boolean) as string[];
    if (paths.length) await supabaseAdmin.storage.from("legal-recordings").remove(paths);
    const { error } = await supabaseAdmin.from("legal_approvals").delete().eq("id", data.approvalId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });


export const getApprovalByToken = createServerFn({ method: "GET" })
  .inputValidator((d) => z.object({ token: z.string().min(8).max(120) }).parse(d))
  .handler(async ({ data }): Promise<GuestApproval> => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: row } = await supabaseAdmin
      .from("legal_approvals")
      .select("nome_completo, consultant_email, status")
      .eq("token", data.token)
      .maybeSingle();
    if (!row) return { ok: false, nome_completo: null, consultant_email: null, status: null };
    return { ok: true, nome_completo: row.nome_completo, consultant_email: row.consultant_email, status: row.status };
  });

export const aiTranscribeApproval = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ approvalId: z.string().uuid() }).parse(d))
  .handler(async ({ context, data }): Promise<{ transcricao: string; resumo: string }> => {
    const { supabase, userId } = context;
    await assertAdmin(supabase, userId);

    const apiKey = process.env.LOVABLE_API_KEY;
    if (!apiKey) throw new Error("LOVABLE_API_KEY não configurada.");

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: row, error } = await supabaseAdmin
      .from("legal_approvals")
      .select("*")
      .eq("id", data.approvalId)
      .maybeSingle();
    if (error || !row) throw new Error("Gravação não encontrada.");

    const path = row.audio_path || row.video_path;
    if (!path) throw new Error("Esta gravação não possui arquivo de áudio/vídeo.");

    const dl = await supabaseAdmin.storage.from("legal-recordings").download(path);
    if (dl.error || !dl.data) throw new Error("Não foi possível baixar o arquivo da gravação.");

    const buf = new Uint8Array(await dl.data.arrayBuffer());
    let binary = "";
    for (let i = 0; i < buf.length; i += 8192) binary += String.fromCharCode(...buf.subarray(i, i + 8192));
    const base64 = btoa(binary);
    const fmt = path.endsWith(".ogg") ? "ogg" : path.endsWith(".wav") ? "wav" : path.endsWith(".mp3") ? "mp3" : "webm";

    const prompt =
      "Você recebeu o áudio de uma confirmação jurídica de operação de crédito entre uma consultora e um cliente. " +
      "Transcreva integralmente a conversa em português e gere um resumo objetivo destacando: dados confirmados (nome, CPF, banco, operação, valores) e se o cliente autorizou a continuidade da operação. " +
      'Responda SOMENTE em JSON no formato {"transcricao":"...","resumo":"..."}.';

    const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          {
            role: "user",
            content: [
              { type: "text", text: prompt },
              { type: "input_audio", input_audio: { data: base64, format: fmt } },
            ],
          },
        ],
      }),
    });

    if (res.status === 429) throw new Error("Limite de uso da IA atingido. Tente novamente em instantes.");
    if (res.status === 402) throw new Error("Créditos de IA esgotados. Adicione créditos no workspace.");
    if (!res.ok) throw new Error(`Falha na IA (${res.status}): ${await res.text()}`);

    const json = await res.json();
    const content: string = json?.choices?.[0]?.message?.content ?? "";
    let transcricao = content;
    let resumo = "";
    try {
      const match = content.match(/\{[\s\S]*\}/);
      const parsed = JSON.parse(match ? match[0] : content);
      transcricao = parsed.transcricao ?? content;
      resumo = parsed.resumo ?? "";
    } catch { /* keep raw content as transcription */ }

    await supabaseAdmin
      .from("legal_approvals")
      .update({ transcricao, resumo })
      .eq("id", data.approvalId);

    return { transcricao, resumo };
  });
