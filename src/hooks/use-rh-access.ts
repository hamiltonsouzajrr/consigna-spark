import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useMemo } from "react";
import { useAuth } from "@/lib/auth";
import { getMyRhAccess } from "@/lib/rh/access.functions";

// Tabs every authenticated user can always reach (no admin grant required).
// Configurações/Acessos are admin-only and handled separately.
const ALWAYS_ALLOWED = new Set<string>(["/rh", "/rh/dashboard"]);

export function useRhAccess() {
  const { user, loading: authLoading } = useAuth();
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

  // Whether the user may see the RH area at all: admins, or users the admin
  // explicitly granted at least one RH tab.
  const hasAnyAccess = isAdmin || granted.size > 0;

  return {
    isAdmin,
    granted,
    canAccess,
    hasAnyAccess,
    isLoading: authLoading || (!!user && query.isLoading),
    alwaysAllowed: ALWAYS_ALLOWED,
  };
}
