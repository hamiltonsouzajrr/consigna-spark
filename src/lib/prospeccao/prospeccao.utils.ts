import { z } from "zod";

export const leadInput = z.object({
  nome: z.string().trim().min(1).max(200),
  telefone: z.string().trim().max(40).optional().nullable(),
  telefones: z.array(z.string().trim().max(40)).max(20).optional().nullable(),
  cpf: z.string().trim().max(20).optional().nullable(),
  cidade: z.string().trim().max(120).optional().nullable(),
  origem: z.string().trim().max(60).optional().nullable(),
  orcamento: z.number().nonnegative().max(1_000_000_000_000).optional().nullable(),
  urgencia: z.enum(["alta", "media", "baixa"]).optional().nullable(),
  idade: z.number().int().min(16).max(110).optional().nullable(),
  sexo: z.string().trim().max(20).optional().nullable(),
  raw_data: z.record(z.any()).optional().nullable(),
  consultant_id: z.string().uuid().optional().nullable(),
});
