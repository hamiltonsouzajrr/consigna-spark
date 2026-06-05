import { createFileRoute } from "@tanstack/react-router";
import { Plus, Smile } from "lucide-react";
import {
  ResponsiveContainer, RadarChart, Radar, PolarGrid, PolarAngleAxis, PolarRadiusAxis,
  BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid, LineChart, Line, Legend,
} from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { RhPageHeader } from "@/components/rh/RhLayout";
import { RhStatCard } from "@/components/rh/RhStatCard";
import { climaRadar, enpsHistorico, climaPorDepartamento } from "@/lib/rh/extra";

export const Route = createFileRoute("/rh/clima")({
  component: Clima,
});

function Clima() {
  const enpsAtual = enpsHistorico[enpsHistorico.length - 1].enps;
  return (
    <div>
      <RhPageHeader
        title="Clima Organizacional"
        description="eNPS, satisfação, liderança, ambiente e cultura."
        actions={<Button size="sm" onClick={() => toast.info("Nova pesquisa (demonstração)")}><Plus className="mr-2 h-4 w-4" /> Nova Pesquisa</Button>}
      />

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <RhStatCard label="eNPS atual" value={enpsAtual} icon={Smile} tone="emerald" hint="Zona de excelência" />
        <RhStatCard label="Satisfação" value="78%" icon={Smile} tone="sky" />
        <RhStatCard label="Liderança" value="72%" icon={Smile} tone="violet" />
        <RhStatCard label="Participação" value="86%" icon={Smile} tone="amber" />
      </div>

      <div className="mt-6 grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-base">Dimensões do clima</CardTitle></CardHeader>
          <CardContent className="h-80">
            <ResponsiveContainer width="100%" height="100%">
              <RadarChart data={climaRadar}>
                <PolarGrid />
                <PolarAngleAxis dataKey="dim" tick={{ fontSize: 12 }} />
                <PolarRadiusAxis domain={[0, 100]} tick={{ fontSize: 10 }} />
                <Radar name="Índice" dataKey="valor" stroke="#2563eb" fill="#2563eb" fillOpacity={0.4} />
                <Tooltip />
              </RadarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-base">Evolução do eNPS</CardTitle></CardHeader>
          <CardContent className="h-80">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={enpsHistorico}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-muted" vertical={false} />
                <XAxis dataKey="mes" tick={{ fontSize: 12 }} />
                <YAxis tick={{ fontSize: 12 }} />
                <Tooltip />
                <Line type="monotone" dataKey="enps" name="eNPS" stroke="#16a34a" strokeWidth={3} dot={{ r: 4 }} />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader className="pb-2"><CardTitle className="text-base">Clima por departamento</CardTitle></CardHeader>
          <CardContent className="h-80">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={climaPorDepartamento}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-muted" vertical={false} />
                <XAxis dataKey="departamento" tick={{ fontSize: 12 }} />
                <YAxis domain={[0, 100]} tick={{ fontSize: 12 }} />
                <Tooltip /><Legend />
                <Bar dataKey="satisfacao" name="Satisfação" fill="#2563eb" radius={[4, 4, 0, 0]} />
                <Bar dataKey="lideranca" name="Liderança" fill="#7c3aed" radius={[4, 4, 0, 0]} />
                <Bar dataKey="ambiente" name="Ambiente" fill="#16a34a" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
