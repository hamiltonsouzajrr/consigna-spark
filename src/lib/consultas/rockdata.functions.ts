// Consulta de servidor: procura primeiro no nosso banco (90 dias) e só depois na RockData.
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { normalizeCpf, isValidCpf } from "@/lib/cpf";
import type { RockdataFicha, RockdataPessoaLista, RockdataTelefone } from "@/lib/consultas/rockdata.server";

const DIAS_VALIDADE = 90;

type TipoBusca = "cpf" | "nome" | "telefone";

export type MargemCarteira = {
  origem: "conversao" | "planilha";
  tipo: string | null;
  margemUsada: number | null;
  margemRestante: number | null;
  prazo: number | null;
  atualizadoEm: string | null;
};

export type ConsultaResultado = {
  tipo: TipoBusca;
  origem: "banco" | "rockdata";
  cpf: string | null;
  consultadoEm: string | null;
  ficha: RockdataFicha | null;
  pessoas: RockdataPessoaLista[];
  mensagem: string | null;
  margensCarteira?: MargemCarteira[];
};

export type ConsultaHistoricoItem = {
  id: string;
  termo: string;
  tipo: string;
  origem: string;
  cpf: string | null;
  nome: string | null;
  criadoEm: string;
};

export const consultarServidor = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) =>
    z
      .object({
        termo: z.string().trim().min(3).max(120),
        forcarAtualizacao: z.boolean().optional().default(false),
      })
      .parse(data),
  )
  .handler(async ({ data, context }): Promise<ConsultaResultado> => {
    const termo = data.termo.trim();
    const digitos = normalizeCpf(termo);
    const soNumeros = /^[\d.\-()/+\s]+$/.test(termo);
    // 11 dígitos com CPF válido → CPF. Demais números com 10–11 dígitos → telefone (DDD + número).
    const ehCpf = soNumeros && digitos.length === 11 && isValidCpf(digitos);
    const ehTelefone = !ehCpf && soNumeros && digitos.length >= 10 && digitos.length <= 13;
    const cpf = ehCpf ? digitos : null;
    const telefone = ehTelefone ? rockdataNormalize(digitos) : null;

    function rockdataNormalize(d: string): string {
      return d.length > 11 && d.startsWith("55") ? d.slice(2) : d;
    }

    if (soNumeros && !ehCpf && !ehTelefone) {
      throw new Error(
        "Número incompleto. Para buscar por telefone, digite o DDD + número (ex.: 82999998888).",
      );
    }

    const tipoBusca: TipoBusca = ehCpf ? "cpf" : ehTelefone ? "telefone" : "nome";

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const rockdata = await import("@/lib/consultas/rockdata.server");

    const carregarMargensCarteira = async (cpfCliente: string): Promise<MargemCarteira[]> => {
      const variantes = [cpfCliente, cpfCliente.replace(/^(\d{3})(\d{3})(\d{3})(\d{2})$/, "$1.$2.$3-$4")];
      const [{ data: conversoes }, { data: contratos }] = await Promise.all([
        supabaseAdmin
          .from("prospect_conversoes")
          .select("margem_usada,margem_restante_valor,tipo_margem,prazo,updated_at,data_operacao")
          .eq("user_id", context.userId)
          .in("cpf", variantes)
          .order("data_operacao", { ascending: false })
          .limit(5),
        supabaseAdmin
          .from("esteira_contratos")
          .select("id,prazo,data_venda")
          .eq("consultant_id", context.userId)
          .in("cpf", variantes)
          .is("removido_em", null)
          .order("data_venda", { ascending: false })
          .limit(5),
      ]);
      const contratoIds = (contratos ?? []).map((c) => c.id);
      const { data: ajustes } = contratoIds.length
        ? await supabaseAdmin
            .from("esteira_ajustes_consultora")
            .select("contrato_id,margem_usada,margem_restante_valor,prazo,updated_at")
            .eq("consultant_id", context.userId)
            .in("contrato_id", contratoIds)
        : { data: [] };
      const contratoPorId = new Map((contratos ?? []).map((c) => [c.id, c]));
      return [
        ...(conversoes ?? []).map((c) => ({
          origem: "conversao" as const,
          tipo: c.tipo_margem ?? null,
          margemUsada: c.margem_usada != null ? Number(c.margem_usada) : null,
          margemRestante: c.margem_restante_valor != null ? Number(c.margem_restante_valor) : null,
          prazo: c.prazo ?? null,
          atualizadoEm: c.updated_at ?? c.data_operacao ?? null,
        })),
        ...(ajustes ?? []).map((a) => ({
          origem: "planilha" as const,
          tipo: null,
          margemUsada: a.margem_usada != null ? Number(a.margem_usada) : null,
          margemRestante: a.margem_restante_valor != null ? Number(a.margem_restante_valor) : null,
          prazo: a.prazo ?? contratoPorId.get(a.contrato_id)?.prazo ?? null,
          atualizadoEm: a.updated_at ?? contratoPorId.get(a.contrato_id)?.data_venda ?? null,
        })),
      ].filter((m) => m.margemUsada != null || m.margemRestante != null);
    };

    const registrar = async (origem: string, nome: string | null) => {
      await supabaseAdmin.from("rockdata_consultas_log").insert({
        user_id: context.userId,
        termo,
        tipo: tipoBusca,
        origem,
        cpf,
        nome,
      });
    };

    const localParaPessoa = (r: { cpf: string; nome: string | null; resultado: unknown }) => {
      const f = r.resultado as unknown as RockdataFicha | null;
      return {
        cpf: r.cpf,
        nome: r.nome ?? f?.pessoa?.nome ?? "",
        idade: f?.pessoa?.idade ?? null,
        bairro: null,
        cidade: null,
        uf: null,
      };
    };

    // Busca por telefone: primeiro nas fichas já salvas; depois na RockData.
    if (telefone) {
      const { data: locaisTel } = await supabaseAdmin
        .from("rockdata_consultas")
        .select("cpf,nome,resultado")
        .contains("telefones", [telefone])
        .order("nome")
        .limit(50);

      if (locaisTel?.length) {
        await registrar("banco", null);
        return {
          tipo: "telefone",
          origem: "banco",
          cpf: null,
          consultadoEm: null,
          ficha: null,
          pessoas: locaisTel.map(localParaPessoa),
          mensagem: "Encontrado nas consultas já salvas no sistema, sem nova consulta.",
        };
      }

      try {
        const pessoas = await rockdata.consultarPorTelefone(telefone);
        await registrar("rockdata", null);
        return {
          tipo: "telefone",
          origem: "rockdata",
          cpf: null,
          consultadoEm: null,
          ficha: null,
          pessoas,
          mensagem: pessoas.length ? null : "Nenhuma pessoa encontrada com esse telefone.",
        };
      } catch (e) {
        console.error("[rockdata] busca por telefone falhou:", e);
        await registrar("banco", null);
        return {
          tipo: "telefone",
          origem: "banco",
          cpf: null,
          consultadoEm: null,
          ficha: null,
          pessoas: [],
          mensagem:
            "A RockData está fora do ar e esse telefone ainda não está em nenhuma ficha salva no sistema.",
        };
      }
    }

    // Busca por nome: lista de pessoas (sempre na RockData, é uma busca ampla).
    if (!cpf) {
      try {
        const pessoas = await rockdata.consultarPorNome(termo);
        await registrar("rockdata", termo);
        return {
          tipo: "nome",
          origem: "rockdata",
          cpf: null,
          consultadoEm: null,
          ficha: null,
          pessoas,
          mensagem: pessoas.length ? null : "Nenhuma pessoa encontrada com esse nome.",
        };
      } catch (e) {
        console.error("[rockdata] busca por nome falhou, usando banco interno:", e);
        const busca = termo.replace(/[%_,()]/g, " ").trim();
        const { data: locais } = await supabaseAdmin
          .from("rockdata_consultas")
          .select("cpf,nome,resultado")
          .ilike("nome", `%${busca}%`)
          .order("nome")
          .limit(50);
        const pessoas: RockdataPessoaLista[] = (locais ?? []).map((r) => {
          const f = r.resultado as unknown as RockdataFicha | null;
          return {
            cpf: r.cpf,
            nome: r.nome ?? f?.pessoa?.nome ?? "",
            idade: f?.pessoa?.idade ?? null,
            bairro: null,
            cidade: null,
            uf: null,
          };
        });
        await registrar("banco", termo);
        return {
          tipo: "nome",
          origem: "banco",
          cpf: null,
          consultadoEm: null,
          ficha: null,
          pessoas,
          mensagem: pessoas.length
            ? "A RockData está fora do ar; mostrando pessoas já salvas no sistema."
            : "A RockData está fora do ar e ninguém com esse nome foi salvo no sistema ainda.",
        };
      }
    }

    // Busca por CPF: primeiro no banco.
    const { data: cache } = await supabaseAdmin
      .from("rockdata_consultas")
      .select("cpf,nome,resultado,consultado_em")
      .eq("cpf", cpf)
      .maybeSingle();

    const limite = Date.now() - DIAS_VALIDADE * 24 * 60 * 60 * 1000;
    const cacheValido =
      !!cache && new Date(cache.consultado_em).getTime() > limite && !data.forcarAtualizacao;

    if (cacheValido) {
      await registrar("banco", cache.nome ?? null);
      return {
        tipo: "cpf",
        origem: "banco",
        cpf,
        consultadoEm: cache.consultado_em,
        ficha: await rankearTelefones(cache.resultado as unknown as RockdataFicha),
        pessoas: [],
        mensagem: null,
        margensCarteira: await carregarMargensCarteira(cpf),
      };
    }

    try {
      const ficha = await rockdata.consultarPorCpf(cpf);
      const agora = new Date().toISOString();
      await supabaseAdmin.from("rockdata_consultas").upsert(
        {
          cpf,
          nome: ficha.pessoa.nome,
          telefones: rockdata.telefonesDaFicha(ficha),
          resultado: JSON.parse(JSON.stringify(ficha)),
          consultado_em: agora,
          consultado_por: context.userId,
        },
        { onConflict: "cpf" },
      );
      await registrar("rockdata", ficha.pessoa.nome ?? null);
      return {
        tipo: "cpf",
        origem: "rockdata",
        cpf,
        consultadoEm: agora,
        ficha: await rankearTelefones(ficha),
        pessoas: [],
        mensagem: null,
        margensCarteira: await carregarMargensCarteira(cpf),
      };
    } catch (e) {
      console.error("[rockdata] consulta por CPF falhou:", e);
      // Se a RockData falhou mas existe consulta antiga, devolve o que temos.
      if (cache) {
        await registrar("banco", cache.nome ?? null);
        return {
          tipo: "cpf",
          origem: "banco",
          cpf,
          consultadoEm: cache.consultado_em,
          ficha: await rankearTelefones(cache.resultado as unknown as RockdataFicha),
          pessoas: [],
          mensagem: "A RockData não respondeu agora; mostrando a última consulta salva.",
          margensCarteira: await carregarMargensCarteira(cpf),
        };
      }
      throw new Error(
        e instanceof rockdata.RockdataError
          ? e.message
          : "Não foi possível consultar na RockData agora. Tente novamente em alguns minutos.",
      );
    }
  });

export const listarConsultasRecentes = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<ConsultaHistoricoItem[]> => {
    const { data } = await context.supabase
      .from("rockdata_consultas_log")
      .select("id,termo,tipo,origem,cpf,nome,created_at")
      .eq("user_id", context.userId)
      .order("created_at", { ascending: false })
      .limit(20);
    return (data ?? []).map((r) => ({
      id: r.id,
      termo: r.termo,
      tipo: r.tipo,
      origem: r.origem,
      cpf: r.cpf ?? null,
      nome: r.nome ?? null,
      criadoEm: r.created_at,
    }));
  });

/** Ordena os telefones da ficha por confiança, somando sinais do nosso próprio histórico. */
async function rankearTelefones(ficha: RockdataFicha): Promise<RockdataFicha> {
  const { pontuarTelefone } = await import("@/lib/consultas/telefone-score");
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const base: RockdataTelefone[] =
    ficha.telefonesDetalhe?.length
      ? ficha.telefonesDetalhe
      : ficha.telefones.map((numero) => ({
          numero, tipo: null, whatsapp: false, restricao: false, qualificacao: 0, score: 0, nivel: "duvidoso" as const, sinais: [],
        }));
  const dig = (v: string) => {
    let d = v.replace(/\D/g, "");
    if (d.length > 11 && d.startsWith("55")) d = d.slice(2);
    return d;
  };
  const numeros = [...new Set(base.map((t) => dig(t.numero)).filter((d) => d.length >= 8))];
  const respondeu = new Set<string>();
  const contatado = new Set<string>();
  const informado = new Set<string>();
  if (numeros.length) {
    try {
      const { data: leads } = await supabaseAdmin
        .from("prospect_leads")
        .select("id,telefone,telefones,respondeu_whatsapp,last_contact_at")
        .or(`telefone.in.(${numeros.join(",")}),telefones.ov.{${numeros.join(",")}}`)
        .limit(100);
      for (const l of leads ?? []) {
        const tels = [l.telefone, ...((l.telefones as string[] | null) ?? [])].filter(Boolean).map((x) => dig(String(x)));
        for (const n of tels) {
          if (!numeros.includes(n)) continue;
          if (l.respondeu_whatsapp) respondeu.add(n);
          if (l.last_contact_at) contatado.add(n);
        }
      }
    } catch (e) {
      console.error("[rockdata] sinais do CRM falharam:", e);
    }
    try {
      const { data: toms } = await (supabaseAdmin as any)
        .from("tomadores_al")
        .select("telefones")
        .overlaps("telefones", numeros)
        .limit(50);
      for (const t of toms ?? []) for (const n of (t.telefones ?? []) as string[]) informado.add(dig(n));
    } catch {
      /* coluna opcional */
    }
  }
  const telefonesDetalhe = base
    .map((t) => {
      const d = dig(t.numero);
      return pontuarTelefone(t, {
        respondeuWhatsapp: respondeu.has(d),
        contatadoCrm: contatado.has(d),
        informadoConsultora: informado.has(d),
      });
    })
    .sort((a, b) => b.score - a.score);
  return { ...ficha, telefonesDetalhe, telefones: telefonesDetalhe.map((t) => t.numero) };
}

/** Clique em Ligar/WhatsApp na Pesquisar Cliente: conta como contato de prospecção. */
export const registrarContatoConsulta = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) =>
    z
      .object({
        cpf: z.string().regex(/^\d{11}$/),
        telefone: z.string().trim().min(8).max(20),
        kind: z.enum(["ligacao", "whatsapp"]),
      })
      .parse(data),
  )
  .handler(async ({ data, context }): Promise<{ pontos: number; motivo?: string }> => {
    const { userId } = context;
    const { adminClient, creditar, cooldownLiberado, garantirSemana } = await import(
      "@/lib/prospeccao/competicao.server"
    );
    const db = await adminClient();
    const body = `Contato pela Pesquisar Cliente (${data.kind === "ligacao" ? "ligação" : "WhatsApp"}) no número ${data.telefone}`;

    // Se o cliente já é lead desta consultora, registra no histórico do lead.
    const { data: lead } = await db
      .from("prospect_leads")
      .select("id,first_response_at")
      .eq("cpf", data.cpf)
      .eq("consultant_id", userId)
      .limit(1)
      .maybeSingle();

    const { data: log } = await db
      .from("rockdata_consultas_log")
      .insert({ user_id: userId, termo: data.telefone, tipo: "telefone", origem: data.kind, cpf: data.cpf, nome: null } as any)
      .select("id")
      .single();

    let refTabela = "rockdata_consultas_log";
    let refId = log?.id as string | undefined;
    if (lead) {
      await db.from("lead_events").insert({ lead_id: lead.id, consultant_id: userId, kind: data.kind, body } as any);
      const nowIso = new Date().toISOString();
      const patch: any = { last_contact_at: nowIso };
      if (!lead.first_response_at) patch.first_response_at = nowIso;
      await db.from("prospect_leads").update(patch).eq("id", lead.id);
      refTabela = "prospect_leads";
      refId = lead.id;
    }
    if (!refId) return { pontos: 0, motivo: "Contato registrado." };

    const semana = await garantirSemana();
    if (semana.pausada) return { pontos: 0, motivo: "Competição pausada pelo administrador." };
    if (!(await cooldownLiberado(userId))) {
      return { pontos: 0, motivo: "Contatos em sequência rápida não pontuam (intervalo mínimo de 90s)." };
    }
    const pontos = await creditar(userId, "contato", refTabela, refId, `Contato ${data.kind} (Pesquisar Cliente)`);
    return { pontos };
  });
