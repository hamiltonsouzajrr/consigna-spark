import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { ShieldCheck, ShieldOff, UserX, RefreshCw, History } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ConfirmDialog } from "./ConfirmDialog";
import { adminListSystemUsers, adminSetUserRole, adminDeleteSystemUser } from "@/lib/prospeccao/prospeccao.functions";

export function AcessosTab({ currentUserId }: { currentUserId: string }) {
  const qc = useQueryClient();
  const listSystemUsers = useServerFn(adminListSystemUsers);
  const setUserRole = useServerFn(adminSetUserRole);
  const deleteSystemUser = useServerFn(adminDeleteSystemUser);
  const [busy, setBusy] = useState(false);

  const usersQ = useQuery({ queryKey: ["prospect", "system-users"], queryFn: () => listSystemUsers() });
  const auditQ = useQuery({
    queryKey: ["prospect", "access-audit"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("rh_access_audit")
        .select("id,actor_email,target_email,action,created_at")
        .order("created_at", { ascending: false })
        .limit(10);
      if (error) throw new Error(error.message);
      return data ?? [];
    },
  });

  const refreshAll = () => qc.invalidateQueries({ queryKey: ["prospect"] });

  const toggleAdmin = async (targetUserId: string, makeAdmin: boolean) => {
    setBusy(true);
    try {
      await setUserRole({ data: { targetUserId, makeAdmin } });
      toast.success(makeAdmin ? "Acesso de admin concedido." : "Acesso de admin removido.");
      refreshAll();
    } catch (e) { toast.error(e instanceof Error ? e.message : "Falha ao atualizar acesso."); }
    setBusy(false);
  };

  const removeUser = async (targetUserId: string) => {
    setBusy(true);
    try {
      await deleteSystemUser({ data: { targetUserId } });
      toast.success("Usuário excluído.");
      refreshAll();
    } catch (e) { toast.error(e instanceof Error ? e.message : "Falha ao excluir usuário."); }
    setBusy(false);
  };

  return (
    <div className="space-y-4">
      <Card className="p-5">
        <div className="mb-3 flex items-center justify-between">
          <p className="flex items-center gap-2 text-sm font-semibold"><ShieldCheck className="h-4 w-4 text-primary" /> Acessos do sistema</p>
          <Button variant="ghost" size="sm" onClick={() => usersQ.refetch()} disabled={usersQ.isFetching}>
            <RefreshCw className={`mr-2 h-4 w-4 ${usersQ.isFetching ? "animate-spin" : ""}`} /> Atualizar
          </Button>
        </div>
        <p className="mb-3 text-xs text-muted-foreground">Gerencie quem é administrador e remova usuários. Ao excluir um usuário, seus leads voltam para o pool.</p>
        {usersQ.isPending ? (
          <div className="space-y-2">{Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-8 w-full" />)}</div>
        ) : usersQ.isError ? (
          <p className="text-sm text-destructive">Falha ao carregar usuários. <Button variant="link" size="sm" onClick={() => usersQ.refetch()}>Tentar novamente</Button></p>
        ) : (usersQ.data?.length ?? 0) === 0 ? (
          <p className="text-sm text-muted-foreground">Nenhum usuário encontrado.</p>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Usuário</TableHead><TableHead>Perfil</TableHead>
                  <TableHead className="text-right">Leads</TableHead><TableHead>Último acesso</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {usersQ.data!.map((u) => (
                  <TableRow key={u.id}>
                    <TableCell className="max-w-[260px] truncate font-medium">
                      {u.email}{u.id === currentUserId && <span className="ml-1 text-xs text-muted-foreground">(você)</span>}
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className={u.isAdmin ? "border-primary/40 text-primary" : "text-muted-foreground"}>
                        {u.isAdmin ? "Administrador" : "Consultora"}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">{u.leadCount}</TableCell>
                    <TableCell className="text-xs text-muted-foreground">{u.last_sign_in_at ? new Date(u.last_sign_in_at).toLocaleDateString("pt-BR") : "—"}</TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1">
                        <ConfirmDialog
                          title={u.isAdmin ? "Remover acesso de administrador?" : "Conceder acesso de administrador?"}
                          description={`${u.email} ${u.isAdmin ? "perderá" : "passará a ter"} acesso total ao painel administrativo.`}
                          confirmLabel={u.isAdmin ? "Remover admin" : "Tornar admin"}
                          destructive={u.isAdmin}
                          onConfirm={() => toggleAdmin(u.id, !u.isAdmin)}
                        >
                          <Button variant="ghost" size="sm" disabled={busy || (u.isAdmin && u.id === currentUserId)}>
                            {u.isAdmin ? <><ShieldOff className="mr-1 h-4 w-4" /> Remover admin</> : <><ShieldCheck className="mr-1 h-4 w-4" /> Tornar admin</>}
                          </Button>
                        </ConfirmDialog>
                        <ConfirmDialog
                          title="Excluir usuário?"
                          description={`${u.email} será removido do sistema.${u.leadCount ? ` Seus ${u.leadCount} lead(s) voltarão para o pool.` : ""} Esta ação não pode ser desfeita.`}
                          confirmLabel="Excluir"
                          destructive
                          onConfirm={() => removeUser(u.id)}
                        >
                          <Button variant="ghost" size="sm" className="text-destructive hover:text-destructive" disabled={busy || u.id === currentUserId}>
                            <UserX className="mr-1 h-4 w-4" /> Excluir
                          </Button>
                        </ConfirmDialog>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </Card>

      <Card className="p-5">
        <p className="mb-3 flex items-center gap-2 text-sm font-semibold"><History className="h-4 w-4 text-primary" /> Últimas alterações de acesso</p>
        {auditQ.isPending ? (
          <Skeleton className="h-16 w-full" />
        ) : (auditQ.data?.length ?? 0) === 0 ? (
          <p className="text-sm text-muted-foreground">Nenhum registro de auditoria ainda.</p>
        ) : (
          <ul className="space-y-2 text-xs">
            {auditQ.data!.map((a) => (
              <li key={a.id} className="flex flex-wrap items-center gap-2 border-b pb-2 last:border-0">
                <span className="text-muted-foreground">{new Date(a.created_at).toLocaleString("pt-BR")}</span>
                <Badge variant="outline">{a.action}</Badge>
                <span className="font-medium">{a.actor_email ?? "sistema"}</span>
                <span className="text-muted-foreground">→ {a.target_email ?? "—"}</span>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}
