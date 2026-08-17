import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import {
  Search, ShieldCheck, Save, Loader2, UserCog, IdCard, Plus, Pencil, Trash2,
  ShieldAlert, Download, KeyRound, Lock, LockOpen, Copy, RefreshCw, History,
  Users, Link2, CheckCircle2, AlertCircle, LogOut, Undo2, Trash,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { RhPageHeader, rhNav } from "@/components/rh/RhLayout";
import { useRhAccess } from "@/hooks/use-rh-access";
import { ACCESS_PRESETS, AUDIT_LABELS } from "@/lib/rh/access-presets";
import {
  listRhUsers,
  setRhUserAccess,
  listRhEmployees,
  linkEmployeeUser,
  createRhUser,
  updateRhUser,
  deleteRhUser,
  setRhUserBlocked,
  generateRhRecoveryLink,
  bulkSetRhAccess,
  copyRhAccess,
  listRhAccessAudit,
  getConsultoraSyncStatus,
  syncConsultoraFromUsers,
  revokeRhUserSessions,
  revertRhAccessAudit,
  purgeRhAccessAudit,
  type RhUserAccess,
} from "@/lib/rh/access.functions";

export const Route = createFileRoute("/_authenticated/rh/acessos")({
  component: AcessosPage,
});

// Tabs an admin can grant (exclude self-management / always-allowed entries).
const GRANTABLE = rhNav.filter((n) => !["/rh/dashboard", "/rh/portal"].includes(n.to));
const PAGE_SIZE = 20;

type FilterKey = "todos" | "admins" | "comuns" | "sem-acesso" | "com-acesso" | "sem-colaborador" | "bloqueados" | "inativos30";

const FILTERS: { key: FilterKey; label: string }[] = [
  { key: "todos", label: "Todos" },
  { key: "admins", label: "Admins" },
  { key: "comuns", label: "Comuns" },
  { key: "com-acesso", label: "Com acesso" },
  { key: "sem-acesso", label: "Sem acesso" },
  { key: "sem-colaborador", label: "Sem colaborador" },
  { key: "bloqueados", label: "Bloqueados" },
  { key: "inativos30", label: "Inativos 30d" },
];

const fmtDate = (v: string | null) =>
  v ? new Date(v).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "2-digit" }) : "—";

const fmtDateTime = (v: string) =>
  new Date(v).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });

const labelForTab = (to: string) => rhNav.find((n) => n.to === to)?.label ?? to;

function AcessosPage() {
  const { isAdmin, isAccessManager, isLoading: accessLoading } = useRhAccess();
  // Admin faz tudo; gestor de acessos apenas libera/remove abas.
  const canManageUsers = isAdmin;
  const canGrant = isAdmin || isAccessManager;
  const queryClient = useQueryClient();
  const fetchUsers = useServerFn(listRhUsers);
  const saveAccess = useServerFn(setRhUserAccess);
  const fetchEmployees = useServerFn(listRhEmployees);
  const linkEmployee = useServerFn(linkEmployeeUser);
  const createUser = useServerFn(createRhUser);
  const updateUser = useServerFn(updateRhUser);
  const removeUser = useServerFn(deleteRhUser);
  const blockUser = useServerFn(setRhUserBlocked);
  const recoveryLink = useServerFn(generateRhRecoveryLink);
  const bulkAccess = useServerFn(bulkSetRhAccess);
  const copyAccess = useServerFn(copyRhAccess);
  const fetchAudit = useServerFn(listRhAccessAudit);
  const fetchSync = useServerFn(getConsultoraSyncStatus);
  const syncConsultoras = useServerFn(syncConsultoraFromUsers);
  const revokeSessions = useServerFn(revokeRhUserSessions);
  const revertAudit = useServerFn(revertRhAccessAudit);
  const purgeAudit = useServerFn(purgeRhAccessAudit);

  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<FilterKey>("todos");
  const [page, setPage] = useState(0);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [draft, setDraft] = useState<Set<string>>(new Set());
  const [checked, setChecked] = useState<Set<string>>(new Set());

  // Dialogs
  const [userDialog, setUserDialog] = useState<null | { mode: "create" | "edit" }>(null);
  const [form, setForm] = useState({ email: "", password: "", isAdmin: false });
  const [deleteTarget, setDeleteTarget] = useState<RhUserAccess | null>(null);
  const [bulkDialog, setBulkDialog] = useState(false);
  const [bulkTabs, setBulkTabs] = useState<Set<string>>(new Set());
  const [bulkMode, setBulkMode] = useState<"replace" | "add" | "remove">("add");
  const [copyFrom, setCopyFrom] = useState<string>("");
  const [linkDialog, setLinkDialog] = useState<{ email: string; link: string } | null>(null);
  const [auditFilters, setAuditFilters] = useState({
    actor: "",
    target: "",
    action: "",
    from: "",
    to: "",
  });

  const usersQuery = useQuery({
    queryKey: ["rh", "admin", "users"],
    queryFn: () => fetchUsers(),
    enabled: canGrant,
  });

  const employeesQuery = useQuery({
    queryKey: ["rh", "admin", "employees"],
    queryFn: () => fetchEmployees(),
    enabled: canGrant,
  });

  const auditQuery = useQuery({
    queryKey: ["rh", "admin", "audit", auditFilters],
    queryFn: () => fetchAudit({ data: { ...auditFilters, limit: 200 } }),
    enabled: isAdmin,
  });

  const syncQuery = useQuery({
    queryKey: ["rh", "admin", "consultora-sync"],
    queryFn: () => fetchSync(),
    enabled: isAdmin,
  });

  const employees = employeesQuery.data ?? [];
  const users = useMemo(() => usersQuery.data ?? [], [usersQuery.data]);
  const selected = useMemo(
    () => users.find((u) => u.id === selectedId) ?? null,
    [users, selectedId],
  );

  useEffect(() => {
    if (selected) setDraft(new Set(selected.tabs));
  }, [selected]);

  useEffect(() => {
    setPage(0);
  }, [search, filter]);

  const invalidateUsers = () => {
    queryClient.invalidateQueries({ queryKey: ["rh", "admin", "users"] });
    queryClient.invalidateQueries({ queryKey: ["rh", "admin", "audit"] });
    queryClient.invalidateQueries({ queryKey: ["rh", "admin", "consultora-sync"] });
  };

  const mutation = useMutation({
    mutationFn: (vars: { userId: string; tabs: string[] }) => saveAccess({ data: vars }),
    onSuccess: () => {
      toast.success("Acessos atualizados.");
      invalidateUsers();
      queryClient.invalidateQueries({ queryKey: ["rh", "my-access"] });
    },
    onError: (e: unknown) => toast.error(e instanceof Error ? e.message : "Erro ao salvar."),
  });

  const linkMutation = useMutation({
    mutationFn: (vars: { userId: string; employeeId: string | null }) =>
      linkEmployee({ data: vars }),
    onSuccess: () => {
      toast.success("Colaborador vinculado.");
      invalidateUsers();
      queryClient.invalidateQueries({ queryKey: ["rh", "admin", "employees"] });
    },
    onError: (e: unknown) => toast.error(e instanceof Error ? e.message : "Erro ao vincular."),
  });

  const saveUserMutation = useMutation({
    mutationFn: async () => {
      if (userDialog?.mode === "create") {
        return createUser({
          data: { email: form.email, password: form.password, isAdmin: form.isAdmin },
        });
      }
      return updateUser({
        data: {
          targetUserId: selectedId!,
          email: form.email || undefined,
          password: form.password || undefined,
          isAdmin: form.isAdmin,
        },
      });
    },
    onSuccess: () => {
      toast.success(userDialog?.mode === "create" ? "Usuário criado." : "Usuário atualizado.");
      setUserDialog(null);
      setForm({ email: "", password: "", isAdmin: false });
      invalidateUsers();
      queryClient.invalidateQueries({ queryKey: ["rh", "my-access"] });
    },
    onError: (e: unknown) => toast.error(e instanceof Error ? e.message : "Erro ao salvar usuário."),
  });

  const deleteUserMutation = useMutation({
    mutationFn: (targetUserId: string) => removeUser({ data: { targetUserId } }),
    onSuccess: () => {
      toast.success("Usuário excluído.");
      setDeleteTarget(null);
      if (selectedId === deleteTarget?.id) setSelectedId(null);
      invalidateUsers();
    },
    onError: (e: unknown) => toast.error(e instanceof Error ? e.message : "Erro ao excluir."),
  });

  const blockMutation = useMutation({
    mutationFn: (vars: { targetUserId: string; blocked: boolean }) => blockUser({ data: vars }),
    onSuccess: (_d, vars) => {
      toast.success(vars.blocked ? "Usuário bloqueado." : "Usuário desbloqueado.");
      invalidateUsers();
    },
    onError: (e: unknown) => toast.error(e instanceof Error ? e.message : "Erro ao alterar status."),
  });

  const revokeMutation = useMutation({
    mutationFn: (targetUserId: string) => revokeSessions({ data: { targetUserId } }),
    onSuccess: () => {
      toast.success("Sessões encerradas.");
      invalidateUsers();
    },
    onError: (e: unknown) =>
      toast.error(e instanceof Error ? e.message : "Erro ao encerrar sessões."),
  });

  const onRevokeSessions = (u: RhUserAccess) => {
    if (!confirm(`Encerrar todas as sessões ativas de ${u.email}?`)) return;
    revokeMutation.mutate(u.id);
  };

  const revertMutation = useMutation({
    mutationFn: (auditId: string) => revertAudit({ data: { auditId } }),
    onSuccess: () => {
      toast.success("Alteração revertida.");
      invalidateUsers();
    },
    onError: (e: unknown) => toast.error(e instanceof Error ? e.message : "Erro ao reverter."),
  });

  const purgeMutation = useMutation({
    mutationFn: (meses: number) => purgeAudit({ data: { meses } }),
    onSuccess: () => {
      toast.success("Histórico antigo removido.");
      queryClient.invalidateQueries({ queryKey: ["rh", "admin", "audit"] });
    },
    onError: (e: unknown) => toast.error(e instanceof Error ? e.message : "Erro ao limpar."),
  });

  const recoveryMutation = useMutation({
    mutationFn: (email: string) => recoveryLink({ data: { email } }),
    onSuccess: (res, email) => {
      setLinkDialog({ email, link: res.link });
      queryClient.invalidateQueries({ queryKey: ["rh", "admin", "audit"] });
    },
    onError: (e: unknown) => toast.error(e instanceof Error ? e.message : "Erro ao gerar link."),
  });

  const bulkMutation = useMutation({
    mutationFn: () =>
      bulkAccess({
        data: { userIds: Array.from(checked), tabs: Array.from(bulkTabs), mode: bulkMode },
      }),
    onSuccess: (res) => {
      toast.success(`Acessos aplicados a ${res.affected} usuário(s).`);
      setBulkDialog(false);
      setChecked(new Set());
      setBulkTabs(new Set());
      invalidateUsers();
      queryClient.invalidateQueries({ queryKey: ["rh", "my-access"] });
    },
    onError: (e: unknown) => toast.error(e instanceof Error ? e.message : "Erro na ação em massa."),
  });

  const copyMutation = useMutation({
    mutationFn: () => copyAccess({ data: { fromUserId: copyFrom, toUserIds: Array.from(checked) } }),
    onSuccess: (res) => {
      toast.success(`${res.tabs} aba(s) copiadas para ${checked.size} usuário(s).`);
      setChecked(new Set());
      setCopyFrom("");
      invalidateUsers();
    },
    onError: (e: unknown) => toast.error(e instanceof Error ? e.message : "Erro ao copiar acessos."),
  });

  const syncMutation = useMutation({
    mutationFn: (emails: string[]) => syncConsultoras({ data: { emails } }),
    onSuccess: (res) => {
      toast.success(`${res.criadas} consultora(s) criada(s), ${res.ativadas} reativada(s).`);
      invalidateUsers();
    },
    onError: (e: unknown) => toast.error(e instanceof Error ? e.message : "Erro ao sincronizar."),
  });

  const openCreate = () => {
    setForm({ email: "", password: "", isAdmin: false });
    setUserDialog({ mode: "create" });
  };

  const openEdit = (u: RhUserAccess) => {
    setSelectedId(u.id);
    setForm({ email: u.email, password: "", isAdmin: u.isAdmin });
    setUserDialog({ mode: "edit" });
  };

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    const limite30 = Date.now() - 30 * 24 * 60 * 60 * 1000;
    return users.filter((u) => {
      if (term && !u.email.toLowerCase().includes(term) &&
        !(u.employee?.full_name ?? "").toLowerCase().includes(term)) return false;
      switch (filter) {
        case "admins": return u.isAdmin;
        case "comuns": return !u.isAdmin;
        case "com-acesso": return u.tabs.length > 0;
        case "sem-acesso": return u.tabs.length === 0 && !u.isAdmin;
        case "sem-colaborador": return !u.employee;
        case "bloqueados": return u.blocked;
        case "inativos30":
          return !u.lastSignInAt || new Date(u.lastSignInAt).getTime() < limite30;
        default: return true;
      }
    });
  }, [users, search, filter]);

  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const pageItems = filtered.slice(page * PAGE_SIZE, page * PAGE_SIZE + PAGE_SIZE);

  const resumo = useMemo(() => {
    const limite30 = Date.now() - 30 * 24 * 60 * 60 * 1000;
    return {
      total: users.length,
      admins: users.filter((u) => u.isAdmin).length,
      semAcesso: users.filter((u) => !u.isAdmin && u.tabs.length === 0).length,
      semColaborador: users.filter((u) => !u.employee).length,
      bloqueados: users.filter((u) => u.blocked).length,
      inativos: users.filter(
        (u) => !u.lastSignInAt || new Date(u.lastSignInAt).getTime() < limite30,
      ).length,
    };
  }, [users]);

  const exportCsv = () => {
    const head = ["email", "colaborador", "admin", "bloqueado", "abas", "criado_em", "ultimo_login", "consultora"];
    const rows = filtered.map((u) => [
      u.email,
      u.employee?.full_name ?? "",
      u.isAdmin ? "sim" : "nao",
      u.blocked ? "sim" : "nao",
      u.tabs.map(labelForTab).join(" | "),
      fmtDate(u.createdAt),
      fmtDate(u.lastSignInAt),
      u.hasConsultora ? "sim" : "nao",
    ]);
    const csv = [head, ...rows]
      .map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(";"))
      .join("\n");
    const url = URL.createObjectURL(new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = `acessos-rh-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  if (accessLoading) return <Skeleton className="h-64 w-full" />;

  if (!canGrant) {
    return (
      <Card className="mx-auto max-w-md">
        <CardContent className="flex flex-col items-center gap-3 py-12 text-center">
          <ShieldCheck className="h-10 w-10 text-muted-foreground" />
          <p className="font-medium">Acesso restrito</p>
          <p className="text-sm text-muted-foreground">
            Apenas administradores ou gestores de acessos podem gerenciar os acessos do RH.
          </p>
        </CardContent>
      </Card>
    );
  }

  const toggle = (to: string, on: boolean) => {
    setDraft((prev) => {
      const next = new Set(prev);
      if (on) next.add(to);
      else next.delete(to);
      return next;
    });
  };

  const toggleChecked = (id: string, on: boolean) => {
    setChecked((prev) => {
      const next = new Set(prev);
      if (on) next.add(id);
      else next.delete(id);
      return next;
    });
  };

  const dirty =
    !!selected &&
    (draft.size !== selected.tabs.length || selected.tabs.some((t) => !draft.has(t)));

  const sync = syncQuery.data;

  return (
    <div>
      <RhPageHeader
        title="Acessos ao RH"
        description="Gerencie usuários, permissões por aba, status das contas e a sincronização com as consultoras."
      />

      {/* Bloco 10 — resumo */}
      <div className="mb-6 grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-6">
        {[
          { label: "Usuários", value: resumo.total, icon: Users },
          { label: "Admins", value: resumo.admins, icon: ShieldAlert },
          { label: "Sem acesso", value: resumo.semAcesso, icon: AlertCircle },
          { label: "Sem colaborador", value: resumo.semColaborador, icon: IdCard },
          { label: "Bloqueados", value: resumo.bloqueados, icon: Lock },
          { label: "Inativos 30d", value: resumo.inativos, icon: History },
        ].map((s) => (
          <Card key={s.label}>
            <CardContent className="flex items-center gap-3 p-4">
              <s.icon className="h-5 w-5 shrink-0 text-muted-foreground" />
              <div className="min-w-0">
                <p className="text-xl font-bold leading-none">{s.value}</p>
                <p className="truncate text-xs text-muted-foreground">{s.label}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Tabs defaultValue="usuarios">
        <TabsList className="mb-4">
          <TabsTrigger value="usuarios">Usuários e acessos</TabsTrigger>
          <TabsTrigger value="consultoras">Consultoras</TabsTrigger>
          <TabsTrigger value="historico">Histórico</TabsTrigger>
        </TabsList>

        <TabsContent value="usuarios">
          <div className="grid gap-6 lg:grid-cols-[380px_1fr]">
            {/* Lista de usuários */}
            <Card className="h-fit">
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between gap-2">
                  <CardTitle className="text-base">Usuários</CardTitle>
                  <div className="flex gap-1">
                    <Button size="sm" variant="outline" onClick={exportCsv} title="Exportar CSV">
                      <Download className="h-4 w-4" />
                    </Button>
                    {canManageUsers && (
                      <Button size="sm" onClick={openCreate}>
                        <Plus className="mr-1 h-4 w-4" />
                        Novo
                      </Button>
                    )}
                  </div>
                </div>
                <div className="relative mt-2">
                  <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                  <Input
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="Buscar por e-mail ou colaborador…"
                    className="pl-8"
                  />
                </div>
                <div className="mt-2 flex flex-wrap gap-1">
                  {FILTERS.map((f) => (
                    <button
                      key={f.key}
                      onClick={() => setFilter(f.key)}
                      className={`rounded-full border px-2.5 py-1 text-xs transition ${
                        filter === f.key
                          ? "border-primary bg-primary text-primary-foreground"
                          : "hover:bg-muted"
                      }`}
                    >
                      {f.label}
                    </button>
                  ))}
                </div>
              </CardHeader>
              <CardContent className="p-0">
                {/* Bloco 3 — ações em massa */}
                {checked.size > 0 && (
                  <div className="mx-3 mb-2 space-y-2 rounded-lg border bg-muted/40 p-2.5">
                    <p className="text-xs font-medium">{checked.size} selecionado(s)</p>
                    <div className="flex flex-wrap gap-1.5">
                      <Button size="sm" variant="outline" onClick={() => setBulkDialog(true)}>
                        Aplicar abas
                      </Button>
                      <Button size="sm" variant="ghost" onClick={() => setChecked(new Set())}>
                        Limpar
                      </Button>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <Select value={copyFrom} onValueChange={setCopyFrom}>
                        <SelectTrigger className="h-8 text-xs">
                          <SelectValue placeholder="Copiar acessos de…" />
                        </SelectTrigger>
                        <SelectContent>
                          {users.map((u) => (
                            <SelectItem key={u.id} value={u.id}>
                              {u.employee?.full_name ?? u.email} ({u.tabs.length})
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={!copyFrom || copyMutation.isPending}
                        onClick={() => copyMutation.mutate()}
                      >
                        <Copy className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </div>
                )}

                <ScrollArea className="h-[460px]">
                  <div className="space-y-1 p-3 pt-0">
                    {usersQuery.isLoading ? (
                      Array.from({ length: 6 }).map((_, i) => (
                        <Skeleton key={i} className="h-14 w-full" />
                      ))
                    ) : pageItems.length ? (
                      pageItems.map((u: RhUserAccess) => (
                        <div
                          key={u.id}
                          className={`flex w-full items-center gap-1 rounded-lg border px-2 py-2 text-sm transition ${
                            u.id === selectedId ? "border-primary bg-primary/5" : "hover:bg-muted"
                          }`}
                        >
                          <Checkbox
                            checked={checked.has(u.id)}
                            onCheckedChange={(v) => toggleChecked(u.id, v === true)}
                            className="shrink-0"
                          />
                          <button
                            onClick={() => setSelectedId(u.id)}
                            className="flex min-w-0 flex-1 items-center gap-2 text-left"
                          >
                            <span className="min-w-0 flex-1">
                              <span className="block truncate">
                                {u.employee ? u.employee.full_name : u.email}
                              </span>
                              <span className="block truncate text-xs text-muted-foreground">
                                {u.employee ? `${u.email} · ` : ""}
                                último acesso {fmtDate(u.lastSignInAt)}
                              </span>
                            </span>
                            {u.blocked && (
                              <Badge variant="destructive" className="shrink-0 gap-1">
                                <Lock className="h-3 w-3" />
                              </Badge>
                            )}
                            {u.isAdmin && (
                              <Badge variant="default" className="shrink-0 gap-1">
                                <ShieldAlert className="h-3 w-3" />
                              </Badge>
                            )}
                            <Badge variant="secondary" className="shrink-0">
                              {u.tabs.length}
                            </Badge>
                          </button>
                          {canManageUsers && (
                            <>
                              <Button
                                size="icon"
                                variant="ghost"
                                className="h-7 w-7 shrink-0"
                                onClick={() => openEdit(u)}
                                title="Editar usuário"
                              >
                                <Pencil className="h-3.5 w-3.5" />
                              </Button>
                              <Button
                                size="icon"
                                variant="ghost"
                                className="h-7 w-7 shrink-0"
                                onClick={() => onRevokeSessions(u)}
                                title="Encerrar sessões ativas"
                              >
                                <LogOut className="h-3.5 w-3.5" />
                              </Button>
                              <Button
                                size="icon"
                                variant="ghost"
                                className="h-7 w-7 shrink-0 text-destructive hover:text-destructive"
                                onClick={() => setDeleteTarget(u)}
                                title="Excluir usuário"
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </Button>
                            </>
                          )}
                        </div>
                      ))
                    ) : (
                      <p className="px-3 py-6 text-center text-sm text-muted-foreground">
                        Nenhum usuário encontrado.
                      </p>
                    )}
                  </div>
                </ScrollArea>

                {/* Bloco 1 — paginação */}
                <div className="flex items-center justify-between border-t px-3 py-2 text-xs text-muted-foreground">
                  <span>
                    {filtered.length} resultado(s) · página {page + 1}/{pageCount}
                  </span>
                  <div className="flex gap-1">
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={page === 0}
                      onClick={() => setPage((p) => p - 1)}
                    >
                      Anterior
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={page + 1 >= pageCount}
                      onClick={() => setPage((p) => p + 1)}
                    >
                      Próxima
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Detalhe do usuário */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-base">
                  <UserCog className="h-4 w-4" />
                  {selected ? selected.email : "Selecione um usuário"}
                </CardTitle>
              </CardHeader>
              <CardContent>
                {!selected ? (
                  <p className="py-12 text-center text-sm text-muted-foreground">
                    Escolha um usuário na lista para definir os acessos.
                  </p>
                ) : (
                  <>
                    {/* Bloco 2 — status da conta */}
                    <div className="mb-4 grid gap-3 rounded-lg border bg-muted/30 p-3 sm:grid-cols-2">
                      <div className="text-xs text-muted-foreground">
                        <p>Criado em: <strong className="text-foreground">{fmtDate(selected.createdAt)}</strong></p>
                        <p>Último acesso: <strong className="text-foreground">{fmtDate(selected.lastSignInAt)}</strong></p>
                        <p className="flex items-center gap-1">
                          E-mail:{" "}
                          <strong className="text-foreground">
                            {selected.emailConfirmed ? "confirmado" : "não confirmado"}
                          </strong>
                        </p>
                      </div>
                      <div className="flex flex-wrap items-start gap-2">
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={recoveryMutation.isPending}
                          onClick={() => recoveryMutation.mutate(selected.email)}
                        >
                          <KeyRound className="mr-1 h-3.5 w-3.5" />
                          Link de senha
                        </Button>
                        <Button
                          size="sm"
                          variant={selected.blocked ? "default" : "outline"}
                          disabled={blockMutation.isPending}
                          onClick={() =>
                            blockMutation.mutate({
                              targetUserId: selected.id,
                              blocked: !selected.blocked,
                            })
                          }
                        >
                          {selected.blocked ? (
                            <><LockOpen className="mr-1 h-3.5 w-3.5" />Desbloquear</>
                          ) : (
                            <><Lock className="mr-1 h-3.5 w-3.5" />Bloquear</>
                          )}
                        </Button>
                      </div>
                    </div>

                    <div className="mb-4 rounded-lg border bg-muted/30 p-3">
                      <label className="flex items-center gap-2 text-sm font-medium">
                        <IdCard className="h-4 w-4 text-muted-foreground" />
                        Colaborador vinculado
                      </label>
                      <p className="mb-2 mt-1 text-xs text-muted-foreground">
                        Vincule este acesso a um colaborador cadastrado.
                      </p>
                      <Select
                        value={selected.employee?.id ?? "none"}
                        disabled={linkMutation.isPending}
                        onValueChange={(v) =>
                          linkMutation.mutate({
                            userId: selected.id,
                            employeeId: v === "none" ? null : v,
                          })
                        }
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Selecionar colaborador" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="none">Sem vínculo</SelectItem>
                          {employees.map((e) => (
                            <SelectItem
                              key={e.id}
                              value={e.id}
                              disabled={!!e.user_id && e.user_id !== selected.id}
                            >
                              {e.full_name}
                              {e.job_title ? ` — ${e.job_title}` : ""}
                              {e.user_id && e.user_id !== selected.id ? " (já vinculado)" : ""}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    {/* Bloco 4 — perfis de acesso */}
                    <div className="mb-3">
                      <p className="mb-2 text-xs font-medium text-muted-foreground">
                        Perfis prontos
                      </p>
                      <div className="flex flex-wrap gap-1.5">
                        {ACCESS_PRESETS.map((p) => (
                          <Button
                            key={p.key}
                            size="sm"
                            variant="secondary"
                            title={p.description}
                            onClick={() => setDraft(new Set(p.tabs))}
                          >
                            {p.label}
                          </Button>
                        ))}
                      </div>
                    </div>

                    <div className="mb-3 flex flex-wrap items-center gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => setDraft(new Set(GRANTABLE.map((n) => n.to)))}
                      >
                        Selecionar tudo
                      </Button>
                      <Button size="sm" variant="outline" onClick={() => setDraft(new Set())}>
                        Limpar
                      </Button>
                      <span className="ml-auto text-xs text-muted-foreground">
                        Dashboard e Portal são liberados a todos.
                      </span>
                    </div>
                    <Separator className="mb-4" />

                    <div className="grid gap-2 sm:grid-cols-2">
                      {GRANTABLE.map((n) => {
                        const Icon = n.icon;
                        return (
                          <label
                            key={n.to}
                            className="flex cursor-pointer items-center gap-3 rounded-lg border p-3 text-sm transition hover:bg-muted"
                          >
                            <Checkbox
                              checked={draft.has(n.to)}
                              onCheckedChange={(v) => toggle(n.to, v === true)}
                            />
                            <Icon className="h-4 w-4 shrink-0 text-muted-foreground" />
                            <span className="flex-1">{n.label}</span>
                          </label>
                        );
                      })}
                    </div>
                    <div className="mt-6 flex justify-end">
                      <Button
                        disabled={!dirty || mutation.isPending}
                        onClick={() =>
                          mutation.mutate({ userId: selected.id, tabs: Array.from(draft) })
                        }
                      >
                        {mutation.isPending ? (
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        ) : (
                          <Save className="mr-2 h-4 w-4" />
                        )}
                        Salvar acessos
                      </Button>
                    </div>
                  </>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Bloco 9 — sincronização com consultoras */}
        <TabsContent value="consultoras">
          <Card>
            <CardHeader className="pb-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <CardTitle className="flex items-center gap-2 text-base">
                  <Link2 className="h-4 w-4" />
                  Sincronização com consultoras
                </CardTitle>
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => syncQuery.refetch()}
                    disabled={syncQuery.isFetching}
                  >
                    <RefreshCw className={`mr-1 h-4 w-4 ${syncQuery.isFetching ? "animate-spin" : ""}`} />
                    Atualizar
                  </Button>
                  <Button
                    size="sm"
                    disabled={!sync?.usuariosSemConsultora.length || syncMutation.isPending}
                    onClick={() =>
                      syncMutation.mutate((sync?.usuariosSemConsultora ?? []).map((u) => u.email))
                    }
                  >
                    {syncMutation.isPending && <Loader2 className="mr-1 h-4 w-4 animate-spin" />}
                    Criar consultoras faltantes
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {syncQuery.isLoading ? (
                <Skeleton className="h-40 w-full" />
              ) : (
                <div className="grid gap-4 lg:grid-cols-2">
                  <div className="rounded-lg border p-3">
                    <p className="mb-2 flex items-center gap-2 text-sm font-medium">
                      <AlertCircle className="h-4 w-4 text-amber-500" />
                      Usuários sem consultora ({sync?.usuariosSemConsultora.length ?? 0})
                    </p>
                    <ScrollArea className="h-56">
                      <div className="space-y-1 pr-3">
                        {(sync?.usuariosSemConsultora ?? []).map((u) => (
                          <div
                            key={u.id}
                            className="flex items-center justify-between gap-2 rounded border px-2 py-1.5 text-xs"
                          >
                            <span className="truncate">{u.email}</span>
                            <Button
                              size="sm"
                              variant="ghost"
                              className="h-6 px-2 text-xs"
                              onClick={() => syncMutation.mutate([u.email])}
                            >
                              Criar
                            </Button>
                          </div>
                        ))}
                        {!sync?.usuariosSemConsultora.length && (
                          <p className="flex items-center gap-2 py-6 text-center text-xs text-muted-foreground">
                            <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                            Todos os usuários têm consultora cadastrada.
                          </p>
                        )}
                      </div>
                    </ScrollArea>
                  </div>

                  <div className="rounded-lg border p-3">
                    <p className="mb-2 flex items-center gap-2 text-sm font-medium">
                      <AlertCircle className="h-4 w-4 text-amber-500" />
                      Consultoras sem usuário ({sync?.consultorasSemUsuario.length ?? 0})
                    </p>
                    <p className="mb-2 text-xs text-muted-foreground">
                      {sync?.consultorasAtivas ?? 0} ativas de {sync?.totalConsultoras ?? 0} cadastradas.
                    </p>
                    <ScrollArea className="h-48">
                      <div className="space-y-1 pr-3">
                        {(sync?.consultorasSemUsuario ?? []).map((c) => (
                          <div
                            key={c.id}
                            className="flex items-center justify-between gap-2 rounded border px-2 py-1.5 text-xs"
                          >
                            <span className="truncate">
                              {c.nome}
                              <span className="block text-muted-foreground">
                                {c.email ?? "sem e-mail"}
                              </span>
                            </span>
                            <Badge variant={c.ativo ? "secondary" : "outline"}>
                              {c.ativo ? "ativa" : "inativa"}
                            </Badge>
                          </div>
                        ))}
                        {!sync?.consultorasSemUsuario.length && (
                          <p className="py-6 text-center text-xs text-muted-foreground">
                            Nenhuma pendência.
                          </p>
                        )}
                      </div>
                    </ScrollArea>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Bloco 6 — auditoria */}
        <TabsContent value="historico">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-base">
                <History className="h-4 w-4" />
                Histórico de alterações
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {/* Filtros do histórico */}
              <div className="grid gap-2 sm:grid-cols-5">
                <Input
                  placeholder="Quem alterou"
                  value={auditFilters.actor}
                  onChange={(e) => setAuditFilters((f) => ({ ...f, actor: e.target.value }))}
                />
                <Input
                  placeholder="Usuário alvo"
                  value={auditFilters.target}
                  onChange={(e) => setAuditFilters((f) => ({ ...f, target: e.target.value }))}
                />
                <Select
                  value={auditFilters.action || "todas"}
                  onValueChange={(v) =>
                    setAuditFilters((f) => ({ ...f, action: v === "todas" ? "" : v }))
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Ação" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="todas">Todas as ações</SelectItem>
                    {Object.entries(AUDIT_LABELS).map(([k, label]) => (
                      <SelectItem key={k} value={k}>
                        {label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Input
                  type="date"
                  value={auditFilters.from}
                  onChange={(e) => setAuditFilters((f) => ({ ...f, from: e.target.value }))}
                />
                <Input
                  type="date"
                  value={auditFilters.to}
                  onChange={(e) => setAuditFilters((f) => ({ ...f, to: e.target.value }))}
                />
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() =>
                    setAuditFilters({ actor: "", target: "", action: "", from: "", to: "" })
                  }
                >
                  Limpar filtros
                </Button>
                {isAdmin && (
                  <Button
                    size="sm"
                    variant="outline"
                    className="ml-auto text-destructive hover:text-destructive"
                    disabled={purgeMutation.isPending}
                    onClick={() => {
                      if (!confirm("Remover registros com mais de 12 meses?")) return;
                      purgeMutation.mutate(12);
                    }}
                  >
                    <Trash className="mr-1.5 h-3.5 w-3.5" />
                    Limpar antigos (12 meses)
                  </Button>
                )}
              </div>

              {auditQuery.isLoading ? (
                <Skeleton className="h-40 w-full" />
              ) : auditQuery.data?.length ? (
                <div className="space-y-1">
                  {auditQuery.data.map((a) => {
                    const revertivel =
                      (a.action === "atualizou_acessos" || a.action === "acessos_em_massa") &&
                      !!a.detail?.before;
                    return (
                      <div
                        key={a.id}
                        className="flex flex-wrap items-center gap-2 rounded-lg border px-3 py-2 text-sm"
                      >
                        <Badge variant="secondary">{AUDIT_LABELS[a.action] ?? a.action}</Badge>
                        <span className="text-muted-foreground">
                          por{" "}
                          <strong className="text-foreground">{a.actor_email ?? "sistema"}</strong>
                          {a.target_email ? ` · alvo ${a.target_email}` : ""}
                        </span>
                        <span className="ml-auto text-xs text-muted-foreground">
                          {fmtDateTime(a.created_at)}
                        </span>
                        {isAdmin && revertivel && (
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-7"
                            disabled={revertMutation.isPending}
                            onClick={() => {
                              if (!confirm("Restaurar as abas anteriores desta alteração?")) return;
                              revertMutation.mutate(a.id);
                            }}
                          >
                            <Undo2 className="mr-1.5 h-3.5 w-3.5" />
                            Reverter
                          </Button>
                        )}
                      </div>
                    );
                  })}
                </div>
              ) : (
                <p className="py-10 text-center text-sm text-muted-foreground">
                  Nenhuma alteração registrada.
                </p>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Ações em massa */}
      <Dialog open={bulkDialog} onOpenChange={setBulkDialog}>
        <DialogContent className="max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Aplicar abas em massa</DialogTitle>
            <DialogDescription>
              {checked.size} usuário(s) selecionado(s).
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-1">
            <Select value={bulkMode} onValueChange={(v) => setBulkMode(v as typeof bulkMode)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="add">Adicionar as abas selecionadas</SelectItem>
                <SelectItem value="remove">Remover as abas selecionadas</SelectItem>
                <SelectItem value="replace">Substituir todos os acessos</SelectItem>
              </SelectContent>
            </Select>

            <div className="flex flex-wrap gap-1.5">
              {ACCESS_PRESETS.map((p) => (
                <Button
                  key={p.key}
                  size="sm"
                  variant="secondary"
                  onClick={() => setBulkTabs(new Set(p.tabs))}
                >
                  {p.label}
                </Button>
              ))}
              <Button size="sm" variant="ghost" onClick={() => setBulkTabs(new Set())}>
                Limpar
              </Button>
            </div>

            <div className="grid max-h-64 gap-1.5 overflow-y-auto sm:grid-cols-2">
              {GRANTABLE.map((n) => (
                <label
                  key={n.to}
                  className="flex cursor-pointer items-center gap-2 rounded border p-2 text-sm hover:bg-muted"
                >
                  <Checkbox
                    checked={bulkTabs.has(n.to)}
                    onCheckedChange={(v) =>
                      setBulkTabs((prev) => {
                        const next = new Set(prev);
                        if (v === true) next.add(n.to);
                        else next.delete(n.to);
                        return next;
                      })
                    }
                  />
                  <span className="flex-1 truncate">{n.label}</span>
                </label>
              ))}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setBulkDialog(false)}>
              Cancelar
            </Button>
            <Button disabled={bulkMutation.isPending} onClick={() => bulkMutation.mutate()}>
              {bulkMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Aplicar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Link de redefinição */}
      <Dialog open={!!linkDialog} onOpenChange={(o) => !o && setLinkDialog(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Link de redefinição de senha</DialogTitle>
            <DialogDescription>
              Envie este link para <strong>{linkDialog?.email}</strong>. Ele é de uso único.
            </DialogDescription>
          </DialogHeader>
          <div className="flex gap-2">
            <Input readOnly value={linkDialog?.link ?? ""} className="text-xs" />
            <Button
              variant="outline"
              onClick={() => {
                navigator.clipboard.writeText(linkDialog?.link ?? "");
                toast.success("Link copiado.");
              }}
            >
              <Copy className="h-4 w-4" />
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Create / edit user dialog */}
      <Dialog open={!!userDialog} onOpenChange={(o) => !o && setUserDialog(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {userDialog?.mode === "create" ? "Novo usuário" : "Editar usuário"}
            </DialogTitle>
            <DialogDescription>
              {userDialog?.mode === "create"
                ? "Crie um acesso de login para o RH. A consultora correspondente é criada automaticamente."
                : "Atualize o e-mail, a senha ou o papel deste usuário."}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label htmlFor="user-email">E-mail</Label>
              <Input
                id="user-email"
                type="email"
                value={form.email}
                onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
                placeholder="usuario@empresa.com"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="user-pass">
                Senha {userDialog?.mode === "edit" && "(deixe em branco para manter)"}
              </Label>
              <Input
                id="user-pass"
                type="password"
                value={form.password}
                onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))}
                placeholder="Mínimo 6 caracteres"
              />
            </div>
            <div className="flex items-center justify-between rounded-lg border p-3">
              <div>
                <Label htmlFor="user-admin">Administrador</Label>
                <p className="text-xs text-muted-foreground">
                  Acesso total a todas as abas do RH.
                </p>
              </div>
              <Switch
                id="user-admin"
                checked={form.isAdmin}
                onCheckedChange={(v) => setForm((f) => ({ ...f, isAdmin: v }))}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setUserDialog(null)}>
              Cancelar
            </Button>
            <Button
              disabled={
                saveUserMutation.isPending ||
                !form.email ||
                (userDialog?.mode === "create" && form.password.length < 6)
              }
              onClick={() => saveUserMutation.mutate()}
            >
              {saveUserMutation.isPending && (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              )}
              {userDialog?.mode === "create" ? "Criar" : "Salvar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete user confirmation */}
      <AlertDialog open={!!deleteTarget} onOpenChange={(o) => !o && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir usuário?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta ação remove permanentemente o acesso de{" "}
              <strong>{deleteTarget?.email}</strong>, incluindo vínculos e permissões. Não
              pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => deleteTarget && deleteUserMutation.mutate(deleteTarget.id)}
            >
              {deleteUserMutation.isPending && (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              )}
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
