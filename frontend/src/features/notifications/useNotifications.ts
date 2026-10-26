import { useQuery } from "@tanstack/react-query";
import { api } from "../../lib/api";
import { useAuth } from "../../lib/auth";
import { useFeatureNotices } from "./featureNotices";
import type { UnreadCount } from "../../types";

export const UNREAD_KEY = ["notifications", "unread-count"] as const;
export const CENTER_KEY = ["notifications", "center"] as const;

export function useUnreadTotal(): number {
  const { user, guest } = useAuth();
  const unread = useQuery({
    queryKey: UNREAD_KEY,
    queryFn: () => api.get<UnreadCount>("/notifications/unread-count"),
    enabled: !!user?.emailVerified && !guest,
    refetchInterval: 15000,
  });
  const notices = useFeatureNotices();
  return (unread.data?.count ?? 0) + notices.filter((n) => !n.read).length;
}
