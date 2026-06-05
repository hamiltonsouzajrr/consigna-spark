import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { Send, Hash, Lock } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";
import { RhPageHeader } from "@/components/rh/RhLayout";
import { chatRooms, chatMessages, type ChatMsg } from "@/lib/rh/extra";

export const Route = createFileRoute("/rh/chat")({
  component: Chat,
});

function Chat() {
  const [room, setRoom] = useState(chatRooms[0].id);
  const [draft, setDraft] = useState("");
  const [msgs, setMsgs] = useState<Record<string, ChatMsg[]>>(chatMessages);

  const send = () => {
    if (!draft.trim()) return;
    const msg: ChatMsg = {
      id: `local-${Date.now()}`,
      room,
      autor: "Você",
      texto: draft.trim(),
      hora: new Date().toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" }),
      me: true,
    };
    setMsgs((p) => ({ ...p, [room]: [...(p[room] ?? []), msg] }));
    setDraft("");
  };

  const current = chatRooms.find((r) => r.id === room)!;

  return (
    <div>
      <RhPageHeader title="Chat Interno" description="Comunicação por canais e mensagens diretas." />
      <Card className="grid h-[32rem] grid-cols-1 overflow-hidden sm:grid-cols-[14rem_1fr]">
        <aside className="border-b bg-muted/30 p-2 sm:border-b-0 sm:border-r">
          <div className="flex gap-1 overflow-x-auto sm:flex-col">
            {chatRooms.map((r) => (
              <button
                key={r.id}
                onClick={() => setRoom(r.id)}
                className={cn(
                  "flex shrink-0 items-center gap-2 rounded-lg px-3 py-2 text-left text-sm font-medium transition",
                  room === r.id ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted",
                )}
              >
                {r.tipo === "canal" ? <Hash className="h-4 w-4" /> : <Lock className="h-4 w-4" />}
                <span className="truncate">{r.nome}</span>
              </button>
            ))}
          </div>
        </aside>
        <div className="flex min-w-0 flex-col">
          <div className="border-b px-4 py-3 text-sm font-semibold">
            {current.tipo === "canal" ? "#" : ""}{current.nome}
          </div>
          <div className="flex-1 space-y-3 overflow-y-auto p-4">
            {(msgs[room] ?? []).map((m) => (
              <div key={m.id} className={cn("flex gap-2", m.me && "flex-row-reverse")}>
                <Avatar className="h-8 w-8 shrink-0">
                  <AvatarFallback>{m.autor.slice(0, 2)}</AvatarFallback>
                </Avatar>
                <div className={cn("max-w-[75%] rounded-2xl px-3 py-2 text-sm", m.me ? "bg-primary text-primary-foreground" : "bg-muted")}>
                  {!m.me && <p className="mb-0.5 text-xs font-semibold opacity-70">{m.autor}</p>}
                  <p>{m.texto}</p>
                  <p className={cn("mt-1 text-[10px]", m.me ? "opacity-70" : "text-muted-foreground")}>{m.hora}</p>
                </div>
              </div>
            ))}
          </div>
          <form
            onSubmit={(e) => { e.preventDefault(); send(); }}
            className="flex items-center gap-2 border-t p-3"
          >
            <Input value={draft} onChange={(e) => setDraft(e.target.value)} placeholder="Escreva uma mensagem..." />
            <Button type="submit" size="icon"><Send className="h-4 w-4" /></Button>
          </form>
        </div>
      </Card>
    </div>
  );
}
