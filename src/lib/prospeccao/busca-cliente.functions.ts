// Busca unificada de cliente por CPF ou nome nas três bases:
// leads da prospecção, tomadores AL e recém promovidos (Diário Oficial).
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { formatCpf, normalizeCpf } from "@/lib/cpf";

const LIMITE = 50;

export type LeadAchado = {
  id: string;
  nome: string;
  cpf: string | null;
  telefone: string | null;
  cidade: string | null;
  situacao: string | null;
  status: string;
  orcamento: number | null;
  consultant_id: string | null;
  responsavel: string | null;
};

export type TomadorAchado = {
  id: string;
  nome: string;
  documento: string;
  orgao: string | null;
  cargo: string | null;
  margemEmprestimo: number | null;
  margemCartao: number | null;
  responsavel: string | null;
  status: string | null;
};

export type PromovidoAchado = {
  id: string;
  nome: string;
  cargo: string | null;
  orgao: string | null;
  dataPromocao: string | null;
  responsavel: string | null;
  status: string | null;
};

export type BuscaClienteResultado = {
  tipo: "cpf" | "nome";
  termo: string;
  cpfNormalizado: string | null;
  leads: LeadAchado[];
  tomadores: TomadorAchado[];
  promovidos: PromovidoAchado[];
  truncado: { leads: boolean; tomadores: boolean; promovidos: boolean };
};

/** Variantes de gravação do CPF: só dígitos (com zeros à frente) e formatado. */
function variantesCpf(digitos: string): string[] {
  const cheio = digitos.padStart(11, "0");
  const set = new Set<string>([cheio, formatCpf(cheio), digitos]);
  return [...set];
}

export const buscarCliente = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) =>
    z.object({ termo: z.string().trim().min(3).max(120) }).parse(data),
  )
  .handler(async ({ data }): Promise<BuscaClienteResultado> => {
    const termo = data.termo.trim();
    const digitos = normalizeCpf(termo);
    const soNumeros = /^[\d.\-/\s]+$/.test(termo);
    const ehCpf = soNumeros && digitos.length >= 8 && digitos.length <= 11;
    const cpfCheio = ehCpf ? digitos.padStart(11, "0") : null;
    const variantes = ehCpf ? variantesCpf(digitos) : [];
    const like = `%${termo.replace(/[%_]/g, "")}%`;

    // Decisão de produto: toda consultora pode localizar qualquer pessoa da
    // base (para não abordar quem já é de outra), então a leitura é ampla.
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const leadsQ = (() => {
      let q = supabaseAdmin
        .from("prospect_leads")
        .select("id,nome,cpf,telefone,cidade,situacao,status,orcamento,consultant_id")
        .limit(LIMITE);
      q = ehCpf ? q.in("cpf", variantes) : q.ilike("nome", like).order("nome");
      return q;
    })();

    const tomadoresQ = (() => {
      let q = supabaseAdmin
        .from("tomadores_al")
        .select(
          "id,nome,documento,orgao,descricao_cargo,margem_disp_emprestimo,margem_disp_cartao_credito,consultora_responsavel,status_abordagem",
        )
        .limit(LIMITE);
      q = ehCpf ? q.in("documento", variantes) : q.ilike("nome", like).order("nome");
      return q;
    })();

    const promovidosQ = (() => {
      let q = supabaseAdmin
        .from("do_registros")
        .select(
          "id,nome_servidor,nome_completo,cargo_promovido,cargo_atual,orgao,orgao_lotacao,data_promocao,data_publicacao,consultora_responsavel,status_abordagem,cpf_confirmado",
        )
        .limit(LIMITE);
      if (ehCpf && cpfCheio) {
        q = q.or(`cpf_confirmado.eq.${cpfCheio},cpf_confirmado.eq.${formatCpf(cpfCheio)}`);
      } else {
        q = q.or(`nome_servidor.ilike.${like},nome_completo.ilike.${like}`);
      }
      return q;
    })();

    const [leadsR, tomadoresR, promovidosR] = await Promise.all([leadsQ, tomadoresQ, promovidosQ]);

    if (leadsR.error) throw new Error(leadsR.error.message);
    if (tomadoresR.error) throw new Error(tomadoresR.error.message);
    if (promovidosR.error) throw new Error(promovidosR.error.message);

    const leadsRows = leadsR.data ?? [];

    // Nome da consultora responsável dos leads (e-mail da conta).
    const responsavelPorId = new Map<string, string>();
    const ids = [...new Set(leadsRows.map((l) => l.consultant_id).filter(Boolean))] as string[];
    if (ids.length) {
      const { data: profs } = await supabaseAdmin
        .from("profiles")
        .select("user_id,nome_completo,email")
        .in("user_id", ids);
      (profs ?? []).forEach((p) => {
        responsavelPorId.set(p.user_id, p.nome_completo || p.email || "—");
      });
    }

    return {
      tipo: ehCpf ? "cpf" : "nome",
      termo,
      cpfNormalizado: cpfCheio ? formatCpf(cpfCheio) : null,
      leads: leadsRows.map((l) => ({
        id: l.id,
        nome: l.nome,
        cpf: l.cpf ? formatCpf(l.cpf) : null,
        telefone: l.telefone ?? null,
        cidade: l.cidade ?? null,
        situacao: l.situacao ?? null,
        status: l.status,
        orcamento: l.orcamento ?? null,
        consultant_id: l.consultant_id ?? null,
        responsavel: l.consultant_id ? responsavelPorId.get(l.consultant_id) ?? null : null,
      })),
      tomadores: (tomadoresR.data ?? []).map((t) => ({
        id: t.id,
        nome: t.nome,
        documento: formatCpf(t.documento),
        orgao: t.orgao ?? null,
        cargo: t.descricao_cargo ?? null,
        margemEmprestimo: t.margem_disp_emprestimo ?? null,
        margemCartao: t.margem_disp_cartao_credito ?? null,
        responsavel: t.consultora_responsavel ?? null,
        status: t.status_abordagem ?? null,
      })),
      promovidos: (promovidosR.data ?? []).map((r) => ({
        id: r.id,
        nome: r.nome_completo || r.nome_servidor,
        cargo: r.cargo_promovido || r.cargo_atual || null,
        orgao: r.orgao_lotacao || r.orgao || null,
        dataPromocao: r.data_promocao || r.data_publicacao || null,
        responsavel: r.consultora_responsavel ?? null,
        status: r.status_abordagem ?? null,
      })),
      truncado: {
        leads: leadsRows.length >= LIMITE,
        tomadores: (tomadoresR.data ?? []).length >= LIMITE,
        promovidos: (promovidosR.data ?? []).length >= LIMITE,
      },
    };
  });
