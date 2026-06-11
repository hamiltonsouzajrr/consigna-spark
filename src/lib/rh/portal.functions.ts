// Server functions for the Portal do Colaborador KPI detail screens.
// These read real data from Supabase (rh_* tables) and return the same
// `KpiDetail` DTO the UI already consumes. The admin client is imported inside
// the handler so this client-reachable module never leaks server-only code
// into the browser bundle.

import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { KpiDetail, KpiKey, PeriodKey } from "./portal";

const MESES = [
  "Jan", "Fev", "Mar", "Abr", "Mai", "Jun",
  "Jul", "Ago", "Set", "Out", "Nov", "Dez",
];

const PERIOD_MONTHS: Record<PeriodKey, number> = { "3m": 3, "6m": 6, "12m": 12 };

const brl = (v: number) =>
  v.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });

const monthLabel = (iso: string) => {
  const d = new Date(iso);
  return `${MESES[d.getUTCMonth()]}/${String(d.getUTCFullYear()).slice(2)}`;
};

const inputSchema = z.object({
  kpi: z.enum(["ferias", "banco-horas", "salario", "beneficios"]),
  period: z.enum(["3m", "6m", "12m"]),
  employeeId: z.string().uuid().optional(),
});

export const fetchKpiDetailFromDb = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => inputSchema.parse(data))
  .handler(async ({ data, context }): Promise<KpiDetail> => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { kpi, period } = data;
    const months = PERIOD_MONTHS[period];

    // Authorization: admins can read any employee; everyone else only their own
    // linked record. This guards salary/vacation/benefit/KPI data read via the
    // service-role client below (which bypasses RLS).
    const { data: isAdmin } = await context.supabase.rpc("has_role", {
      _user_id: context.userId,
      _role: "admin",
    });

    const { data: ownEmp } = await supabaseAdmin
      .from("rh_employees")
      .select("id, salary")
      .eq("user_id", context.userId)
      .maybeSingle();

    // Resolve the target employee record.
    type EmpRow = { id: string; salary: number | null };
    let employeeId = data.employeeId;
    let salary = 0;
    {
      let emp: EmpRow | null = null;
      if (!isAdmin) {
        // Non-admins may only access their own record.
        if (data.employeeId && data.employeeId !== ownEmp?.id) {
          throw new Error("Acesso negado.");
        }
        emp = (ownEmp as EmpRow | null) ?? null;
      } else if (data.employeeId) {
        const res = await supabaseAdmin
          .from("rh_employees")
          .select("id, salary")
          .eq("id", data.employeeId)
          .maybeSingle();
        if (res.error) throw new Error(res.error.message);
        emp = (res.data as EmpRow | null) ?? null;
      } else if (ownEmp) {
        emp = ownEmp as EmpRow;
      } else {
        const res = await supabaseAdmin
          .from("rh_employees")
          .select("id, salary")
          .order("created_at")
          .limit(1)
          .maybeSingle();
        emp = (res.data as EmpRow | null) ?? null;
      }
      if (!emp) throw new Error("Colaborador não encontrado.");
      employeeId = emp.id;
      salary = Number(emp.salary) || 0;
    }

    // Time series for this KPI, most recent `months` points.
    const { data: metricRows, error: metricErr } = await supabaseAdmin
      .from("rh_kpi_metrics")
      .select("ref_month, value")
      .eq("employee_id", employeeId)
      .eq("kpi", kpi)
      .order("ref_month", { ascending: true });
    if (metricErr) throw new Error(metricErr.message);

    const serie = (metricRows ?? [])
      .slice(-months)
      .map((r) => ({ mes: monthLabel(r.ref_month as string), valor: Number(r.value) }));

    const values = serie.map((s) => s.valor);
    const last = values.at(-1) ?? 0;
    const avg = values.length ? Math.round(values.reduce((a, b) => a + b, 0) / values.length) : 0;
    const max = values.length ? Math.max(...values) : 0;

    switch (kpi) {
      case "ferias": {
        const { data: reqs, error } = await supabaseAdmin
          .from("rh_vacation_requests")
          .select("tipo, status, inicio, dias")
          .eq("employee_id", employeeId)
          .order("inicio", { ascending: false });
        if (error) throw new Error(error.message);
        const list = reqs ?? [];
        const usufruidos = list
          .filter((r) => r.tipo === "Férias" && r.status === "Aprovado")
          .reduce((a, r) => a + (Number(r.dias) || 0), 0);
        return {
          key: "ferias",
          title: "Saldo de Férias",
          description: "Evolução do saldo e histórico de períodos.",
          unidade: "dias",
          resumo: [
            { label: "Saldo atual", value: `${Math.round(last)} dias` },
            { label: "Dias usufruídos", value: `${usufruidos} dias` },
            { label: "Solicitações", value: `${list.length}` },
          ],
          serie: serie.map((p) => ({ ...p, valor: Math.max(0, Math.round(p.valor)) })),
          historico: list.map((r) => ({
            data: r.inicio as string,
            descricao: `${r.tipo} (${r.status})`,
            valor: `${r.dias} dias`,
          })),
        };
      }
      case "banco-horas": {
        return {
          key: "banco-horas",
          title: "Banco de Horas",
          description: "Saldo mensal de horas extras e compensações.",
          unidade: "h",
          resumo: [
            { label: "Saldo atual", value: `${last >= 0 ? "+" : ""}${last}h` },
            { label: "Maior pico", value: `${max}h` },
            { label: "Média mensal", value: `${avg}h` },
          ],
          serie,
          historico: serie.slice().reverse().map((p) => ({
            data: p.mes,
            descricao: p.valor >= 0 ? "Horas a compensar" : "Horas devidas",
            valor: `${p.valor >= 0 ? "+" : ""}${p.valor}h`,
          })),
        };
      }
      case "salario": {
        return {
          key: "salario",
          title: "Remuneração",
          description: "Histórico de proventos e composição salarial.",
          unidade: "R$",
          resumo: [
            { label: "Salário bruto", value: brl(salary) },
            { label: "Estimado líquido", value: brl(Math.round(salary * 0.78)) },
            { label: "Média do período", value: brl(avg) },
          ],
          serie: serie.map((p) => ({ ...p, valor: Math.round(p.valor) })),
          historico: serie.slice().reverse().map((p) => ({
            data: p.mes,
            descricao: "Pagamento processado",
            valor: brl(Math.round(p.valor)),
          })),
        };
      }
      case "beneficios":
      default: {
        const { data: bens, error } = await supabaseAdmin
          .from("rh_benefits")
          .select("name, active, activated_at")
          .eq("employee_id", employeeId)
          .order("activated_at", { ascending: true });
        if (error) throw new Error(error.message);
        const list = bens ?? [];
        const ativos = list.filter((b) => b.active).length;
        return {
          key: "beneficios",
          title: "Benefícios",
          description: "Benefícios ativos e adesões ao longo do tempo.",
          unidade: "ativos",
          resumo: [
            { label: "Ativos", value: `${ativos}` },
            { label: "Disponíveis", value: "6" },
            { label: "Adesão", value: `${Math.round((ativos / 6) * 100)}%` },
          ],
          serie: serie.map((p) => ({ ...p, valor: Math.max(0, Math.round(p.valor)) })),
          historico: list.map((b) => ({
            data: (b.activated_at as string | null) ?? "—",
            descricao: `${b.name} ${b.active ? "ativado" : "disponível"}`,
            valor: b.active ? "Ativo" : "Inativo",
          })),
        };
      }
    }
  });
