import { createFileRoute } from "@tanstack/react-router";
import { Sparkles, AlertTriangle, Lightbulb, CheckCircle2, TrendingUp, TrendingDown } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { RhPageHeader } from "@/components/rh/RhLayout";
import { analyticsKpis, aiInsights } from "@/lib/rh/extra";

export const Route = createFileRoute("/rh/people-analytics")({
  component: PeopleAnalytics,
});

function PeopleAnalytics() {
  return (
    <div>
      <RhPageHeader title="People Analytics com IA" description="Indicadores de pessoas e análise gerada por IA." />

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-3">
        {analyticsKpis.map((k) => (
          <Card key={k.label}><CardContent className="p-5">
            <p className="text-sm text-muted-foreground">{k.label}</p>
            <p className="mt-2 text-3xl font-bold">{k.value}</p>
            <span className={`mt-1 inline-flex items-center gap-1 text-xs ${k.up ? "text-rose-600" : "text-emerald-600"}`}>
              {k.up ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}{k.trend}
            </span>
          </CardContent></Card>
        ))}
      </div>

      <Card className="mt-6 border-primary/30 bg-primary/5">
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-base"><Sparkles className="h-4 w-4 text-primary" /> Resumo executivo (IA)</CardTitle>
        </CardHeader>
        <CardContent><p className="text-sm leading-relaxed">{aiInsights.resumo}</p></CardContent>
      </Card>

      <div className="mt-6 grid gap-4 lg:grid-cols-3">
        <Card>
          <CardHeader className="pb-2"><CardTitle className="flex items-center gap-2 text-base"><Lightbulb className="h-4 w-4 text-amber-500" /> Insights</CardTitle></CardHeader>
          <CardContent className="space-y-2">
            {aiInsights.insights.map((i, n) => <p key={n} className="text-sm text-muted-foreground">• {i}</p>)}
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="flex items-center gap-2 text-base"><AlertTriangle className="h-4 w-4 text-rose-500" /> Alertas</CardTitle></CardHeader>
          <CardContent className="space-y-2">
            {aiInsights.alertas.map((i, n) => <p key={n} className="text-sm text-muted-foreground">• {i}</p>)}
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="flex items-center gap-2 text-base"><CheckCircle2 className="h-4 w-4 text-emerald-500" /> Recomendações</CardTitle></CardHeader>
          <CardContent className="space-y-2">
            {aiInsights.recomendacoes.map((i, n) => <p key={n} className="text-sm text-muted-foreground">• {i}</p>)}
          </CardContent>
        </Card>
      </div>
      <p className="mt-4 text-xs text-muted-foreground"><Badge variant="outline" className="mr-2">Demonstração</Badge>Análise simulada — pronta para integração com IA.</p>
    </div>
  );
}
