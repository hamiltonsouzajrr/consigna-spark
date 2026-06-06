import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Search, ShieldCheck, Save, Loader2, UserCog, IdCard } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
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

  const [search, setSearch] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [draft, setDraft] = useState<Set<string>>(new Set());

  const usersQuery = useQuery({
    queryKey: ["rh", "admin", "users"],
    queryFn: () => fetchUsers(),
    enabled: isAdmin,
  });

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
            <CardTitle className="text-base">Usuários</CardTitle>
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
                    <button
                      key={u.id}
                      onClick={() => setSelectedId(u.id)}
                      className={`flex w-full items-center justify-between gap-2 rounded-lg border px-3 py-2 text-left text-sm transition ${
                        u.id === selectedId
                          ? "border-primary bg-primary/5"
                          : "hover:bg-muted"
                      }`}
                    >
                      <span className="min-w-0 flex-1 truncate">{u.email}</span>
                      <Badge variant="secondary" className="shrink-0">
                        {u.tabs.length}
                      </Badge>
                    </button>
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
    </div>
  );
}
