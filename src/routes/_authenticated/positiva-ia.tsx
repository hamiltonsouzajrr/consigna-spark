import { createFileRoute, Navigate, Link } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport } from "ai";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { useAuth } from "@/lib/auth";
import { useRhAccess } from "@/hooks/use-rh-access";
import { AppShell } from "@/components/AppShell";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  Conversation, ConversationContent, ConversationEmptyState, ConversationScrollButton,
} from "@/components/ai-elements/conversation";
import { Message, MessageContent, MessageResponse } from "@/components/ai-elements/message";
import {
  PromptInput, PromptInputTextarea, PromptInputFooter, PromptInputSubmit,
} from "@/components/ai-elements/prompt-input";
import { Shimmer } from "@/components/ai-elements/shimmer";
import logo from "@/assets/grupo-positive-logo.png.asset.json";
import {
  CHECKINS, OBJECOES, PALAVRAS_EVITAR, PALAVRAS_RECOMENDADAS, MISSOES_PADRAO,
  SCORE_DIM_LABEL, classificacaoScore, treinamentoDoDia, ATIVIDADE_LABEL, HUMOR_LABEL, HUMOR_EMOJI,
  ENERGIA_LABEL, periodoAtual, nivelPorXp, type Periodo, type AtividadeTipo, type HumorEstado, type ScoreDimensoes,
} from "@/lib/positiva/constants";
import { CATEGORIA_LABEL, SCRIPTS_POR_CATEGORIA, TOTAL_SCRIPTS, type ScriptCategoria } from "@/lib/positiva/scripts";
import {
  loadCoachHistory, saveCoachMessage, registrarAtividade, saveCheckin, saveHumor, getMyResumo,
} from "@/lib/positiva/positiva.functions";
import {
  MessageCircle, ClipboardCheck, Target, ShieldQuestion, BookOpen, GraduationCap,
  Gauge, Smile, Sparkles, Trophy, Phone, ShieldCheck,
} from "lucide-react";

export const Route = createFileRoute("/positiva-ia")({
  head: () => ({
    meta: [
      { title: "POSITIVA IA — Gerente Comercial Virtual" },
      { name: "description", content: "Coach de vendas, biblioteca de scripts e acompanhamento de performance para consultoras de consignado." },
      { name: "robots", content: "noindex,nofollow" },
    ],
  }),
  component: Page,
});

function CoachChat() {
  const fetchHistory = useServerFn(loadCoachHistory);
  const persist = useServerFn(saveCoachMessage);
  const [input, setInput] = useState("");
  const [initial, setInitial] = useState<{ id: string; role: "user" | "assistant"; parts: { type: "text"; text: string }[] }[] | null>(null);
  const taRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    fetchHistory()
      .then((r) => setInitial(r.messages.map((m) => ({ id: m.id, role: m.role as "user" | "assistant", parts: [{ type: "text", text: m.content }] }))))
      .catch(() => setInitial([]));
  }, [fetchHistory]);

  const { messages, sendMessage, status } = useChat({
    id: "positiva-coach",
    messages: initial ?? [],
    transport: new DefaultChatTransport({ api: "/api/positiva-coach" }),
    onError: () => toast.error("Não consegui responder agora. Tente novamente."),
    onFinish: ({ message }) => {
      const text = message.parts.map((p) => (p.type === "text" ? p.text : "")).join("");
      if (text) persist({ data: { role: "assistant", content: text } }).catch(() => {});
    },
  });

  useEffect(() => { taRef.current?.focus(); }, [status, initial]);
  if (initial === null) return <p className="p-6 text-sm text-muted-foreground">Carregando conversa…</p>;

  const submit = (text: string) => {
    const t = text.trim();
    if (!t || status === "submitted" || status === "streaming") return;
    persist({ data: { role: "user", content: t } }).catch(() => {});
    sendMessage({ text: t });
    setInput("");
  };

  const sugestoes = ["O cliente disse que vai pensar", "O cliente sumiu", "O cliente quer taxa menor", "Como abordar um servidor 40+?"];

  return (
    <div className="flex h-[70vh] flex-col">
      <Conversation>
        <ConversationContent>
          {messages.length === 0 ? (
            <ConversationEmptyState
              icon={<img src={logo.url} alt="POSITIVA IA" className="h-12 w-12 rounded-xl bg-white object-contain p-1" />}
              title="Fala, time! Sou a POSITIVA IA 🚀"
              description="Sua gerente comercial de consignado. Me conte a situação e eu te dou pergunta, gatilho, script e o próximo passo."
            >
              <div className="mt-3 flex flex-wrap justify-center gap-2">
                {sugestoes.map((s) => (
                  <Button key={s} size="sm" variant="outline" onClick={() => submit(s)}>{s}</Button>
                ))}
              </div>
            </ConversationEmptyState>
          ) : (
            messages.map((m) => {
              const text = m.parts.map((p) => (p.type === "text" ? p.text : "")).join("");
              return (
                <Message from={m.role} key={m.id}>
                  <MessageContent>
                    {m.role === "assistant" ? <MessageResponse>{text}</MessageResponse> : text}
                  </MessageContent>
                </Message>
              );
            })
          )}
          {status === "submitted" && <Shimmer>Pensando na melhor estratégia…</Shimmer>}
        </ConversationContent>
        <ConversationScrollButton />
      </Conversation>
      <PromptInput onSubmit={(_, e) => { e.preventDefault(); submit(input); }} className="mt-2">
        <PromptInputTextarea ref={taRef} value={input} onChange={(e) => setInput(e.target.value)} placeholder="Descreva a situação ou peça um script…" />
        <PromptInputFooter className="justify-end">
          <PromptInputSubmit status={status} disabled={!input.trim()} />
        </PromptInputFooter>
      </PromptInput>
    </div>
  );
}

function CheckinModule() {
  const save = useServerFn(saveCheckin);
  const atual = periodoAtual() ?? "08h";
  const [periodo, setPeriodo] = useState<Periodo>(atual);
  const [vals, setVals] = useState<Record<string, string>>({});
  const cfg = CHECKINS[periodo];

  const submit = async () => {
    const energia = cfg.perguntas.some((p) => p.tipo === "energia") ? Number(vals["energia"]) || undefined : undefined;
    const respostas: Record<string, unknown> = {};
    cfg.perguntas.forEach((p) => { if (p.tipo !== "energia") respostas[p.key] = vals[p.key] ?? ""; });
    try { await save({ data: { periodo, energia, respostas } }); toast.success("Check-in registrado!"); setVals({}); }
    catch { toast.error("Não foi possível salvar."); }
  };

  return (
    <Card className="p-5">
      <div className="mb-4 flex flex-wrap gap-2">
        {(Object.keys(CHECKINS) as Periodo[]).map((p) => (
          <Button key={p} size="sm" variant={p === periodo ? "default" : "outline"} onClick={() => { setPeriodo(p); setVals({}); }}>{p}</Button>
        ))}
      </div>
      <h3 className="text-lg font-bold">{cfg.titulo}</h3>
      <p className="mb-4 text-sm text-muted-foreground">{cfg.subtitulo}</p>
      <div className="space-y-4">
        {cfg.perguntas.map((q) => (
          <div key={q.key}>
            <label className="mb-1 block text-sm font-medium">{q.label}</label>
            {q.tipo === "energia" ? (
              <div className="flex gap-2">
                {[1, 2, 3].map((n) => (
                  <Button key={n} size="sm" variant={vals.energia === String(n) ? "default" : "outline"} onClick={() => setVals((v) => ({ ...v, energia: String(n) }))}>
                    {n} · {ENERGIA_LABEL[n]}
                  </Button>
                ))}
              </div>
            ) : q.tipo === "number" ? (
              <Input type="number" min={0} value={vals[q.key] ?? ""} onChange={(e) => setVals((v) => ({ ...v, [q.key]: e.target.value }))} />
            ) : (
              <Textarea value={vals[q.key] ?? ""} onChange={(e) => setVals((v) => ({ ...v, [q.key]: e.target.value }))} />
            )}
          </div>
        ))}
      </div>
      <Button className="mt-4" onClick={submit}>Registrar check-in</Button>
    </Card>
  );
}

function MissoesModule() {
  const registrar = useServerFn(registrarAtividade);
  const [progresso, setProgresso] = useState<Record<string, number>>({});
  const totalXp = MISSOES_PADRAO.reduce((acc, m) => acc + (progresso[m.chave] >= m.alvo ? m.xp : 0), 0);
  const nivel = nivelPorXp(totalXp);

  const avancar = async (chave: string, tipo: AtividadeTipo) => {
    setProgresso((p) => ({ ...p, [chave]: (p[chave] ?? 0) + 1 }));
    try { await registrar({ data: { tipo, quantidade: 1 } }); } catch { /* ignore */ }
  };

  return (
    <div className="space-y-4">
      <Card className="flex items-center justify-between p-4">
        <div>
          <p className="text-sm text-muted-foreground">Nível {nivel.nivel} · {nivel.titulo}</p>
          <p className="text-2xl font-bold">{totalXp} XP</p>
        </div>
        <Trophy className="h-8 w-8 text-amber-500" />
      </Card>
      {MISSOES_PADRAO.map((m) => {
        const prog = progresso[m.chave] ?? 0;
        const done = prog >= m.alvo;
        return (
          <Card key={m.chave} className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="font-semibold">{m.titulo}</p>
                <p className="text-xs text-muted-foreground">{m.horario} · {m.xp} XP · {prog}/{m.alvo}</p>
              </div>
              {done ? <Badge className="border-emerald-500/30 bg-emerald-500/15 text-emerald-600">Concluída 🏅</Badge>
                : <Button size="sm" onClick={() => avancar(m.chave, m.tipo)}>+1</Button>}
            </div>
            <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-muted">
              <div className="h-full bg-primary transition-all" style={{ width: `${Math.min(100, (prog / m.alvo) * 100)}%` }} />
            </div>
          </Card>
        );
      })}
    </div>
  );
}

function ObjecoesModule() {
  const [open, setOpen] = useState<string | null>(null);
  return (
    <div className="space-y-2">
      {OBJECOES.map((o) => (
        <Card key={o.gatilhoNome} className="overflow-hidden">
          <button className="flex w-full items-center justify-between p-4 text-left" onClick={() => setOpen(open === o.gatilhoNome ? null : o.gatilhoNome)}>
            <span className="font-semibold">"{o.gatilhoNome}"</span>
            <Badge variant="outline">{o.gatilhos[0]}</Badge>
          </button>
          {open === o.gatilhoNome && (
            <div className="space-y-3 border-t bg-muted/30 p-4 text-sm">
              <p><strong>Explicação:</strong> {o.explicacao}</p>
              <p><strong>Pergunta-chave:</strong> {o.pergunta}</p>
              <p><strong>Gatilhos:</strong> {o.gatilhos.join(" · ")}</p>
              <p className="rounded-md bg-card p-3"><strong>Script:</strong> {o.script}</p>
              <p><strong>Próximo passo:</strong> {o.proximoPasso}</p>
            </div>
          )}
        </Card>
      ))}
    </div>
  );
}

function ScriptsModule() {
  const cats = Object.keys(CATEGORIA_LABEL) as ScriptCategoria[];
  const [cat, setCat] = useState<ScriptCategoria>("abertura");
  const lista = SCRIPTS_POR_CATEGORIA(cat);
  return (
    <div>
      <p className="mb-3 text-sm text-muted-foreground">{TOTAL_SCRIPTS} scripts disponíveis. Toque para copiar.</p>
      <div className="mb-4 flex flex-wrap gap-2">
        {cats.map((c) => (
          <Button key={c} size="sm" variant={c === cat ? "default" : "outline"} onClick={() => setCat(c)}>{CATEGORIA_LABEL[c]}</Button>
        ))}
      </div>
      <div className="grid gap-2 md:grid-cols-2">
        {lista.map((s) => (
          <Card key={s.id} className="cursor-pointer p-3 text-sm transition hover:bg-accent/50"
            onClick={() => { navigator.clipboard?.writeText(s.texto); toast.success("Script copiado!"); }}>
            {s.texto}
          </Card>
        ))}
      </div>
    </div>
  );
}

function TreinamentoModule() {
  const t = treinamentoDoDia();
  const items: { titulo: string; texto: string }[] = [
    { titulo: "Frase de abertura", texto: t.abertura },
    { titulo: "Gatilho psicológico ético", texto: t.gatilho },
    { titulo: "Técnica de follow-up", texto: t.followup },
    { titulo: "Técnica de fechamento", texto: t.fechamento },
    { titulo: "Erro comum para evitar", texto: t.erro },
    { titulo: "Comunicação com servidores 40+", texto: t.comunicacao },
  ];
  return (
    <div className="grid gap-3 md:grid-cols-2">
      {items.map((i) => (
        <Card key={i.titulo} className="p-4">
          <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-primary">{i.titulo}</p>
          <p className="text-sm">{i.texto}</p>
        </Card>
      ))}
    </div>
  );
}

const SCORE_DEFAULT: ScoreDimensoes = {
  energia: 60, persistencia: 60, disciplina: 60, prospeccao: 60,
  followup: 60, organizacao: 60, comunicacao: 60, fechamentos: 60,
};
function ScoreModule() {
  const [dim, setDim] = useState<ScoreDimensoes>(SCORE_DEFAULT);
  const keys = Object.keys(SCORE_DIM_LABEL) as (keyof ScoreDimensoes)[];
  const score = Math.round(keys.reduce((a, k) => a + dim[k], 0) / keys.length);
  const cls = classificacaoScore(score);
  return (
    <div className="grid gap-4 md:grid-cols-[260px_1fr]">
      <Card className="flex flex-col items-center justify-center p-6">
        <p className="text-sm text-muted-foreground">Hunter Score</p>
        <p className="text-6xl font-extrabold">{score}</p>
        <Badge variant="outline" className={`mt-2 ${cls.tone}`}>{cls.label}</Badge>
      </Card>
      <Card className="space-y-3 p-5">
        {keys.map((k) => (
          <div key={k}>
            <div className="mb-1 flex justify-between text-sm"><span>{SCORE_DIM_LABEL[k]}</span><span className="tabular-nums">{dim[k]}</span></div>
            <input type="range" min={0} max={100} value={dim[k]} onChange={(e) => setDim((d) => ({ ...d, [k]: Number(e.target.value) }))} className="w-full accent-primary" />
          </div>
        ))}
      </Card>
    </div>
  );
}

function HumorModule() {
  const save = useServerFn(saveHumor);
  const [sel, setSel] = useState<HumorEstado | null>(null);
  const estados = Object.keys(HUMOR_LABEL) as HumorEstado[];
  return (
    <Card className="p-6">
      <h3 className="mb-1 text-lg font-bold">Como você está se sentindo hoje?</h3>
      <p className="mb-4 text-sm text-muted-foreground">Seu bem-estar importa. Em caso de desânimo recorrente, o administrador é avisado para te apoiar.</p>
      <div className="flex flex-wrap gap-3">
        {estados.map((e) => (
          <Button key={e} variant={sel === e ? "default" : "outline"} className="h-auto flex-col gap-1 py-3"
            onClick={async () => { setSel(e); try { await save({ data: { estado: e } }); toast.success("Registrado. Conte comigo!"); } catch { toast.error("Erro ao salvar."); } }}>
            <span className="text-2xl">{HUMOR_EMOJI[e]}</span>
            <span className="text-xs">{HUMOR_LABEL[e]}</span>
          </Button>
        ))}
      </div>
    </Card>
  );
}

function PalavrasModule() {
  return (
    <div className="grid gap-4 md:grid-cols-2">
      <Card className="p-5">
        <h3 className="mb-3 font-bold text-rose-600">Evite</h3>
        <ul className="space-y-2 text-sm">
          {PALAVRAS_EVITAR.map((p) => (
            <li key={p.evitar} className="flex items-center justify-between rounded-md bg-muted/40 px-3 py-2">
              <span className="line-through opacity-70">{p.evitar}</span>
              <span className="font-medium text-emerald-600">→ {p.usar}</span>
            </li>
          ))}
        </ul>
      </Card>
      <Card className="p-5">
        <h3 className="mb-3 font-bold text-emerald-600">Prefira</h3>
        <div className="flex flex-wrap gap-2">
          {PALAVRAS_RECOMENDADAS.map((p) => <Badge key={p} variant="outline" className="border-emerald-500/30 bg-emerald-500/10 text-emerald-700">{p}</Badge>)}
        </div>
      </Card>
    </div>
  );
}

function ResumoBar() {
  const fetchResumo = useServerFn(getMyResumo);
  const [resumo, setResumo] = useState<Awaited<ReturnType<typeof getMyResumo>> | null>(null);
  useEffect(() => { fetchResumo().then(setResumo).catch(() => {}); }, [fetchResumo]);
  const tipos: AtividadeTipo[] = ["ligacao", "prospeccao", "proposta", "followup", "contrato", "reativacao"];
  return (
    <div className="mb-6 grid grid-cols-2 gap-2 md:grid-cols-6">
      {tipos.map((t) => (
        <Card key={t} className="p-3 text-center">
          <p className="text-xs text-muted-foreground">{ATIVIDADE_LABEL[t]}</p>
          <p className="text-xl font-bold tabular-nums">{resumo?.hoje?.[t] ?? 0}</p>
        </Card>
      ))}
    </div>
  );
}

function Page() {
  const { user, loading } = useAuth();
  const { isAdmin } = useRhAccess();
  if (loading) return null;
  if (!user) return <Navigate to="/login" />;

  return (
    <AppShell>
      <div className="mb-6 flex flex-wrap items-center gap-3">
        <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-white p-1 shadow-[var(--shadow-glow)]">
          <img src={logo.url} alt="POSITIVA IA" className="h-full w-full object-contain" />
        </div>
        <div className="flex-1">
          <h1 className="flex items-center gap-2 text-2xl font-bold">POSITIVA IA <Sparkles className="h-5 w-5 text-amber-500" /></h1>
          <p className="text-sm text-muted-foreground">Sua gerente comercial virtual de consignado — ação, energia e mais contratos.</p>
        </div>
        {isAdmin && (
          <Link to="/positiva-ia/admin">
            <Button variant="outline" className="gap-2"><ShieldCheck className="h-4 w-4" /> Painel admin</Button>
          </Link>
        )}
      </div>

      <ResumoBar />

      <Tabs defaultValue="coach">
        <TabsList className="mb-4 flex h-auto flex-wrap justify-start gap-1">
          <TabsTrigger value="coach" className="gap-1"><MessageCircle className="h-4 w-4" />IA Coach</TabsTrigger>
          <TabsTrigger value="checkin" className="gap-1"><ClipboardCheck className="h-4 w-4" />Check-in</TabsTrigger>
          <TabsTrigger value="missoes" className="gap-1"><Target className="h-4 w-4" />Missões</TabsTrigger>
          <TabsTrigger value="objecoes" className="gap-1"><ShieldQuestion className="h-4 w-4" />Objeções</TabsTrigger>
          <TabsTrigger value="scripts" className="gap-1"><BookOpen className="h-4 w-4" />Scripts</TabsTrigger>
          <TabsTrigger value="treino" className="gap-1"><GraduationCap className="h-4 w-4" />Treino</TabsTrigger>
          <TabsTrigger value="score" className="gap-1"><Gauge className="h-4 w-4" />Hunter Score</TabsTrigger>
          <TabsTrigger value="humor" className="gap-1"><Smile className="h-4 w-4" />Humor</TabsTrigger>
          <TabsTrigger value="palavras" className="gap-1"><Phone className="h-4 w-4" />Palavras</TabsTrigger>
        </TabsList>
        <TabsContent value="coach"><CoachChat /></TabsContent>
        <TabsContent value="checkin"><CheckinModule /></TabsContent>
        <TabsContent value="missoes"><MissoesModule /></TabsContent>
        <TabsContent value="objecoes"><ObjecoesModule /></TabsContent>
        <TabsContent value="scripts"><ScriptsModule /></TabsContent>
        <TabsContent value="treino"><TreinamentoModule /></TabsContent>
        <TabsContent value="score"><ScoreModule /></TabsContent>
        <TabsContent value="humor"><HumorModule /></TabsContent>
        <TabsContent value="palavras"><PalavrasModule /></TabsContent>
      </Tabs>
    </AppShell>
  );
}
