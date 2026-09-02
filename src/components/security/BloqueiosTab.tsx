import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Lock, LockOpen, Loader2, Search, ShieldAlert, LogOut, RefreshCw } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  listRhUsers,
  setRhUserBlocked,
  revokeRhUserSessions,
  type RhUserAccess,
} from "@/lib/rh/access.functions";

const fmt = (v: string | null) =>
  v ? new Date(v).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", year: "2-digit", hour: "2-digit", minute: "2-digit" }) : "—";

/**
 * Aba dedicada a bloquear e desbloquear o login das contas. Mostra sempre,
 * no topo, todas as contas bloqueadas (banidas) — mesmo sem busca.
 */
export function BloqueiosTab() {
  const queryClient = useQueryClient();
  const fetchUsers = useServerFn(listRhUsers);
  const blockUser = useServerFn(setRhUserBlocked);
  const revokeSessions = useServerFn(revokeRhUserSessions);
  const [busca, setBusca] = useState("");

  const { data: users = [], isLoading, isFetching, refetch } = useQuery({
    queryKey: ["rh", "admin", "users"],
    queryFn: () => fetchUsers(),
  });

  const blockMut = useMutation({
    mutationFn: (v: { targetUserId: string; blocked: boolean }) => blockUser({ data: v }),
    onSuccess: (_d, v) => {
      toast.success(v.blocked ? "Acesso bloqueado." : "Acesso liberado.");
      void queryClient.invalidateQueries({ queryKey: ["rh", "admin", "users"] });
    },
    onError: (e: any) => toast.error(e?.message ?? "Não foi possível alterar o bloqueio."),
  });

  const revokeMut = useMutation({
    mutationFn: (targetUserId: string) => revokeSessions({ data: { targetUserId } }),
    onSuccess: () => toast.success("Sessões encerradas."),
    onError: (e: any) => toast.error(e?.message ?? "Falha ao encerrar sessões."),
  });

  const termo = busca.trim().toLowerCase();
  const match = (u: RhUserAccess) =>
    !termo ||
    u.email.toLowerCase().includes(termo) ||
    (u.employee?.full_name ?? "").toLowerCase().includes(termo);

  const bloqueados = useMemo(() => users.filter((u) => u.blocked && match(u)), [users, termo]);
  const liberados = useMemo(() => users.filter((u) => !u.blocked && match(u)), [users, termo]);

  const linha = (u: RhUserAccess) => (
    <div
      key={u.id}
      className="flex flex-col gap-2 rounded-lg border p-3 sm:flex-row sm:items-center sm:justify-between"
    >
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <span className="truncate text-sm font-medium">{u.email}</span>
          {u.isAdmin && <Badge variant="secondary" className="text-[10px]">Admin</Badge>}
          {u.blocked ? (
            <Badge variant="destructive" className="text-[10px]">Bloqueado</Badge>
          ) : (
            <Badge variant="outline" className="text-[10px]">Ativo</Badge>
          )}
        </div>
        <p className="mt-0.5 text-xs text-muted-foreground">
          {u.employee?.full_name ? `${u.employee.full_name} · ` : ""}último login: {fmt(u.lastSignInAt)}
        </p>
      </div>
      <div className="flex shrink-0 gap-2">
        {u.blocked ? (
          <Button
            size="sm"
            disabled={blockMut.isPending}
            onClick={() => blockMut.mutate({ targetUserId: u.id, blocked: false })}
          >
            <LockOpen className="mr-1.5 h-3.5 w-3.5" /> Desbloquear
          </Button>
        ) : (
          <>
            <Button
              size="sm"
              variant="outline"
              disabled={revokeMut.isPending}
              onClick={() => revokeMut.mutate(u.id)}
              title="Encerrar sessões ativas"
            >
              <LogOut className="h-3.5 w-3.5" />
            </Button>
            <Button
              size="sm"
              variant="destructive"
              disabled={blockMut.isPending}
              onClick={() => blockMut.mutate({ targetUserId: u.id, blocked: true })}
            >
              <Lock className="mr-1.5 h-3.5 w-3.5" /> Bloquear
            </Button>
          </>
        )}
      </div>
    </div>
  );

  if (isLoading) {
    return (
      <div className="space-y-3">
        {Array.from({ length: 5 }).map((_, i) => (
          <Skeleton key={i} className="h-16 w-full" />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative min-w-[220px] flex-1">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            className="pl-8"
            placeholder="Buscar por e-mail ou colaborador…"
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
          />
        </div>
        <Button variant="outline" size="sm" onClick={() => void refetch()} disabled={isFetching}>
          {isFetching ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="mr-1.5 h-3.5 w-3.5" />}
          Atualizar
        </Button>
      </div>

      <Card className="border-destructive/30">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <ShieldAlert className="h-4 w-4 text-destructive" />
            Contas bloqueadas
            <Badge variant="destructive">{bloqueados.length}</Badge>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {bloqueados.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Nenhuma conta bloqueada no momento. Bloqueie abaixo para impedir o login.
            </p>
          ) : (
            bloqueados.map(linha)
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            Contas ativas <Badge variant="outline">{liberados.length}</Badge>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {liberados.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nenhuma conta encontrada.</p>
          ) : (
            liberados.map(linha)
          )}
        </CardContent>
      </Card>
    </div>
  );
}
