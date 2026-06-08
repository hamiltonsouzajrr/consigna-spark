import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  MessageCircle,
  Send,
  Plus,
  Settings,
  Phone,
  Search,
  Trash2,
  Power,
  ExternalLink,
  CheckCircle2,
  Wifi,
  WifiOff,
  AlertTriangle,
  RefreshCw,
} from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import {
  listWaAccounts,
  addWaAccount,
  deleteWaAccount,
  updateWaAccount,
  verifyWaAccount,
  listConversations,
  listMessages,
  sendWaMessage,
  markConversationRead,
} from "@/lib/wa/whatsapp.functions";

export const Route = createFileRoute("/whatsapp")({
  head: () => ({
    meta: [
      { title: "WhatsApp | Grupo Positive" },
      { name: "robots", content: "noindex,nofollow" },
    ],
  }),
  component: WhatsAppPage,
});

function initials(s: string) {
  return s.replace(/\D/g, "").slice(-2) || s.slice(0, 2).toUpperCase();
}

function WhatsAppPage() {
  const qc = useQueryClient();
  const fetchAccounts = useServerFn(listWaAccounts);
  const fetchConversations = useServerFn(listConversations);
  const fetchMessages = useServerFn(listMessages);
  const send = useServerFn(sendWaMessage);
  const markRead = useServerFn(markConversationRead);

  const [accountId, setAccountId] = useState<string | null>(null);
  const [contactId, setContactId] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const [search, setSearch] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);

  const accountsQ = useQuery({ queryKey: ["wa-accounts"], queryFn: () => fetchAccounts() });

  useEffect(() => {
    if (!accountId && accountsQ.data && accountsQ.data.length > 0) {
      setAccountId(accountsQ.data[0].id);
    }
  }, [accountsQ.data, accountId]);

  const conversationsQ = useQuery({
    queryKey: ["wa-conversations", accountId],
    queryFn: () => fetchConversations({ data: { accountId: accountId! } }),
    enabled: !!accountId,
    refetchInterval: 10000,
  });

  const messagesQ = useQuery({
    queryKey: ["wa-messages", contactId],
    queryFn: () => fetchMessages({ data: { contactId: contactId! } }),
    enabled: !!contactId,
    refetchInterval: 8000,
  });

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [messagesQ.data]);

  useEffect(() => {
    if (contactId) {
      markRead({ data: { contactId } }).then(() =>
        qc.invalidateQueries({ queryKey: ["wa-conversations", accountId] }),
      );
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [contactId]);

  const handleSend = async () => {
    if (!draft.trim() || !contactId) return;
    const text = draft.trim();
    setDraft("");
    try {
      await send({ data: { contactId, text } });
      qc.invalidateQueries({ queryKey: ["wa-messages", contactId] });
      qc.invalidateQueries({ queryKey: ["wa-conversations", accountId] });
    } catch (e: any) {
      toast.error(e?.message ?? "Erro ao enviar mensagem.");
      setDraft(text);
    }
  };

  const conversations = (conversationsQ.data ?? []).filter((c: any) => {
    const q = search.trim().toLowerCase();
    if (!q) return true;
    return (c.name ?? "").toLowerCase().includes(q) || (c.wa_id ?? "").includes(q);
  });

  const currentContact = conversations.find((c: any) => c.id === contactId);
  const accounts = accountsQ.data ?? [];

  return (
    <AppShell>
      <div className="space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-500/10 text-emerald-600">
              <MessageCircle className="h-5 w-5" />
            </div>
            <div>
              <h1 className="text-xl font-semibold tracking-tight">WhatsApp</h1>
              <p className="text-sm text-muted-foreground">
                Central de atendimento via API oficial (Cloud API).
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {accounts.length > 0 && (
              <Select value={accountId ?? undefined} onValueChange={(v) => { setAccountId(v); setContactId(null); }}>
                <SelectTrigger className="w-[12rem]">
                  <SelectValue placeholder="Selecione a conta" />
                </SelectTrigger>
                <SelectContent>
                  {accounts.map((a: any) => (
                    <SelectItem key={a.id} value={a.id}>
                      {a.name}{!a.active ? " (inativa)" : ""}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
            <AccountsDialog accounts={accounts} />
          </div>
        </div>

        {accounts.length === 0 ? (
          <Card className="flex flex-col items-center justify-center gap-3 p-12 text-center">
            <Phone className="h-10 w-10 text-muted-foreground" />
            <div>
              <p className="font-medium">Nenhuma conta conectada</p>
              <p className="text-sm text-muted-foreground">
                Adicione uma conta do WhatsApp Cloud API para começar a atender.
              </p>
            </div>
            <AccountsDialog accounts={accounts} triggerLabel="Adicionar conta" />
          </Card>
        ) : (
          <Card className="grid h-[34rem] grid-cols-1 overflow-hidden sm:grid-cols-[18rem_1fr]">
            <aside className="flex min-h-0 flex-col border-b bg-muted/20 sm:border-b-0 sm:border-r">
              <div className="border-b p-3">
                <div className="relative">
                  <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                  <Input
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="Buscar conversa..."
                    className="pl-8"
                  />
                </div>
              </div>
              <div className="flex-1 overflow-y-auto">
                {conversations.length === 0 ? (
                  <p className="p-4 text-sm text-muted-foreground">Nenhuma conversa ainda.</p>
                ) : (
                  conversations.map((c: any) => (
                    <button
                      key={c.id}
                      onClick={() => setContactId(c.id)}
                      className={cn(
                        "flex w-full items-center gap-3 border-b px-3 py-3 text-left transition hover:bg-muted",
                        contactId === c.id && "bg-muted",
                      )}
                    >
                      <Avatar className="h-9 w-9 shrink-0">
                        <AvatarFallback>{initials(c.name || c.wa_id)}</AvatarFallback>
                      </Avatar>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium">{c.name || c.wa_id}</p>
                        <p className="truncate text-xs text-muted-foreground">+{c.wa_id}</p>
                      </div>
                      {c.unread_count > 0 && (
                        <Badge className="h-5 min-w-5 justify-center bg-emerald-600 px-1.5 text-xs hover:bg-emerald-600">
                          {c.unread_count}
                        </Badge>
                      )}
                    </button>
                  ))
                )}
              </div>
            </aside>

            <div className="flex min-w-0 flex-col">
              {!contactId ? (
                <div className="flex flex-1 flex-col items-center justify-center gap-2 text-muted-foreground">
                  <MessageCircle className="h-10 w-10" />
                  <p className="text-sm">Selecione uma conversa para começar.</p>
                </div>
              ) : (
                <>
                  <div className="flex items-center gap-3 border-b px-4 py-3">
                    <Avatar className="h-8 w-8">
                      <AvatarFallback>{initials(currentContact?.name || currentContact?.wa_id || "")}</AvatarFallback>
                    </Avatar>
                    <div>
                      <p className="text-sm font-semibold">{currentContact?.name || currentContact?.wa_id}</p>
                      <p className="text-xs text-muted-foreground">+{currentContact?.wa_id}</p>
                    </div>
                  </div>
                  <div ref={scrollRef} className="flex-1 space-y-3 overflow-y-auto bg-muted/10 p-4">
                    {(messagesQ.data ?? []).map((m: any) => (
                      <div key={m.id} className={cn("flex", m.direction === "out" && "justify-end")}>
                        <div
                          className={cn(
                            "max-w-[75%] rounded-2xl px-3 py-2 text-sm shadow-sm",
                            m.direction === "out"
                              ? "bg-emerald-600 text-white"
                              : "bg-card",
                          )}
                        >
                          {m.direction === "out" && m.sender_name && (
                            <p className="mb-0.5 text-[10px] font-semibold opacity-80">{m.sender_name}</p>
                          )}
                          <p className="whitespace-pre-wrap break-words">{m.body}</p>
                          <p className={cn("mt-1 text-[10px]", m.direction === "out" ? "text-white/70" : "text-muted-foreground")}>
                            {new Date(m.created_at).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                  <form
                    onSubmit={(e) => { e.preventDefault(); handleSend(); }}
                    className="flex items-end gap-2 border-t p-3"
                  >
                    <Textarea
                      value={draft}
                      onChange={(e) => setDraft(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSend(); }
                      }}
                      placeholder="Escreva uma mensagem..."
                      className="max-h-32 min-h-[2.5rem] resize-none"
                      rows={1}
                    />
                    <Button type="submit" size="icon" className="bg-emerald-600 hover:bg-emerald-700">
                      <Send className="h-4 w-4" />
                    </Button>
                  </form>
                </>
              )}
            </div>
          </Card>
        )}
      </div>
    </AppShell>
  );
}

function AccountsDialog({ accounts, triggerLabel }: { accounts: any[]; triggerLabel?: string }) {
  const qc = useQueryClient();
  const add = useServerFn(addWaAccount);
  const del = useServerFn(deleteWaAccount);
  const upd = useServerFn(updateWaAccount);
  const verify = useServerFn(verifyWaAccount);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({
    name: "",
    phone_number_id: "",
    business_account_id: "",
    display_phone: "",
    access_token: "",
  });
  const [saving, setSaving] = useState(false);
  const [verifyingId, setVerifyingId] = useState<string | null>(null);

  const webhookUrl =
    (typeof window !== "undefined" ? window.location.origin : "https://consigna-spark.lovable.app") +
    "/api/public/whatsapp/webhook";

  const refresh = () => qc.invalidateQueries({ queryKey: ["wa-accounts"] });

  const runVerify = async (id: string) => {
    setVerifyingId(id);
    try {
      const r: any = await verify({ data: { id } });
      if (r.webhookConfigured) {
        toast.success(
          `Conexão validada${r.displayPhone ? ` (${r.displayPhone})` : ""}. Webhook configurado automaticamente.`,
        );
      } else if (r.tokenValid) {
        toast.warning(
          `Token válido${r.displayPhone ? ` (${r.displayPhone})` : ""}, mas o webhook não foi configurado: ${r.warnings?.[0] ?? "verifique o Business Account ID."}`,
        );
      }
      refresh();
      qc.invalidateQueries({ queryKey: ["wa-webhook-status", id] });
    } catch (e: any) {
      toast.error(e?.message ?? "Falha ao validar a conta.");
    } finally {
      setVerifyingId(null);
    }
  };

  const handleAdd = async () => {
    if (!form.name || !form.phone_number_id || !form.access_token) {
      toast.error("Preencha nome, Phone Number ID e Token de acesso.");
      return;
    }
    setSaving(true);
    try {
      const res: any = await add({ data: form });
      toast.success("Conta adicionada. Validando conexão...");
      setForm({ name: "", phone_number_id: "", business_account_id: "", display_phone: "", access_token: "" });
      refresh();
      if (res?.id) await runVerify(res.id);
    } catch (e: any) {
      toast.error(e?.message ?? "Erro ao adicionar conta.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {triggerLabel ? (
          <Button className="bg-emerald-600 hover:bg-emerald-700">
            <Plus className="mr-1 h-4 w-4" /> {triggerLabel}
          </Button>
        ) : (
          <Button variant="outline" size="icon" title="Gerenciar contas">
            <Settings className="h-4 w-4" />
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Contas WhatsApp</DialogTitle>
          <DialogDescription>
            Conecte quantas contas oficiais (Cloud API) quiser. As credenciais ficam protegidas no servidor.
          </DialogDescription>
        </DialogHeader>

        {accounts.length > 0 && (
          <div className="space-y-2">
            {accounts.map((a) => (
              <AccountRow
                key={a.id}
                account={a}
                verifying={verifyingId === a.id}
                onVerify={() => runVerify(a.id)}
                onToggle={async (v) => {
                  await upd({ data: { id: a.id, active: v } });
                  refresh();
                }}
                onDelete={async () => {
                  if (!confirm(`Remover a conta "${a.name}"? Todo o histórico será apagado.`)) return;
                  await del({ data: { id: a.id } });
                  refresh();
                }}
              />
            ))}
          </div>
        )}

        <div className="space-y-4 rounded-lg border bg-muted/20 p-4">
          <div className="flex items-center justify-between">
            <p className="text-sm font-medium">Conectar novo número</p>
            <a
              href="https://developers.facebook.com/apps/"
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1 text-xs font-medium text-emerald-600 hover:underline"
            >
              Abrir Meta for Developers <ExternalLink className="h-3 w-3" />
            </a>
          </div>

          <ol className="space-y-3">
            <li className="rounded-md border bg-card p-3">
              <div className="flex items-start gap-3">
                <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-emerald-600 text-[11px] font-bold text-white">1</span>
                <div className="space-y-1.5">
                  <p className="text-sm font-medium">Crie um app e ative o WhatsApp</p>
                  <p className="text-xs text-muted-foreground">
                    No painel da Meta, crie um app do tipo <strong>Empresa</strong> e adicione o produto <strong>WhatsApp</strong>.
                  </p>
                  <a
                    href="https://developers.facebook.com/apps/creation/"
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1 text-xs font-medium text-emerald-600 hover:underline"
                  >
                    Criar app <ExternalLink className="h-3 w-3" />
                  </a>
                </div>
              </div>
            </li>
            <li className="rounded-md border bg-card p-3">
              <div className="flex items-start gap-3">
                <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-emerald-600 text-[11px] font-bold text-white">2</span>
                <div className="space-y-1.5">
                  <p className="text-sm font-medium">Copie o Phone Number ID e o Token</p>
                  <p className="text-xs text-muted-foreground">
                    Em <strong>WhatsApp → Configuração da API</strong>, copie o <strong>Phone Number ID</strong>. Para envios contínuos,
                    gere um <strong>token permanente</strong> em um usuário do sistema (Business Settings).
                  </p>
                  <div className="flex flex-wrap gap-3">
                    <a
                      href="https://developers.facebook.com/apps/"
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-1 text-xs font-medium text-emerald-600 hover:underline"
                    >
                      Configuração da API <ExternalLink className="h-3 w-3" />
                    </a>
                    <a
                      href="https://business.facebook.com/settings/system-users"
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-1 text-xs font-medium text-emerald-600 hover:underline"
                    >
                      Gerar token permanente <ExternalLink className="h-3 w-3" />
                    </a>
                  </div>
                </div>
              </div>
            </li>
            <li className="rounded-md border bg-card p-3">
              <div className="flex items-start gap-3">
                <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-emerald-600 text-[11px] font-bold text-white">3</span>
                <div className="w-full space-y-1.5">
                  <p className="text-sm font-medium">Configure o Webhook (receber mensagens)</p>
                  <p className="text-xs text-muted-foreground">
                    Em <strong>WhatsApp → Configuração</strong>, cole a URL abaixo, use o <em>token de verificação</em> e assine o campo <strong>messages</strong>.
                  </p>
                  <div className="flex items-center gap-2 rounded-md border bg-muted/40 px-2 py-1.5">
                    <code className="flex-1 truncate text-[11px]">{webhookUrl}</code>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="h-7 px-2 text-xs"
                      onClick={() => {
                        navigator.clipboard.writeText(webhookUrl);
                        toast.success("URL copiada.");
                      }}
                    >
                      Copiar
                    </Button>
                  </div>
                </div>
              </div>
            </li>
          </ol>

          <div className="space-y-3 border-t pt-4">
            <p className="text-sm font-medium">Preencha com os dados copiados</p>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1">
                <Label className="text-xs">Nome / Identificação</Label>
                <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Ex: Comercial AL" />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Número exibido</Label>
                <Input value={form.display_phone} onChange={(e) => setForm({ ...form, display_phone: e.target.value })} placeholder="+55 82 9...." />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Phone Number ID</Label>
                <Input value={form.phone_number_id} onChange={(e) => setForm({ ...form, phone_number_id: e.target.value })} placeholder="1234567890" />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Business Account ID</Label>
                <Input value={form.business_account_id} onChange={(e) => setForm({ ...form, business_account_id: e.target.value })} placeholder="opcional" />
              </div>
              <div className="space-y-1 sm:col-span-2">
                <Label className="text-xs">Token de acesso (permanente)</Label>
                <Input type="password" value={form.access_token} onChange={(e) => setForm({ ...form, access_token: e.target.value })} placeholder="EAAG..." />
              </div>
            </div>
            <p className="inline-flex items-center gap-1 text-[11px] text-muted-foreground">
              <CheckCircle2 className="h-3 w-3 text-emerald-600" /> As credenciais são armazenadas com segurança no servidor.
            </p>
          </div>
        </div>

        <DialogFooter>
          <Button onClick={handleAdd} disabled={saving} className="bg-emerald-600 hover:bg-emerald-700">
            <Plus className="mr-1 h-4 w-4" /> {saving ? "Salvando..." : "Adicionar conta"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
