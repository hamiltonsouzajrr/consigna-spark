import { createFileRoute } from "@tanstack/react-router";
import {
  Users, UserCheck, Plane, FileWarning, Cake, GraduationCap, UserPlus, UserMinus,
} from "lucide-react";
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid,
  LineChart, Line, PieChart, Pie, Cell, Legend,
} from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { RhPageHeader } from "@/components/rh/RhLayout";
import { RhStatCard } from "@/components/rh/RhStatCard";
import {
  dashboardStats, colaboradoresPorDepartamento, colaboradoresPorCargo,
  turnoverMensal, headcountEvolucao,
} from "@/lib/rh/mock";

export const Route = createFileRoute("/_authenticated/rh/dashboard")({
  component: DashboardRh,
});

const PIE_COLORS = ["#2563eb", "#16a34a", "#d97706", "#0ea5e9", "#7c3aed", "#dc2626"];

function ChartCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base">{title}</CardTitle>
      </CardHeader>
      <CardContent className="h-72">
        <ResponsiveContainer width="100%" height="100%">
          {children as React.ReactElement}
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}

function DashboardRh() {
  const s = dashboardStats();
  return (
    <div>
      <RhPageHeader title="Dashboard RH" description="Visão geral dos indicadores de Recursos Humanos." />

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <RhStatCard label="Total de colaboradores" value={s.total} icon={Users} tone="default" />
        <RhStatCard label="Colaboradores ativos" value={s.ativos} icon={UserCheck} tone="emerald" />
        <RhStatCard label="Férias pendentes" value={s.feriasPendentes} icon={Plane} tone="sky" />
        <RhStatCard label="Documentos vencendo" value={s.docsVencendo} icon={FileWarning} tone="amber" />
        <RhStatCard label="Aniversariantes do mês" value={s.aniversariantes} icon={Cake} tone="violet" />
        <RhStatCard label="Treinamentos pendentes" value={s.treinamentosPendentes} icon={GraduationCap} tone="amber" />
        <RhStatCard label="Admissões do mês" value={s.admissoesMes} icon={UserPlus} tone="emerald" />
        <RhStatCard label="Desligamentos do mês" value={s.desligamentosMes} icon={UserMinus} tone="rose" />
      </div>

      <div className="mt-6 grid gap-4 lg:grid-cols-2">
        <ChartCard title="Colaboradores por departamento">
          <BarChart data={colaboradoresPorDepartamento}>
            <CartesianGrid strokeDasharray="3 3" className="stroke-muted" vertical={false} />
            <XAxis dataKey="nome" tick={{ fontSize: 12 }} interval={0} angle={-15} textAnchor="end" height={50} />
            <YAxis allowDecimals={false} tick={{ fontSize: 12 }} />
            <Tooltip />
            <Bar dataKey="total" name="Colaboradores" fill="#2563eb" radius={[6, 6, 0, 0]} />
          </BarChart>
        </ChartCard>

        <ChartCard title="Turnover mensal">
          <BarChart data={turnoverMensal}>
            <CartesianGrid strokeDasharray="3 3" className="stroke-muted" vertical={false} />
            <XAxis dataKey="mes" tick={{ fontSize: 12 }} />
            <YAxis allowDecimals={false} tick={{ fontSize: 12 }} />
            <Tooltip />
            <Legend />
            <Bar dataKey="admissoes" name="Admissões" fill="#16a34a" radius={[6, 6, 0, 0]} />
            <Bar dataKey="desligamentos" name="Desligamentos" fill="#dc2626" radius={[6, 6, 0, 0]} />
          </BarChart>
        </ChartCard>

        <ChartCard title="Evolução do headcount">
          <LineChart data={headcountEvolucao}>
            <CartesianGrid strokeDasharray="3 3" className="stroke-muted" vertical={false} />
            <XAxis dataKey="mes" tick={{ fontSize: 12 }} />
            <YAxis tick={{ fontSize: 12 }} />
            <Tooltip />
            <Line type="monotone" dataKey="total" name="Headcount" stroke="#2563eb" strokeWidth={3} dot={{ r: 4 }} />
          </LineChart>
        </ChartCard>

        <ChartCard title="Distribuição por cargos">
          <PieChart>
            <Pie data={colaboradoresPorCargo} dataKey="total" nameKey="nome" cx="50%" cy="50%" outerRadius={90} label>
              {colaboradoresPorCargo.map((_, i) => (
                <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
              ))}
            </Pie>
            <Tooltip />
            <Legend />
          </PieChart>
        </ChartCard>
      </div>
    </div>
  );
}
