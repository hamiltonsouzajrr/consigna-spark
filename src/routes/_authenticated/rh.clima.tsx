import { createFileRoute } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Smile, ShieldCheck, Send, Lock, Eye } from "lucide-react";
import {
  ResponsiveContainer, RadarChart, Radar, PolarGrid, PolarAngleAxis, PolarRadiusAxis,
  BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid, LineChart, Line, Legend,
} from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { toast } from "sonner";
import { RhPageHeader } from "@/components/rh/RhLayout";
import { RhStatCard } from "@/components/rh/RhStatCard";
import { climaRadar, enpsHistorico, climaPorDepartamento } from "@/lib/rh/extra";
import {
  getClimaWeek, submitClimaResponse, formatWeekLabel, CLIMA_QUESTIONS,
} from "@/lib/rh/clima.functions";

export const Route = createFileRoute("/rh/clima")({
  component: Clima,
});

const SCALE = [1, 2, 3, 4, 5];

function Clima() {
  const qc = useQueryClient();
  const fetchWeek = useServerFn(getClimaWeek);
  const submitFn = useServerFn(submitClimaResponse);

  const { data, isLoading } = useQuery({
    queryKey: ["rh", "clima-week"],
    queryFn: () => fetchWeek(),
  });

  const [answers, setAnswers] = useState<Record<string, number>>({});
  const [comment, setComment] = useState("");

  useEffect(() => {
    if (data?.myAnswers) setAnswers(data.myAnswers);
    if (data?.myComment) setComment(data.myComment);
  }, [data?.myAnswers, data?.myComment]);

  const submit = useMutation({
    mutationFn: () => submitFn({ data: { answers, comment: comment || undefined } }),
    onSuccess: () => {
      toast.success("Resposta enviada de forma anônima. Obrigado!");
      qc.invalidateQueries({ queryKey: ["rh", "clima-week"] });
    },
    onError: (e: any) => toast.error(e?.message ?? "Erro ao enviar."),
  });

  const allAnswered = CLIMA_QUESTIONS.every((q) => answers[q.id]);

  return (
    <div>
      <RhPageHeader
        title="Clima Organizacional"
        description="Pesquisa semanal anônima de clima — uma nova rodada a cada segunda-feira."
        actions={
          data?.isAdmin ? (
            <Badge variant="secondary" className="gap-1">
              <Eye className="h-3.5 w-3.5" /> Visão do administrador
            </Badge>
          ) : null
        }
      />

      {/* ----- Questionário semanal (todos respondem) ----- */}
      {!isLoading && data && (
        <Card className="mb-6">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center justify-between text-base">
              <span>Questionário da semana — {formatWeekLabel(data.weekStart)}</span>
              {data.hasAnswered && (
                <Badge variant="outline" className="gap-1 text-emerald-600">
                  <ShieldCheck className="h-3.5 w-3.5" /> Você já respondeu
                </Badge>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-5">
            <Alert>
              <Lock className="h-4 w-4" />
              <AlertTitle>Sua resposta é anônima</AlertTitle>
              <AlertDescription>
                Suas respostas são registradas de forma anônima para os colegas. Responda com
                sinceridade — o objetivo é melhorar o ambiente de trabalho.
              </AlertDescription>
            </Alert>

            {CLIMA_QUESTIONS.map((q) => (
              <div key={q.id} className="space-y-2">
                <p className="text-sm font-medium">{q.label}</p>
                <div className="flex flex-wrap gap-2">
                  {SCALE.map((n) => (
                    <Button
                      key={n}
                      type="button"
                      size="sm"
                      variant={answers[q.id] === n ? "default" : "outline"}
                      onClick={() => setAnswers((a) => ({ ...a, [q.id]: n }))}
                    >
                      {n}
                    </Button>
                  ))}
                  <span className="self-center text-xs text-muted-foreground">
                    1 = muito ruim · 5 = excelente
                  </span>
                </div>
              </div>
            ))}

            <div className="space-y-2">
              <p className="text-sm font-medium">Comentário (opcional)</p>
              <Textarea
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                placeholder="Algo que queira compartilhar sobre a semana…"
                rows={3}
              />
            </div>

            <Button
              onClick={() => submit.mutate()}
              disabled={!allAnswered || submit.isPending}
            >
              <Send className="mr-2 h-4 w-4" />
              {data.hasAnswered ? "Atualizar resposta" : "Enviar resposta"}
            </Button>
          </CardContent>
        </Card>
      )}

      {/* ----- Visão do administrador: respostas detalhadas ----- */}
      {data?.isAdmin && (
        <Card className="mb-6">
          <CardHeader className="pb-2">
            <CardTitle className="text-base">
              Respostas da semana ({data.totalResponses})
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="mb-3 text-xs text-muted-foreground">
              Como administrador, você vê quem respondeu e o que cada consultora respondeu.
            </p>
            {data.responses.length === 0 ? (
              <p className="text-sm text-muted-foreground">Nenhuma resposta nesta semana ainda.</p>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Consultora</TableHead>
                      {CLIMA_QUESTIONS.map((q) => (
                        <TableHead key={q.id} className="text-center">
                          {q.id}
                        </TableHead>
                      ))}
                      <TableHead>Comentário</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    <TableRow className="bg-muted/40 font-medium">
                      <TableCell>Média</TableCell>
                      {CLIMA_QUESTIONS.map((q) => (
                        <TableCell key={q.id} className="text-center">
                          {data.averages[q.id] || "—"}
                        </TableCell>
                      ))}
                      <TableCell />
                    </TableRow>
                    {data.responses.map((r) => (
                      <TableRow key={r.id}>
                        <TableCell className="font-medium">{r.consultora}</TableCell>
                        {CLIMA_QUESTIONS.map((q) => (
                          <TableCell key={q.id} className="text-center">
                            {r.answers[q.id] ?? "—"}
                          </TableCell>
                        ))}
                        <TableCell className="max-w-[240px] truncate text-muted-foreground">
                          {r.comment || "—"}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* ----- Indicadores gerais ----- */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <RhStatCard label="eNPS atual" value={enpsHistorico[enpsHistorico.length - 1].enps} icon={Smile} tone="emerald" hint="Zona de excelência" />
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
