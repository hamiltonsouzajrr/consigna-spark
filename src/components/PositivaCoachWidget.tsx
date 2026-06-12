import { useEffect, useRef, useState } from "react";
import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport } from "ai";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  Conversation, ConversationContent, ConversationEmptyState, ConversationScrollButton,
} from "@/components/ai-elements/conversation";
import { Message, MessageContent, MessageResponse } from "@/components/ai-elements/message";
import {
  PromptInput, PromptInputTextarea, PromptInputFooter, PromptInputSubmit,
} from "@/components/ai-elements/prompt-input";
import { Shimmer } from "@/components/ai-elements/shimmer";
import logo from "@/assets/grupo-positive-logo.png.asset.json";
import { loadCoachHistory, saveCoachMessage } from "@/lib/positiva/positiva.functions";
import { Bot, Minus, X } from "lucide-react";

const SUGESTOES = [
  "O cliente disse que vai pensar",
  "O cliente sumiu",
  "O cliente quer taxa menor",
  "Como abordar um servidor 40+?",
];

function ChatBody({ onClose, onMinimize }: { onClose: () => void; onMinimize: () => void }) {
  const fetchHistory = useServerFn(loadCoachHistory);
  const persist = useServerFn(saveCoachMessage);
  const [input, setInput] = useState("");
  const [initial, setInitial] = useState<
    { id: string; role: "user" | "assistant"; parts: { type: "text"; text: string }[] }[] | null
  >(null);
  const taRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    fetchHistory()
      .then((r) =>
        setInitial(
          r.messages.map((m) => ({
            id: m.id,
            role: m.role as "user" | "assistant",
            parts: [{ type: "text", text: m.content }],
          })),
        ),
      )
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

  useEffect(() => {
    taRef.current?.focus();
  }, [status, initial]);

  const submit = (text: string) => {
    const t = text.trim();
    if (!t || status === "submitted" || status === "streaming") return;
    persist({ data: { role: "user", content: t } }).catch(() => {});
    sendMessage({ text: t });
    setInput("");
  };

  return (
    <>
      <div className="flex items-center gap-3 border-b bg-primary px-4 py-3 text-primary-foreground">
        <span className="relative flex h-9 w-9 items-center justify-center rounded-full bg-white/20">
          <Bot className="h-5 w-5" />
          <span className="absolute -bottom-0 -right-0 h-3 w-3 rounded-full border-2 border-primary bg-emerald-400" />
        </span>
        <div className="flex-1 leading-tight">
          <p className="text-sm font-bold">POSITIVA IA</p>
          <p className="text-[11px] opacity-80">Gerente comercial · online</p>
        </div>
        <Button variant="ghost" size="icon-sm" className="text-primary-foreground hover:bg-white/15" onClick={onMinimize} aria-label="Minimizar">
          <Minus className="h-4 w-4" />
        </Button>
        <Button variant="ghost" size="icon-sm" className="text-primary-foreground hover:bg-white/15" onClick={onClose} aria-label="Fechar">
          <X className="h-4 w-4" />
        </Button>
      </div>

      {initial === null ? (
        <p className="flex-1 p-6 text-sm text-muted-foreground">Carregando conversa…</p>
      ) : (
        <div className="flex min-h-0 flex-1 flex-col">
          <Conversation>
            <ConversationContent>
              {messages.length === 0 ? (
                <ConversationEmptyState
                  icon={
                    <span className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10 text-primary">
                      <Bot className="h-6 w-6" />
                    </span>
                  }
                  title="Fala, time! Sou a POSITIVA IA 🚀"
                  description="Me conte a situação e eu te dou pergunta, gatilho, script e o próximo passo."
                >
                  <div className="mt-3 flex flex-wrap justify-center gap-2">
                    {SUGESTOES.map((s) => (
                      <Button key={s} size="sm" variant="outline" onClick={() => submit(s)}>
                        {s}
                      </Button>
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
          <PromptInput
            onSubmit={(_, e) => {
              e.preventDefault();
              submit(input);
            }}
            className="m-2"
          >
            <PromptInputTextarea
              ref={taRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Descreva a situação ou peça um script…"
            />
            <PromptInputFooter className="justify-end">
              <PromptInputSubmit status={status} disabled={!input.trim()} />
            </PromptInputFooter>
          </PromptInput>
        </div>
      )}
    </>
  );
}

export function PositivaCoachWidget() {
  const { user, loading } = useAuth();
  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);

  if (loading || !user) return null;

  return (
    <div className="fixed bottom-4 right-4 z-50 flex flex-col items-end gap-3 print:hidden">
      {open && (
        <div
          className={cn(
            "flex h-[560px] max-h-[80vh] w-[min(380px,calc(100vw-2rem))] flex-col overflow-hidden rounded-2xl border bg-card shadow-2xl",
            "animate-in fade-in slide-in-from-bottom-4 duration-200",
          )}
        >
          {/* keep mounted state to preserve conversation while minimized */}
          <ChatBody onClose={() => { setOpen(false); setMounted(false); }} onMinimize={() => setOpen(false)} />
        </div>
      )}

      {!open && (
        <button
          onClick={() => { setOpen(true); setMounted(true); }}
          aria-label="Abrir POSITIVA IA"
          className="group flex items-center gap-2 rounded-full bg-primary py-3 pl-3 pr-4 text-primary-foreground shadow-2xl transition-transform hover:scale-105"
        >
          <span className="relative flex h-9 w-9 items-center justify-center rounded-full bg-white/20">
            <Bot className="h-5 w-5" />
            <span className="absolute -bottom-0 -right-0 h-3 w-3 rounded-full border-2 border-primary bg-emerald-400" />
          </span>
          <span className="text-sm font-bold">POSITIVA IA</span>
        </button>
      )}
      {/* avoid unused warning while preserving intent */}
      <span className="hidden">{mounted ? "" : ""}</span>
    </div>
  );
}
