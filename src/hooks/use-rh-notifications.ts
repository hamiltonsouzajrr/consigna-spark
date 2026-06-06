import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useAuth } from "@/lib/auth";
import { getMyNotifications, markNotificationsRead } from "@/lib/rh/access.functions";

export function useRhNotifications() {
  const { user } = useAuth();
  const fetchNotifications = useServerFn(getMyNotifications);
  const markRead = useServerFn(markNotificationsRead);
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ["rh", "notifications", user?.id ?? "anon"],
    queryFn: () => fetchNotifications(),
    enabled: !!user,
    refetchInterval: 60_000,
    staleTime: 30_000,
  });

  const items = query.data ?? [];
  const unread = items.filter((n) => !n.read).length;

  const mutation = useMutation({
    mutationFn: (ids?: string[]) => markRead({ data: ids ? { ids } : {} }),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: ["rh", "notifications"] }),
  });

  return {
    items,
    unread,
    isLoading: !!user && query.isLoading,
    markAllRead: () => mutation.mutate(undefined),
  };
}
