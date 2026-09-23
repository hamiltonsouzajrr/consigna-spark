// Consulta de servidor: procura primeiro no nosso banco (90 dias) e só depois na RockData.
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { normalizeCpf, isValidCpf } from "@/lib/cpf";
import type { RockdataFicha, RockdataPessoaLista } from "@/lib/consultas/rockdata.server";

const DIAS_VALIDADE = 90;

type TipoBusca = "cpf" | "nome" | "telefone";

export type ConsultaResultado = {
  tipo: TipoBusca;
  origem: "banco" | "rockdata";
  cpf: string | null;
  consultadoEm: string | null;
  ficha: RockdataFicha | null;
  pessoas: RockdataPessoaLista[];
  mensagem: string | null;
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
        ficha: cache.resultado as unknown as RockdataFicha,
        pessoas: [],
        mensagem: null,
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
        ficha,
        pessoas: [],
        mensagem: null,
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
          ficha: cache.resultado as unknown as RockdataFicha,
          pessoas: [],
          mensagem: "A RockData não respondeu agora; mostrando a última consulta salva.",
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
