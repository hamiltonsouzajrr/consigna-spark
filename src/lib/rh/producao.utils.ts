import { z } from "zod";

export type ProducaoRow = {
  id: string;
  consultora: string;
  departamento: string | null;
  mes: string;
  valor: number;
  contratos: number;
  created_at: string;
  updated_at: string;
};


export function mesAtual(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

export const producaoInputItem = z.object({
  consultora: z.string().min(1).max(160),
  departamento: z.string().max(160).nullable().optional(),
  mes: z.string().min(1).max(7),
  valor: z.number(),
  contratos: z.number().int(),
});
