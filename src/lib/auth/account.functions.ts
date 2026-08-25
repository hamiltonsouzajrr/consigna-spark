import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { isValidCpf, normalizeCpf } from "@/lib/cpf";

const cpfField = z
  .string()
  .transform((v) => normalizeCpf(v))
  .refine((v) => isValidCpf(v), { message: "CPF inválido." });

const signUpSchema = z.object({
  nome: z.string().trim().min(3, "Informe o nome completo.").max(120),
  cpf: cpfField,
  email: z.string().trim().toLowerCase().email("E-mail inválido.").max(255),
  password: z.string().min(8, "A senha deve ter no mínimo 8 caracteres.").max(72),
});

export function maskEmail(email: string): string {
  const [user = "", domain = ""] = email.split("@");
  const head = user.slice(0, 2);
  return `${head}${"•".repeat(Math.max(2, user.length - 2))}@${domain}`;
}

/**
 * Cria a conta garantindo um único cadastro por CPF. Pública por natureza
 * (tela de cadastro), com validação rígida de entrada.
 */
export const signUpWithCpf = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => signUpSchema.parse(input))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: existing, error: cpfErr } = await supabaseAdmin
      .from("profiles")
      .select("id")
      .eq("cpf", data.cpf)
      .maybeSingle();
    if (cpfErr) throw new Error("Não foi possível validar o CPF agora. Tente novamente.");
    if (existing) {
      throw new Error(
        "Já existe uma conta cadastrada para este CPF. Use 'Esqueci minha senha' para recuperar o acesso.",
      );
    }

    const { data: created, error: createErr } = await supabaseAdmin.auth.admin.createUser({
      email: data.email,
      password: data.password,
      email_confirm: true,
      user_metadata: { nome_completo: data.nome, cpf: data.cpf },
    });

    if (createErr || !created?.user) {
      const msg = (createErr?.message ?? "").toLowerCase();
      if (msg.includes("already") || msg.includes("registered") || msg.includes("exists")) {
        throw new Error(
          "Já existe uma conta com este e-mail. Use 'Esqueci minha senha' para recuperar o acesso.",
        );
      }
      throw new Error(createErr?.message ?? "Não foi possível criar a conta.");
    }

    const { error: profErr } = await supabaseAdmin.from("profiles").insert({
      user_id: created.user.id,
      nome_completo: data.nome,
      cpf: data.cpf,
      email: data.email,
    });

    if (profErr) {
      // Evita conta órfã sem CPF vinculado.
      await supabaseAdmin.auth.admin.deleteUser(created.user.id);
      throw new Error(
        "Já existe uma conta cadastrada para este CPF. Use 'Esqueci minha senha' para recuperar o acesso.",
      );
    }

    return { ok: true as const };
  });

/**
 * Descobre o e-mail vinculado a um CPF para o fluxo de recuperação de senha.
 * Retorna apenas uma versão mascarada — nunca o e-mail completo.
 */
export const resolveResetEmailByCpf = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => z.object({ cpf: cpfField }).parse(input))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: row } = await supabaseAdmin
      .from("profiles")
      .select("email")
      .eq("cpf", data.cpf)
      .maybeSingle();

    if (!row?.email) return { found: false as const, emailMasked: null };
    return { found: true as const, emailMasked: maskEmail(row.email) };
  });

/**
 * Envia o link de redefinição de senha para o e-mail vinculado ao CPF.
 * O e-mail completo nunca é devolvido ao cliente.
 */
export const sendResetByCpf = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) =>
    z.object({ cpf: cpfField, redirectTo: z.string().url().max(500) }).parse(input),
  )
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: row } = await supabaseAdmin
      .from("profiles")
      .select("email")
      .eq("cpf", data.cpf)
      .maybeSingle();

    if (!row?.email) return { found: false as const, emailMasked: null };

    await supabaseAdmin.auth.resetPasswordForEmail(row.email, { redirectTo: data.redirectTo });
    return { found: true as const, emailMasked: maskEmail(row.email) };
  });

/** Perfil do usuário logado (nome + CPF). */
export const getMyProfile = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data } = await context.supabase
      .from("profiles")
      .select("nome_completo, cpf, email")
      .eq("user_id", context.userId)
      .maybeSingle();
    return data ?? null;
  });

/** Completa o cadastro de contas antigas que ainda não têm CPF vinculado. */
export const completeMyProfile = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({ nome: z.string().trim().min(3).max(120), cpf: cpfField }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: mine } = await supabaseAdmin
      .from("profiles")
      .select("id")
      .eq("user_id", context.userId)
      .maybeSingle();
    if (mine) return { ok: true as const };

    const { data: taken } = await supabaseAdmin
      .from("profiles")
      .select("id")
      .eq("cpf", data.cpf)
      .maybeSingle();
    if (taken) throw new Error("Este CPF já está vinculado a outra conta.");

    const { error } = await supabaseAdmin.from("profiles").insert({
      user_id: context.userId,
      nome_completo: data.nome,
      cpf: data.cpf,
      email: (context.claims as { email?: string }).email ?? null,
    });
    if (error) throw new Error("Este CPF já está vinculado a outra conta.");

    return { ok: true as const };
  });
