import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { Send, Bot } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { RhPageHeader } from "@/components/rh/RhLayout";

export const Route = createFileRoute("/rh/chatbot")({
  component: Chatbot,
});

type Msg = { id: string; texto: string; bot?: boolean };

const sugestoes = [
  "Qual o meu saldo de férias?",
  "Como solicito um atestado?",
  "Quando recebo o holerite?",
  "Quais benefícios eu tenho?",
];

const respostas: Record<string, string> = {
  ferias: "Você possui 12 dias de férias disponíveis. Solicite em Férias e Licenças.",
  atestado: "Envie o atestado em Documentos. O RH valida em até 2 dias úteis.",
  holerite: "Os holerites ficam disponíveis todo dia 5 na aba Holerites.",
  beneficios: "Você tem plano de saúde, vale-refeição e vale-transporte. Veja em Benefícios.",
};

function responder(texto: string): string {
  const t = texto.toLowerCase();
  if (t.includes("féri") || t.includes("feri")) return respostas.ferias;
  if (t.includes("atestado") || t.includes("licen")) return respostas.atestado;
  if (t.includes("holerite") || t.includes("salár") || t.includes("salar")) return respostas.holerite;
  if (t.includes("benef")) return respostas.beneficios;
  return "Sou o assistente de RH (demonstração). Posso ajudar com férias, atestados, holerites e benefícios.";
}

function Chatbot() {
  const [msgs, setMsgs] = useState<Msg[]>([
    { id: "init", texto: "Olá! 👋 Sou o assistente de RH. Como posso ajudar?", bot: true },
  ]);
  const [draft, setDraft] = useState("");

  const enviar = (texto: string) => {
    if (!texto.trim()) return;
    const user: Msg = { id: `u-${Date.now()}`, texto: texto.trim() };
    const bot: Msg = { id: `b-${Date.now()}`, texto: responder(texto), bot: true };
    setMsgs((p) => [...p, user, bot]);
    setDraft("");
  };

  return (
    <div>
      <RhPageHeader title="Chatbot RH" description="Assistente virtual para dúvidas dos colaboradores." />
      <Card className="flex h-[32rem] flex-col overflow-hidden">
        <div className="flex items-center gap-2 border-b px-4 py-3">
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10 text-primary">
            <Bot className="h-4 w-4" />
          </span>
          <p className="text-sm font-semibold">Assistente RH</p>
        </div>
        <div className="flex-1 space-y-3 overflow-y-auto p-4">
          {msgs.map((m) => (
            <div key={m.id} className={cn("flex", m.bot ? "justify-start" : "justify-end")}>
              <div className={cn("max-w-[75%] rounded-2xl px-3 py-2 text-sm", m.bot ? "bg-muted" : "bg-primary text-primary-foreground")}>
                {m.texto}
              </div>
            </div>
          ))}
        </div>
        <div className="flex flex-wrap gap-2 px-4 pb-2">
          {sugestoes.map((s) => (
            <button
              key={s}
              onClick={() => enviar(s)}
              className="rounded-full border px-3 py-1 text-xs text-muted-foreground transition hover:bg-muted"
            >
              {s}
            </button>
          ))}
        </div>
        <form onSubmit={(e) => { e.preventDefault(); enviar(draft); }} className="flex items-center gap-2 border-t p-3">
          <Input value={draft} onChange={(e) => setDraft(e.target.value)} placeholder="Digite sua dúvida..." />
          <Button type="submit" size="icon"><Send className="h-4 w-4" /></Button>
        </form>
      </Card>
    </div>
  );
}
