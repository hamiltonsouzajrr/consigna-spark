import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Search, ShieldCheck, Save, Loader2, UserCog, IdCard, Plus, Pencil, Trash2, ShieldAlert } from "lucide-react";
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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { RhPageHeader, rhNav } from "@/components/rh/RhLayout";
import { useRhAccess } from "@/hooks/use-rh-access";
import {
  listRhUsers,
  setRhUserAccess,
  listRhEmployees,
  linkEmployeeUser,
  createRhUser,
  updateRhUser,
  deleteRhUser,
  type RhUserAccess,
} from "@/lib/rh/access.functions";

export const Route = createFileRoute("/rh/acessos")({
  component: AcessosPage,
});

// Tabs an admin can grant (exclude self-management / always-allowed entries).
const GRANTABLE = rhNav.filter((n) => !["/rh/dashboard", "/rh/portal"].includes(n.to));

function AcessosPage() {
  const { isAdmin, isLoading: accessLoading } = useRhAccess();
  const queryClient = useQueryClient();
  const fetchUsers = useServerFn(listRhUsers);
  const saveAccess = useServerFn(setRhUserAccess);
  const fetchEmployees = useServerFn(listRhEmployees);
  const linkEmployee = useServerFn(linkEmployeeUser);
  const createUser = useServerFn(createRhUser);
  const updateUser = useServerFn(updateRhUser);
  const removeUser = useServerFn(deleteRhUser);

  const [search, setSearch] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [draft, setDraft] = useState<Set<string>>(new Set());

  // User create/edit/delete dialog state.
  const [userDialog, setUserDialog] = useState<null | { mode: "create" | "edit" }>(null);
  const [form, setForm] = useState({ email: "", password: "", isAdmin: false });
  const [deleteTarget, setDeleteTarget] = useState<RhUserAccess | null>(null);

  const usersQuery = useQuery({
    queryKey: ["rh", "admin", "users"],
    queryFn: () => fetchUsers(),
    enabled: isAdmin,
  });

  const employeesQuery = useQuery({
    queryKey: ["rh", "admin", "employees"],
    queryFn: () => fetchEmployees(),
    enabled: isAdmin,
  });

  const employees = employeesQuery.data ?? [];
  const users = usersQuery.data ?? [];
  const selected = useMemo(
    () => users.find((u) => u.id === selectedId) ?? null,
    [users, selectedId],
  );

  // Sync the draft when the selected user (or its server data) changes.
  useEffect(() => {
    if (selected) setDraft(new Set(selected.tabs));
  }, [selected]);

  const mutation = useMutation({
    mutationFn: (vars: { userId: string; tabs: string[] }) => saveAccess({ data: vars }),
    onSuccess: () => {
      toast.success("Acessos atualizados.");
      queryClient.invalidateQueries({ queryKey: ["rh", "admin", "users"] });
      queryClient.invalidateQueries({ queryKey: ["rh", "my-access"] });
    },
    onError: (e: unknown) => toast.error(e instanceof Error ? e.message : "Erro ao salvar."),
  });

  const linkMutation = useMutation({
    mutationFn: (vars: { userId: string; employeeId: string | null }) =>
      linkEmployee({ data: vars }),
    onSuccess: () => {
      toast.success("Colaborador vinculado.");
      queryClient.invalidateQueries({ queryKey: ["rh", "admin", "users"] });
      queryClient.invalidateQueries({ queryKey: ["rh", "admin", "employees"] });
    },
    onError: (e: unknown) => toast.error(e instanceof Error ? e.message : "Erro ao vincular."),
  });

  const invalidateUsers = () =>
    queryClient.invalidateQueries({ queryKey: ["rh", "admin", "users"] });

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

  const openCreate = () => {
    setForm({ email: "", password: "", isAdmin: false });
    setUserDialog({ mode: "create" });
  };

  const openEdit = (u: RhUserAccess) => {
    setSelectedId(u.id);
    setForm({ email: u.email, password: "", isAdmin: u.isAdmin });
    setUserDialog({ mode: "edit" });
  };



  if (accessLoading) {
    return <Skeleton className="h-64 w-full" />;
  }

  if (!isAdmin) {
    return (
      <Card className="mx-auto max-w-md">
        <CardContent className="flex flex-col items-center gap-3 py-12 text-center">
          <ShieldCheck className="h-10 w-10 text-muted-foreground" />
          <p className="font-medium">Acesso restrito</p>
          <p className="text-sm text-muted-foreground">
            Apenas administradores podem gerenciar os acessos do RH.
          </p>
        </CardContent>
      </Card>
    );
  }

  const filtered = users.filter((u) =>
    u.email.toLowerCase().includes(search.toLowerCase()),
  );

  const toggle = (to: string, on: boolean) => {
    setDraft((prev) => {
      const next = new Set(prev);
      if (on) next.add(to);
      else next.delete(to);
      return next;
    });
  };

  const dirty =
    !!selected &&
    (draft.size !== selected.tabs.length ||
      selected.tabs.some((t) => !draft.has(t)));

  return (
    <div>
      <RhPageHeader
        title="Acessos ao RH"
        description="Defina quais abas do RH cada usuário pode visualizar."
      />

      <div className="grid gap-6 lg:grid-cols-[320px_1fr]">
        {/* Users list */}
        <Card className="h-fit">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between gap-2">
              <CardTitle className="text-base">Usuários</CardTitle>
              <Button size="sm" onClick={openCreate}>
                <Plus className="mr-1 h-4 w-4" />
                Novo
              </Button>
            </div>
            <div className="relative mt-2">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Buscar por e-mail…"
                className="pl-8"
              />
            </div>
          </CardHeader>
          <CardContent className="p-0">
            <ScrollArea className="h-[420px]">
              <div className="space-y-1 p-3 pt-0">
                {usersQuery.isLoading ? (
                  Array.from({ length: 5 }).map((_, i) => (
                    <Skeleton key={i} className="h-12 w-full" />
                  ))
                ) : filtered.length ? (
                  filtered.map((u: RhUserAccess) => (
                    <div
                      key={u.id}
                      className={`flex w-full items-center gap-1 rounded-lg border px-2 py-2 text-sm transition ${
                        u.id === selectedId
                          ? "border-primary bg-primary/5"
                          : "hover:bg-muted"
                      }`}
                    >
                      <button
                        onClick={() => setSelectedId(u.id)}
                        className="flex min-w-0 flex-1 items-center gap-2 text-left"
                      >
                        <span className="min-w-0 flex-1 truncate">
                          {u.employee ? u.employee.full_name : u.email}
                          {u.employee && (
                            <span className="block truncate text-xs text-muted-foreground">
                              {u.email}
                            </span>
                          )}
                        </span>
                        {u.isAdmin && (
                          <Badge variant="default" className="shrink-0 gap-1">
                            <ShieldAlert className="h-3 w-3" />
                            Admin
                          </Badge>
                        )}
                        <Badge variant="secondary" className="shrink-0">
                          {u.tabs.length}
                        </Badge>
                      </button>
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
                        className="h-7 w-7 shrink-0 text-destructive hover:text-destructive"
                        onClick={() => setDeleteTarget(u)}
                        title="Excluir usuário"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  ))
                ) : (
                  <p className="px-3 py-6 text-center text-sm text-muted-foreground">
                    Nenhum usuário encontrado.
                  </p>
                )}
              </div>
            </ScrollArea>
          </CardContent>
        </Card>

        {/* Tab grants */}
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
                    const checked = draft.has(n.to);
                    return (
                      <label
                        key={n.to}
                        className="flex cursor-pointer items-center gap-3 rounded-lg border p-3 text-sm transition hover:bg-muted"
                      >
                        <Checkbox
                          checked={checked}
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

      {/* Create / edit user dialog */}
      <Dialog open={!!userDialog} onOpenChange={(o) => !o && setUserDialog(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {userDialog?.mode === "create" ? "Novo usuário" : "Editar usuário"}
            </DialogTitle>
            <DialogDescription>
              {userDialog?.mode === "create"
                ? "Crie um acesso de login para o RH."
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
