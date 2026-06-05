import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useMemo } from "react";
import { useAuth } from "@/lib/auth";
import { getMyRhAccess } from "@/lib/rh/access.functions";

// Tabs every authenticated user can always reach (no admin grant required).
// Configurações/Acessos are admin-only and handled separately.
const ALWAYS_ALLOWED = new Set<string>(["/rh", "/rh/dashboard", "/rh/portal"]);

export function useRhAccess() {
  const { user } = useAuth();
  const fetchAccess = useServerFn(getMyRhAccess);

  const query = useQuery({
    queryKey: ["rh", "my-access", user?.id ?? "anon"],
    queryFn: () => fetchAccess(),
    enabled: !!user,
    staleTime: 60_000,
  });

  const isAdmin = query.data?.isAdmin ?? false;
  const granted = useMemo(
    () => new Set(query.data?.tabs ?? []),
    [query.data?.tabs],
  );

  const canAccess = (to: string) => {
    if (isAdmin) return true;
    if (ALWAYS_ALLOWED.has(to)) return true;
    return granted.has(to);
  };

  return {
    isAdmin,
    granted,
    canAccess,
    isLoading: query.isLoading,
    alwaysAllowed: ALWAYS_ALLOWED,
  };
}
