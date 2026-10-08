import { useInfiniteQuery, useQuery } from "@tanstack/react-query";
import { api, isGuestMode } from "../../lib/api";
import { useAuth } from "../../lib/auth";
import type {
  BadgeDto,
  ChestDto,
  Page,
  ProgressDto,
  PublicProgressDto,
  StreakWeekDto,
  StudySessionDto,
  StudySessionSummaryDto,
} from "../../types";

export const HISTORY_PAGE_SIZE = 20;

export const progressKeys = {
  me: ["progress", "me"] as const,
  user: (userId: number) => ["progress", userId] as const,
  badges: (who: number | "me") => ["badges", who] as const,
  chests: ["chests"] as const,
  activeSession: ["study-session", "active"] as const,
  streak: ["study-session", "streak"] as const,
  history: ["study-session", "history"] as const,
};

export function useProgressEnabled(): boolean {
  const { user } = useAuth();
  return !!user && !isGuestMode();
}

export function useMyProgress() {
  const enabled = useProgressEnabled();
  return useQuery({
    queryKey: progressKeys.me,
    queryFn: () => api.get<ProgressDto>("/progress/me"),
    enabled,
  });
}

export function useUserProgress(userId: number) {
  const enabled = useProgressEnabled();
  return useQuery({
    queryKey: progressKeys.user(userId),
    queryFn: () => api.get<PublicProgressDto>(`/users/${userId}/progress`),
    enabled: enabled && Number.isFinite(userId),
    retry: false,
  });
}

export function useBadges(who: number | "me") {
  const enabled = useProgressEnabled();
  return useQuery({
    queryKey: progressKeys.badges(who),
    queryFn: () => api.get<BadgeDto[]>(who === "me" ? "/badges" : `/users/${who}/badges`),
    enabled: enabled && (who === "me" || Number.isFinite(who)),
    retry: false,
  });
}

export function useChests(active = true) {
  const enabled = useProgressEnabled();
  return useQuery({
    queryKey: progressKeys.chests,
    queryFn: () => api.get<ChestDto[]>("/chests"),
    enabled: enabled && active,
  });
}

export function useActiveSession() {
  const enabled = useProgressEnabled();
  return useQuery({
    queryKey: progressKeys.activeSession,
    queryFn: async () => (await api.get<StudySessionDto | undefined>("/study-sessions/active")) ?? null,
    enabled,
    staleTime: 0,
    refetchOnWindowFocus: true,
    refetchInterval: (q) => (q.state.data ? 30_000 : false),
  });
}

export function useStreakWeek() {
  const enabled = useProgressEnabled();
  return useQuery({
    queryKey: progressKeys.streak,
    queryFn: () => api.get<StreakWeekDto>("/study-sessions/streak"),
    enabled,
  });
}

export function useSessionHistory() {
  const enabled = useProgressEnabled();
  return useInfiniteQuery({
    queryKey: progressKeys.history,
    queryFn: ({ pageParam }) =>
      api.get<Page<StudySessionSummaryDto>>(
        `/study-sessions?page=${pageParam}&size=${HISTORY_PAGE_SIZE}`,
      ),
    initialPageParam: 0,
    getNextPageParam: (last, all) => (last.hasMore ? all.length : undefined),
    enabled,
  });
}
