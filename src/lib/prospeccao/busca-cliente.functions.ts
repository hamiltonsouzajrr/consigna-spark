import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { formatCpf, isValidCpf, normalizeCpf } from "@/lib/cpf";

const LIMITE = 50;

export type MargemBusca = { tipo: string; valor: number | null };
export type ClienteBusca = {
  chave: string;
  nome: string;
  cpf: string | null;
  telefones: string[];
  endereco: string | null;
  responsavel: string | null;
  situacao: string | null;
  origens: string[];
  margens: MargemBusca[];
  leadId: string | null;
};

export type BuscaClienteResultado = {
  tipo: "cpf" | "nome" | "telefone";
  termo: string;
  resultados: ClienteBusca[];
  truncado: boolean;
};

const digits = (value: unknown) => String(value ?? "").replace(/\D/g, "");
const phone = (value: unknown) => {
  const valueDigits = digits(value);
  return valueDigits.length > 11 && valueDigits.startsWith("55") ? valueDigits.slice(2) : valueDigits;
};

function variantesCpf(value: string): string[] {
  const cheio = value.padStart(11, "0");
  return [...new Set([cheio, formatCpf(cheio), value])];
}

function textoRaw(raw: unknown, aliases: string[]): string | null {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  const normalized = new Map(
    Object.entries(raw as Record<string, unknown>).map(([key, value]) => [
      key.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]/g, ""),
      String(value ?? "").trim(),
    ]),
  );
  for (const alias of aliases) {
    const hit = normalized.get(alias);
    if (hit) return hit;
  }
  return null;
}

function enderecoRaw(raw: unknown, cidade: string | null): string | null {
  const rua = textoRaw(raw, ["endereco", "logradouro", "rua"]);
  const numero = textoRaw(raw, ["numero", "numerologradouro"]);
  const complemento = textoRaw(raw, ["complemento"]);
  const bairro = textoRaw(raw, ["bairro"]);
  const municipio = textoRaw(raw, ["cidade", "municipio"]) ?? cidade;
  const uf = textoRaw(raw, ["uf", "estado"]);
  const cep = textoRaw(raw, ["cep"]);
  const partes = [rua && numero ? `${rua}, ${numero}` : rua, complemento, bairro, municipio && uf ? `${municipio}/${uf}` : municipio, cep && `CEP ${cep}`].filter(Boolean);
  return partes.length ? partes.join(" · ") : null;
}

export const buscarCliente = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => z.object({ termo: z.string().trim().min(3).max(120) }).parse(data))
  .handler(async ({ data }): Promise<BuscaClienteResultado> => {
    const termo = data.termo.trim();
    const numeros = digits(termo);
    const somenteNumeros = /^[\d.\-/()+\s]+$/.test(termo);
    const ehCpf = somenteNumeros && numeros.length >= 8 && numeros.length <= 11 && (numeros.length < 11 || isValidCpf(numeros));
    const ehTelefone = somenteNumeros && !ehCpf && numeros.length >= 10 && numeros.length <= 13;
    const tipo = ehCpf ? "cpf" : ehTelefone ? "telefone" : "nome";
    const cpfVariantes = ehCpf ? variantesCpf(numeros) : [];
    const telefone = phone(numeros);
    const like = `%${termo.replace(/[%_,()]/g, " ").trim()}%`;
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const leadsQ = (() => {
      let q = supabaseAdmin.from("prospect_leads").select("id,nome,cpf,telefone,telefones,cidade,situacao,status,orcamento,consultant_id,raw_data").limit(LIMITE);
      if (tipo === "cpf") return q.in("cpf", cpfVariantes);
      if (tipo === "telefone") return q.or(`telefone.ilike.%${telefone}%,telefones.ov.{${telefone}}`);
      return q.ilike("nome", like).order("nome");
    })();
    const tomadoresQ = (() => {
      let q = supabaseAdmin.from("tomadores_al").select("id,nome,documento,descricao_lotacao,orgao,margem_disp_emprestimo,margem_disp_cartao_credito,margem_util_cartao_beneficio,consultora_responsavel,status_abordagem,telefones").limit(LIMITE);
      if (tipo === "cpf") return q.in("documento", cpfVariantes);
      if (tipo === "telefone") return q.overlaps("telefones", [telefone]);
      return q.ilike("nome", like).order("nome");
    })();
    const promovidosQ = (() => {
      let q = supabaseAdmin.from("do_registros").select("id,nome_servidor,nome_completo,orgao,orgao_lotacao,status_abordagem,consultora_responsavel,cpf_confirmado").limit(LIMITE);
      if (tipo === "cpf") return q.in("cpf_confirmado", cpfVariantes);
      if (tipo === "telefone") return q.limit(0);
      return q.or(`nome_servidor.ilike.${like},nome_completo.ilike.${like}`);
    })();
    const esteiraQ = (() => {
      let q = supabaseAdmin.from("esteira_contratos").select("id,nome,cpf,telefone,banco,status,consultora,consultant_id").is("removido_em", null).limit(LIMITE);
      if (tipo === "cpf") return q.in("cpf", cpfVariantes);
      if (tipo === "telefone") return q.ilike("telefone", `%${telefone}%`);
      return q.ilike("nome", like).order("nome");
    })();
    const salvasQ = (() => {
      let q = supabaseAdmin.from("rockdata_consultas").select("cpf,nome,telefones,resultado").limit(LIMITE);
      if (tipo === "cpf") return q.in("cpf", cpfVariantes);
      if (tipo === "telefone") return q.contains("telefones", [telefone]);
      return q.ilike("nome", like).order("nome");
    })();

    const [leadsR, tomadoresR, promovidosR, esteiraR, salvasR] = await Promise.all([leadsQ, tomadoresQ, promovidosQ, esteiraQ, salvasQ]);
    for (const result of [leadsR, tomadoresR, promovidosR, esteiraR, salvasR]) if (result.error) throw new Error(result.error.message);

    const leads = leadsR.data ?? [];
    const consultantIds = [...new Set([...(leads.map((row) => row.consultant_id)), ...((esteiraR.data ?? []).map((row) => row.consultant_id))].filter(Boolean))] as string[];
    const responsavelPorId = new Map<string, string>();
    if (consultantIds.length) {
      const { data: profiles } = await supabaseAdmin.from("profiles").select("user_id,nome_completo,email").in("user_id", consultantIds);
      for (const profile of profiles ?? []) responsavelPorId.set(profile.user_id, profile.nome_completo || profile.email || "—");
    }

    const pessoas = new Map<string, ClienteBusca>();
    const add = (item: Omit<ClienteBusca, "chave">) => {
      const cpf = item.cpf ? digits(item.cpf).padStart(11, "0") : null;
      const chave = cpf || `${item.nome.toLowerCase()}|${item.telefones[0] ?? ""}`;
      const current = pessoas.get(chave);
      if (!current) {
        pessoas.set(chave, { ...item, chave, cpf: cpf ? formatCpf(cpf) : null, telefones: [...new Set(item.telefones.map(phone).filter((n) => n.length >= 8))] });
        return;
      }
      current.telefones = [...new Set([...current.telefones, ...item.telefones.map(phone)].filter(Boolean))];
      current.origens = [...new Set([...current.origens, ...item.origens])];
      current.margens.push(...item.margens.filter((m) => !current.margens.some((existing) => existing.tipo === m.tipo && existing.valor === m.valor)));
      current.endereco ||= item.endereco;
      current.responsavel ||= item.responsavel;
      current.situacao ||= item.situacao;
      current.leadId ||= item.leadId;
    };

    for (const row of leads) add({ nome: row.nome, cpf: row.cpf, telefones: [row.telefone, ...(row.telefones ?? [])].filter(Boolean) as string[], endereco: enderecoRaw(row.raw_data, row.cidade), responsavel: row.consultant_id ? responsavelPorId.get(row.consultant_id) ?? null : null, situacao: row.situacao ?? row.status, origens: ["CRM"], margens: [{ tipo: "Margem da planilha", valor: row.orcamento == null ? null : Number(row.orcamento) }], leadId: row.id });
    for (const row of tomadoresR.data ?? []) add({ nome: row.nome, cpf: row.documento, telefones: row.telefones ?? [], endereco: row.descricao_lotacao ?? row.orgao ?? null, responsavel: row.consultora_responsavel ?? null, situacao: row.status_abordagem ?? null, origens: ["Tomadores AL"], margens: [{ tipo: "Empréstimo", valor: row.margem_disp_emprestimo == null ? null : Number(row.margem_disp_emprestimo) }, { tipo: "Cartão de crédito", valor: row.margem_disp_cartao_credito == null ? null : Number(row.margem_disp_cartao_credito) }, { tipo: "Cartão benefício", valor: row.margem_util_cartao_beneficio == null ? null : Number(row.margem_util_cartao_beneficio) }], leadId: null });
    for (const row of promovidosR.data ?? []) add({ nome: row.nome_completo || row.nome_servidor, cpf: row.cpf_confirmado, telefones: [], endereco: row.orgao_lotacao ?? row.orgao ?? null, responsavel: row.consultora_responsavel ?? null, situacao: row.status_abordagem ?? null, origens: ["Recém-promovidos"], margens: [], leadId: null });
    for (const row of esteiraR.data ?? []) add({ nome: row.nome, cpf: row.cpf, telefones: row.telefone ? [row.telefone] : [], endereco: null, responsavel: row.consultant_id ? responsavelPorId.get(row.consultant_id) ?? row.consultora : row.consultora, situacao: row.status ?? null, origens: ["Minha carteira"], margens: [], leadId: null });
    for (const row of salvasR.data ?? []) {
      const ficha = row.resultado as { enderecos?: string[]; pessoa?: { nome?: string } } | null;
      add({ nome: row.nome || ficha?.pessoa?.nome || "Cliente", cpf: row.cpf, telefones: row.telefones ?? [], endereco: ficha?.enderecos?.[0] ?? null, responsavel: null, situacao: null, origens: ["Ficha salva"], margens: [], leadId: null });
    }

    return { tipo, termo, resultados: [...pessoas.values()].slice(0, LIMITE), truncado: [leadsR, tomadoresR, promovidosR, esteiraR, salvasR].some((result) => (result.data?.length ?? 0) >= LIMITE) };
  });