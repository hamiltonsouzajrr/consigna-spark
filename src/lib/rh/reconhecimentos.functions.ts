// Reconhecimentos (recognitions) — readable by any authenticated user,
// writable only by administrators (RH/admin). Includes an optional display
// period that makes a recognition pop up for everyone while active.

import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

async function assertAdmin(supabase: any, userId: string) {
  const { data, error } = await supabase.rpc("has_role", { _user_id: userId, _role: "admin" });
  if (error) throw new Error(error.message);
  if (!data) throw new Error("Acesso restrito a administradores.");
}

// Catálogo de reconhecimentos organizados por categoria.
export const CATEGORIAS_RECONHECIMENTO: { categoria: string; titulos: string[] }[] = [
  {
    categoria: "Resultados e Vendas",
    titulos: [
      "🥇 Primeira Venda do Dia",
      "🏆 Venda Mais Alta da Semana",
      "🏆 Maior Produção da Semana",
      "🏆 Maior Produção do Mês",
      "🏆 Recordista de Conversões",
      "🏆 Destaque Comercial",
      "🏆 Meta Batida com Excelência",
      "🏆 Campeão de Resultados",
      "🏆 Top Performer",
    ],
  },
  {
    categoria: "Comportamento e Cultura",
    titulos: [
      "🏆 Espírito de Dono",
      "🏆 Atitude que Faz Acontecer",
      "🏆 Exemplo de Comprometimento",
      "🏆 Orgulho Positive",
      "🏆 Mentalidade Vencedora",
      "🏆 Profissional de Alta Performance",
      "🏆 Referência da Equipe",
      "🏆 Postura Profissional",
    ],
  },
  {
    categoria: "Atendimento e Relacionamento",
    titulos: [
      "🏆 Atendimento de Excelência",
      "🏆 Melhor Experiência do Cliente",
      "🏆 Construtor de Confiança",
      "🏆 Mestre do Follow-up",
      "🏆 Relacionamento que Gera Resultados",
      "🏆 Voz da Excelência",
    ],
  },
  {
    categoria: "Velocidade e Eficiência",
    titulos: [
      "🏆 Agilidade na Negociação",
      "🏆 Resposta Relâmpago",
      "🏆 Eficiência Operacional",
      "🏆 Mestre da Execução",
      "🏆 Resolução Mais Rápida",
      "🏆 Foco e Agilidade",
    ],
  },
  {
    categoria: "Desenvolvimento Pessoal",
    titulos: [
      "🏆 Evolução da Semana",
      "🏆 Superação do Mês",
      "🏆 Destaque em Aprendizado",
      "🏆 Evolução Contínua",
      "🏆 Crescimento Exponencial",
      "🏆 Mentalidade de Crescimento",
    ],
  },
  {
    categoria: "Trabalho em Equipe",
    titulos: [
      "🏆 Parceiro de Ouro",
      "🏆 Pilar da Equipe",
      "🏆 Líder Pelo Exemplo",
      "🏆 Colaboração que Inspira",
      "🏆 União que Gera Resultado",
      "🏆 Suporte de Excelência",
    ],
  },
  {
    categoria: "Categorias Diferenciadas",
    titulos: [
      "🏆 Sangue nos Olhos",
      "🏆 Faca na Caveira das Vendas",
      "🏆 Não Para Até Fechar",
      "🏆 Caçador de Oportunidades",
      "🏆 Máquina de Resultados",
      "🏆 Consistência de Ferro",
      "🏆 Resiliência Comercial",
      "🏆 Imparável",
      "🏆 Fora da Curva",
      "🏆 Lenda da Operação",
    ],
  },
  {
    categoria: "Ranking Mensal Grupo Positive",
    titulos: [
      "🥇 Espírito de Dono",
      "🥈 Venda Mais Alta",
      "🥉 Maior Produção",
      "🏅 Excelência no Atendimento",
      "🏅 Evolução do Mês",
    ],
  },
];

export const TIPOS = CATEGORIAS_RECONHECIMENTO.flatMap((c) => c.titulos);

export const PERIODICIDADES = [
  { value: "pontual", label: "Pontual" },
  { value: "diario", label: "Diário" },
  { value: "semanal", label: "Semanal" },
  { value: "mensal", label: "Mensal" },
] as const;

export type Reconhecimento = {
  id: string;
  de: string;
  para: string;
  tipo: string;
  periodicidade: string;
  mensagem: string;
  data: string;
  periodo_inicio: string | null;
  periodo_fim: string | null;
  popup: boolean;
};

export type ReconhecimentosResult = {
  isAdmin: boolean;
  items: Reconhecimento[];
};

export const getReconhecimentos = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<ReconhecimentosResult> => {
    const { supabase, userId } = context;
    const { data: isAdmin } = await supabase.rpc("has_role", { _user_id: userId, _role: "admin" });
    // Recognition is intentionally visible to all staff (popup + portal feed).
    // The table's direct read access is locked to admins, so we read it here
    // through the service-role client inside this authenticated server function.
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data, error } = await supabaseAdmin
      .from("rh_reconhecimentos")
      .select("id, de, para, tipo, periodicidade, mensagem, data, periodo_inicio, periodo_fim, popup")
      .order("data", { ascending: false });
    if (error) throw new Error(error.message);
    return { isAdmin: !!isAdmin, items: (data ?? []) as Reconhecimento[] };
  });

const schema = z.object({
  id: z.string().uuid().optional(),
  de: z.string().min(1).max(120),
  para: z.string().min(1).max(120),
  tipo: z.string().min(1).max(80),
  periodicidade: z.enum(["pontual", "diario", "semanal", "mensal"]).optional(),
  mensagem: z.string().min(1).max(600),
  data: z.string().min(1),
  periodo_inicio: z.string().nullable().optional(),
  periodo_fim: z.string().nullable().optional(),
  popup: z.boolean().optional(),
});

export const saveReconhecimento = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => schema.parse(d))
  .handler(async ({ context, data }): Promise<{ ok: true }> => {
    await assertAdmin(context.supabase, context.userId);
    const row = {
      de: data.de,
      para: data.para,
      tipo: data.tipo,
      periodicidade: data.periodicidade ?? "pontual",
      mensagem: data.mensagem,
      data: data.data,
      periodo_inicio: data.periodo_inicio || null,
      periodo_fim: data.periodo_fim || null,
      popup: data.popup ?? true,
    };
    const q = data.id
      ? context.supabase.from("rh_reconhecimentos").update(row).eq("id", data.id)
      : context.supabase.from("rh_reconhecimentos").insert(row);
    const { error } = await q;
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const deleteReconhecimento = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ context, data }): Promise<{ ok: true }> => {
    await assertAdmin(context.supabase, context.userId);
    const { error } = await context.supabase.from("rh_reconhecimentos").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
